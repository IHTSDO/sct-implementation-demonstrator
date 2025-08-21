import { Component, OnInit, ElementRef, ViewChild, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Plotly from 'plotly.js-dist';
import Papa from 'papaparse';

interface ChartItem {
  id: string;
  label: string;
  parent: string;
  value: number;
  patientCount?: number;
  labelCount?: number;
  originalParent?: string;
}

interface PatientEvent {
  conceptId: number;
  conceptTerm: string;
  date: string;
  dateLong: number;
}

interface Patient {
  id: string;
  gender: string;
  dobYear: number;
  dataset: string;
  events: PatientEvent[];
}

interface PatientResponse {
  content: Patient[];
  pageable: any;
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: any;
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

@Component({
  selector: 'app-plotly-treemap-chart',
  templateUrl: './plotly-treemap-chart.component.html',
  styleUrls: ['./plotly-treemap-chart.component.css'],
  standalone: false
})
export class PlotlyTreemapChartComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @ViewChild('genderChartContainer', { static: false }) genderChartContainer!: ElementRef;
  
  selectedItem: ChartItem | null = null;
  private chartData: ChartItem[] = [];
  private allData: ChartItem[] = [];
  public currentRootId: string = '';
  public maxLevels = 4;
  public isLoading = false;
  public rootNodeCount: number = 0;
  public searchTerm: string = '';
  public searchResults: ChartItem[] = [];
  public patients: Patient[] = [];
  public isLoadingPatients = false;
  public showPatients = false;
  public showGenderChart = false;
  public loadingMessage = '';
  private shouldCreateGenderChart = false;
  private colorMap = new Map<string, string>();
  private colorPalette = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
    '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
    '#bcbd22', '#17becf', '#a6cee3', '#fb9a99',
    '#fdbf6f', '#cab2d6', '#ffff99', '#b15928',
    '#8dd3c7', '#ffffb3', '#bebada', '#fb8072',
    '#80b1d3', '#fdb462', '#b3de69', '#fccde5'
  ];

  private chart: any = null;
  private genderChart: any = null;
  private resizeListener: (() => void) | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadChartData();
    
    // Add resize listener for responsive charts
    this.resizeListener = () => {
      if (this.showGenderChart && this.genderChart) {
        this.createGenderDistributionChart();
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngAfterViewInit() {
    // ViewChild elements are now available
    if (this.shouldCreateGenderChart && this.genderChartContainer) {
      this.createGenderDistributionChart();
    }
  }

  ngOnDestroy() {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    
    // Clean up charts
    if (this.genderChart && this.genderChartContainer) {
      Plotly.purge(this.genderChartContainer.nativeElement);
    }
  }

  private loadPatientCounts(): void {
    this.http.get<PatientResponse>('assets/data/mock_patients_5000.json')
      .subscribe({
        next: (response: PatientResponse) => {
          this.calculatePatientCounts(response.content);
          this.getData();
        },
        error: (error: any) => {
          console.error('Error loading patient data for counts:', error);
          // Continue without patient counts if loading fails
          this.getData();
        }
      });
  }

  private calculatePatientCounts(patients: Patient[]): void {
    // Create a map to store patient counts for each concept
    const conceptPatientCounts = new Map<string, Set<string>>();
    
    // Process each patient's events
    patients.forEach(patient => {
      patient.events.forEach(event => {
        const conceptId = event.conceptId.toString();
        if (!conceptPatientCounts.has(conceptId)) {
          conceptPatientCounts.set(conceptId, new Set());
        }
        conceptPatientCounts.get(conceptId)!.add(patient.id);
      });
    });
    
    // Update the chart data with patient counts
    this.allData.forEach(item => {
      const baseConceptId = item.id.split('_')[0];
      const patientSet = conceptPatientCounts.get(baseConceptId);
      item.patientCount = patientSet ? patientSet.size : 0;
      
      // Use patient count as the value for the treemap if available
      if (item.patientCount > 0) {
        item.value = item.patientCount;
      }
    });
  }

  private loadChartData() {
    this.http.get('assets/data/test5.csv', { responseType: 'text' })
      .subscribe({
        next: (csvData: string) => {
          this.parseCSVData(csvData);
        },
        error: (error: any) => {
          console.error('Error loading CSV data:', error);
          this.loadDefaultData();
        }
      });
  }

  private parseCSVData(csvData: string) {
    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.allData = results.data.map((row: any) => ({
          id: row.id,
          label: row.label,
          parent: row.parent || '',
          value: parseInt(row.patientCount || row.value, 10), // Use patientCount if available, fallback to value
          patientCount: row.patientCount ? parseInt(row.patientCount, 10) : undefined,
          labelCount: row['label-count'] ? parseInt(row['label-count'], 10) : undefined
        }));
        
        // Calculate and store the root node count
        this.calculateRootNodeCount();
        
        this.getData();
      },
      error: (error: any) => {
        console.error('Error parsing CSV:', error);
        this.loadDefaultData();
      }
    });
  }

  private getData(rootId: string = '') {
    this.isLoading = true;
    
    setTimeout(() => {
      if (rootId === '') {
        const rootItems = this.allData.filter(item => !item.parent || item.parent.trim() === '');
        
        if (rootItems.length > 0) {
          const firstRoot = rootItems[0];
          this.chartData = this.getItemsUpToLevel([firstRoot], 1);
          this.currentRootId = firstRoot.id;
          // Auto-select the root item
          this.selectedItem = firstRoot;
          
          // Trigger change detection to update statistics
          this.cdr.detectChanges();
          
          // Auto-load patients if the root item has 5000 or fewer patients
          setTimeout(() => {
            this.autoLoadPatientsIfNeeded();
          }, 200); // Small delay to ensure chart is initialized
        } else {
          this.chartData = [];
          this.currentRootId = '';
          this.selectedItem = null;
        }
      } else {
        const rootItem = this.allData.find(item => item.id === rootId);
        if (rootItem) {
          this.chartData = this.getItemsUpToLevel([rootItem], 1);
          this.currentRootId = rootId;
          // Auto-select the current root item
          this.selectedItem = rootItem;
          
          // Trigger change detection to update statistics
          this.cdr.detectChanges();
        }
      }
      
      this.isLoading = false;
      this.initializeChart();
    }, 100);
  }

  private getItemsUpToLevel(items: ChartItem[], currentLevel: number): ChartItem[] {
    if (currentLevel >= this.maxLevels) {
      return items;
    }

    const result: ChartItem[] = [];
    
    for (const item of items) {
      result.push(item);
      
      const children = this.allData.filter(child => child.parent === item.id);
      if (children.length > 0) {
        const childItems = this.getItemsUpToLevel(children, currentLevel + 1);
        result.push(...childItems);
      }
    }
    
    return result;
  }

  private loadDefaultData() {
    this.allData = [
      { id: 'root', label: 'Root', parent: '', value: 100, patientCount: 100 },
      { id: 'child1', label: 'Child 1', parent: 'root', value: 60, patientCount: 60 },
      { id: 'child2', label: 'Child 2', parent: 'root', value: 40, patientCount: 40 },
      { id: 'grandchild1', label: 'Grandchild 1', parent: 'child1', value: 30, patientCount: 30 },
      { id: 'grandchild2', label: 'Grandchild 2', parent: 'child1', value: 30, patientCount: 30 },
      { id: 'grandchild3', label: 'Grandchild 3', parent: 'child2', value: 40, patientCount: 40 }
    ];
    this.getData();
  }

  private initializeChart() {
    const data = this.convertToPlotlyTreemapData();
    
    const layout = {
      width: this.chartContainer.nativeElement.offsetWidth,
      height: this.chartContainer.nativeElement.offsetHeight,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      treemapcolorway: this.colorPalette,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot(this.chartContainer.nativeElement, data, layout, config).then(() => {
      this.chartContainer.nativeElement.on('plotly_click', (data: any) => {
        this.handleChartClick(data);
      });
    });
  }

  private convertToPlotlyTreemapData(): any[] {
    const ids: string[] = [];
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    const hoverTexts: string[] = [];
    const textColors: string[] = [];

    this.chartData.forEach((item) => {
      ids.push(item.id);
      labels.push(item.label);
      
      // If this is the current root item, make it a true root (no parent)
      // Otherwise, use its original parent
      const parent = (item.id === this.currentRootId) ? '' : (item.parent || '');
      parents.push(parent);
      
      values.push(item.value);
      
      // Use consistent color based on item ID
      const colorIndex = this.getColorIndexForItem(item.id);
      const backgroundColor = this.colorPalette[colorIndex];
      colors.push(backgroundColor);
      
      // Calculate text color based on background brightness
      textColors.push(this.getContrastTextColor(backgroundColor));
      
      // Add special hover text for current root
      if (item.id === this.currentRootId) {
        hoverTexts.push(`<b>${item.label}</b><br>Patients: ${item.value}<br><i>Click to go back</i>`);
      } else {
        hoverTexts.push(`<b>${item.label}</b><br>Patients: ${item.value}`);
      }
    });

    return [{
      type: 'treemap',
      ids: ids,
      labels: labels,
      parents: parents,
      values: values,
      textinfo: 'label+value',
      hovertemplate: '%{customdata}<extra></extra>',
      customdata: hoverTexts,
      marker: {
        colors: colors,
        line: {
          width: 1,
          color: 'white'
        }
      },
      textfont: {
        size: 12,
        color: textColors
      }
    }];
  }

  private handleChartClick(data: any): void {
    const point = data.points[0];
    const clickedId = point.id;
    
    if (clickedId) {
      const clickedItem = this.allData.find(item => item.id === clickedId);
      if (clickedItem) {
        // Check if this is the current root (parent box) - if so, don't set selectedItem yet
        if (clickedId === this.currentRootId) {
          // Will be handled in drillUp()
        } else {
          // Always update the selected item when clicking (except for drill-up)
          this.selectedItem = clickedItem;
          
          // Clear any previously loaded patients when selecting a new item
          this.closePatients();
          
          // Trigger change detection to update statistics
          this.cdr.detectChanges();
          
          // Auto-load patients if there are 5000 or fewer
          this.autoLoadPatientsIfNeeded();
        }
        
        // Check if this is the current root (parent box)
        if (clickedId === this.currentRootId) {
          // Clicking on the current root navigates back to its parent
          // Don't set selectedItem here - it will be set in drillUp()
          this.drillUp();
        } else {
          // Check if this item has children
          const children = this.allData.filter(item => item.parent === clickedId);
          if (children.length > 0) {
            this.drillDown(clickedId);
          }
        }
      }
    }
  }

  public drillDown(itemId: string) {
    const item = this.allData.find(data => data.id === itemId);
    if (item) {
      this.getData(itemId);
    }
  }

  public drillUp() {
    if (this.currentRootId) {
      const currentItem = this.allData.find(item => item.id === this.currentRootId);
      if (currentItem && currentItem.parent) {
        // Find the parent item and set it as selected
        const parentItem = this.allData.find(item => item.id === currentItem.parent);
        if (parentItem) {
          this.selectedItem = parentItem;
          // Clear any previously loaded patients when selecting a new item
          this.closePatients();
          // Trigger change detection to update statistics
          this.cdr.detectChanges();
          // Auto-load patients if there are 5000 or fewer
          this.autoLoadPatientsIfNeeded();
        }
        this.getData(currentItem.parent);
      }
    }
  }

  public goToRoot() {
    this.getData('');
  }

  public getCurrentRootLabel(): string {
    const rootItem = this.allData.find(item => item.id === this.currentRootId);
    return rootItem ? rootItem.label : '';
  }

  public onSearchInput() {
    if (!this.searchTerm || this.searchTerm.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    const keywords = this.searchTerm.toLowerCase().trim().split(/\s+/).filter(k => k.length > 0);
    if (keywords.length === 0) {
      this.searchResults = [];
      return;
    }

    this.searchResults = this.allData
      .filter(item => this.matchesMultiPrefix(item, keywords))
      .sort((a, b) => a.label.length - b.label.length) // Sort by label length, shortest first
      .filter((item, index, array) => 
        array.findIndex(firstItem => firstItem.label === item.label) === index
      ) // Remove duplicates, keep first occurrence
      .slice(0, 20); // Limit to 20 results for performance
  }

  private matchesMultiPrefix(item: ChartItem, keywords: string[]): boolean {
    const itemText = `${item.label} ${item.id}`.toLowerCase();
    const words = itemText.split(/\s+/);
    
    // Check if all keywords match the beginning of any word
    return keywords.every(keyword => 
      words.some(word => word.startsWith(keyword))
    );
  }

  public selectSearchResult(result: ChartItem) {
    this.selectedItem = result;
    
    // Clear any previously loaded patients when selecting a new item
    this.closePatients();
    
    // Navigate to this node in the chart
    if (result.id !== this.currentRootId) {
      this.getData(result.id);
    }
    
    // Trigger change detection to update statistics
    this.cdr.detectChanges();
    
    // Auto-load patients if there are 300 or fewer
    this.autoLoadPatientsIfNeeded();
    
    // Clear search after selection
    this.searchTerm = '';
    this.searchResults = [];
  }

  public getNodePath(item: ChartItem): string {
    const path: string[] = [];
    let current = item;
    
    while (current.parent) {
      const parent = this.allData.find(p => p.id === current.parent);
      if (parent) {
        path.unshift(parent.label);
        current = parent;
      } else {
        break;
      }
    }
    
    return path.join(' > ');
  }

  private getColorIndexForItem(itemId: string): number {
    // Find the item in allData to get its position in the complete dataset
    const allDataIndex = this.allData.findIndex(item => item.id === itemId);
    if (allDataIndex >= 0) {
      return allDataIndex % this.colorPalette.length;
    }
    // Fallback: use a hash of the item ID for consistent coloring
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      const char = itemId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.colorPalette.length;
  }

  public getColorForItem(itemId: string): string {
    const colorIndex = this.getColorIndexForItem(itemId);
    return this.colorPalette[colorIndex];
  }

  public getTextColorForItem(itemId: string): string {
    const backgroundColor = this.getColorForItem(itemId);
    return this.getContrastTextColor(backgroundColor);
  }

  private getContrastTextColor(backgroundColor: string): string {
    // Convert hex to RGB
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Use black text on light backgrounds, white text on dark backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  public loadPatientsForSelectedItem(): void {
    if (this.selectedItem) {
      this.getPatients(this.selectedItem.id);
    }
  }

  public getPatients(conceptId: string): void {
    this.isLoadingPatients = true;
    this.loadingMessage = 'Loading patient data...';
    this.showPatients = false;
    this.showGenderChart = false;
    this.patients = [];

    // Extract the base conceptId by removing any suffix (e.g., "373873005_1" -> "373873005")
    const baseConceptId = conceptId.split('_')[0];

    // Get all descendant conceptIds (including the base conceptId itself)
    const descendantConceptIds = this.getAllDescendantConceptIds(baseConceptId);

    this.http.get<PatientResponse>('assets/data/mock_patients_5000.json')
      .subscribe({
        next: (response: PatientResponse) => {
          // Process patient filtering asynchronously to prevent UI freezing
          setTimeout(() => {
            this.loadingMessage = 'Processing patient data...';
            
            // Filter patients that have events with any of the descendant conceptIds
            this.patients = response.content.filter(patient => {
              const hasMatchingEvent = patient.events.some(event => {
                const eventConceptId = event.conceptId.toString();
                return descendantConceptIds.includes(eventConceptId);
              });
              return hasMatchingEvent;
            });
            
            this.isLoadingPatients = false;
            this.loadingMessage = '';
            this.showPatients = true;
            this.showGenderChart = true;
            this.shouldCreateGenderChart = true;
            
            // Create the chart
            setTimeout(() => {
              if (this.shouldCreateGenderChart && this.genderChartContainer) {
                this.createGenderDistributionChart();
              }
            }, 0);
          }, 0);
        },
        error: (error: any) => {
          console.error('Error loading patients:', error);
          this.isLoadingPatients = false;
        }
      });
  }

  private getAllDescendantConceptIds(conceptId: string): string[] {
    const descendants = new Set<string>();
    descendants.add(conceptId);
    
    // Create a map for faster lookups
    const parentToChildren = new Map<string, string[]>();
    
    // Build parent-to-children mapping
    this.allData.forEach(item => {
      const itemBaseId = item.id.split('_')[0];
      const parentBaseId = item.parent ? item.parent.split('_')[0] : '';
      
      if (parentBaseId && itemBaseId !== parentBaseId) {
        if (!parentToChildren.has(parentBaseId)) {
          parentToChildren.set(parentBaseId, []);
        }
        parentToChildren.get(parentBaseId)!.push(itemBaseId);
      }
    });
    
    // Recursive function to find all descendants using the map
    const findDescendants = (parentId: string) => {
      const children = parentToChildren.get(parentId) || [];
      
      children.forEach(childId => {
        if (!descendants.has(childId)) {
          descendants.add(childId);
          findDescendants(childId);
        }
      });
    };
    
    findDescendants(conceptId);
    
    return Array.from(descendants);
  }

  public getSelectedConceptLabel(): string {
    if (this.selectedItem) {
      return this.selectedItem.label;
    }
    return 'selected concept';
  }

  public getIncidencePercentage(): string {
    if (!this.selectedItem || !this.selectedItem.value) {
      return '0.0';
    }
    
    // Always use the root node count for percentage calculation
    const affectedPatients = this.selectedItem.value;
    const percentage = (affectedPatients / this.rootNodeCount) * 100;
    
    return percentage.toFixed(2);
  }

  private calculateRootNodeCount(): void {
    // Calculate the total count from root items (items with no parent)
    const rootItems = this.allData.filter(item => !item.parent || item.parent.trim() === '');
    this.rootNodeCount = rootItems.reduce((sum, item) => sum + (item.value || 0), 0);
  }

  private getTotalPopulationCount(): number {
    // If we're at the root level (no current root selected)
    if (!this.currentRootId) {
      const rootItems = this.allData.filter(item => !item.parent || item.parent.trim() === '');
      const totalPatients = rootItems.reduce((sum, item) => sum + (item.value || 0), 0);
      return totalPatients;
    }
    
    // Show the patient count of the current root node
    const currentRootItem = this.allData.find(item => item.id === this.currentRootId);
    if (currentRootItem) {
      return currentRootItem.value;
    }
    
    return 0;
  }

  public getVariantCount(): number {
    if (!this.selectedItem) {
      return 0;
    }
    
    // Count all descendant nodes (including the selected item itself)
    const descendantConceptIds = this.getAllDescendantConceptIds(this.selectedItem.id.split('_')[0]);
    return descendantConceptIds.length;
  }

  private autoLoadPatientsIfNeeded(): void {
    if (this.selectedItem && this.selectedItem.value <= 5000 && !this.showPatients) {
      this.loadPatientsForSelectedItem();
    }
  }

  private createGenderDistributionChart(): void {
    console.log('Creating population pyramid chart...');
    console.log('Patients length:', this.patients.length);
    console.log('Gender chart container:', this.genderChartContainer);
    
    if (!this.genderChartContainer || this.patients.length === 0) {
      console.log('Early return: no container or no patients');
      return;
    }

    // Calculate age groups and gender distribution
    const ageGroups = this.calculateAgeGroups();
    const totalCount = this.patients.length;

    console.log('Age groups:', ageGroups);
    console.log('Total patients:', totalCount);

    if (totalCount === 0) {
      console.log('Early return: no patients with data');
      return;
    }

    // Create data for the population pyramid
    const maleData = {
      type: 'bar',
      y: ageGroups.map(group => group.label),
      x: ageGroups.map(group => -group.maleCount), // Negative for left side
      name: 'Male',
      orientation: 'h',
      marker: {
        color: '#1f77b4', // Blue for males
        width: 1.2
      },
      text: ageGroups.map(group => 
        group.maleCount > 0 ? `${group.maleCount.toLocaleString()} (${((group.maleCount / totalCount) * 100).toFixed(1)}%)` : ''
      ),
      textposition: 'inside',
      textfont: {
        color: 'white',
        size: 14
      },
      hovertemplate: 'Male %{y}: %{text}<extra></extra>'
    };

    const femaleData = {
      type: 'bar',
      y: ageGroups.map(group => group.label),
      x: ageGroups.map(group => group.femaleCount), // Positive for right side
      name: 'Female',
      orientation: 'h',
      marker: {
        color: '#e377c2', // Pink for females
        width: 1.2
      },
      text: ageGroups.map(group => 
        group.femaleCount > 0 ? `${group.femaleCount.toLocaleString()} (${((group.femaleCount / totalCount) * 100).toFixed(1)}%)` : ''
      ),
      textposition: 'inside',
      textfont: {
        color: 'white',
        size: 14
      },
      hovertemplate: 'Female %{y}: %{text}<extra></extra>'
    };

    const data = [maleData, femaleData];

    // Calculate max value for axis range
    const maxValue = Math.max(...ageGroups.map(group => Math.max(group.maleCount, group.femaleCount)));

    const layout = {
      width: this.genderChartContainer.nativeElement.offsetWidth || 400,
      height: Math.max(500, ageGroups.length * 30), // Dynamic height based on number of age groups
      margin: { l: 100, r: 100, t: 40, b: 40 },
      barmode: 'overlay',
      showlegend: false,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: 'Number of Patients',
        showgrid: true,
        gridcolor: '#e0e0e0',
        zeroline: true,
        zerolinecolor: '#333',
        zerolinewidth: 2,
        range: [-maxValue * 1.1, maxValue * 1.1],
        tickmode: 'auto',
        nticks: 5
      },
      yaxis: {
        showgrid: false,
        zeroline: false,
        title: 'Age Groups'
      },
      annotations: [
        {
          x: -maxValue * 0.8,
          y: 1.02,
          xref: 'x',
          yref: 'paper',
          text: 'Male',
          showarrow: false,
          font: {
            size: 14,
            color: '#1f77b4'
          }
        },
        {
          x: maxValue * 0.8,
          y: 1.02,
          xref: 'x',
          yref: 'paper',
          text: 'Female',
          showarrow: false,
          font: {
            size: 14,
            color: '#e377c2'
          }
        }
      ]
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    // Clear any existing chart
    if (this.genderChart) {
      Plotly.purge(this.genderChartContainer.nativeElement);
    }

    // Use setTimeout to ensure DOM element is ready
    setTimeout(() => {
      console.log('Attempting to create population pyramid...');
      console.log('Container element:', this.genderChartContainer.nativeElement);
      
      Plotly.newPlot(this.genderChartContainer.nativeElement, data, layout, config).then(() => {
        console.log('Population pyramid created successfully');
        this.genderChart = this.genderChartContainer.nativeElement;
      }).catch((error: any) => {
        console.error('Error creating population pyramid:', error);
      });
    }, 100);
  }

  private calculateAgeGroups(): Array<{label: string, maleCount: number, femaleCount: number}> {
    const ageGroups: Array<{label: string, maleCount: number, femaleCount: number}> = [];
    
    // Create age groups in 5-year intervals
    for (let i = 0; i <= 20; i++) {
      const startAge = i * 5;
      const endAge = startAge + 4;
      const label = i === 20 ? '100+' : `${startAge}-${endAge}`;
      
      ageGroups.push({
        label,
        maleCount: 0,
        femaleCount: 0
      });
    }

    // Count patients in each age group
    this.patients.forEach(patient => {
      const age = this.getPatientAge(patient.dobYear);
      const ageGroupIndex = Math.min(Math.floor(age / 5), 20); // Cap at 100+
      
      if (patient.gender === 'MALE') {
        ageGroups[ageGroupIndex].maleCount++;
      } else if (patient.gender === 'FEMALE') {
        ageGroups[ageGroupIndex].femaleCount++;
      }
    });

    return ageGroups;
  }

  public closePatients(): void {
    this.showPatients = false;
    this.showGenderChart = false;
    this.shouldCreateGenderChart = false;
    this.patients = [];
    
    // Clean up gender chart if it exists
    if (this.genderChart && this.genderChartContainer) {
      Plotly.purge(this.genderChartContainer.nativeElement);
      this.genderChart = null;
    }
  }

  public getPatientAge(dobYear: number): number {
    const currentYear = new Date().getFullYear();
    return currentYear - dobYear;
  }

  public getPatientEventCount(patient: Patient): number {
    return patient.events.length;
  }

  public getPatientEventsForConcept(patient: Patient, conceptId: string): PatientEvent[] {
    // Extract the base conceptId by removing any suffix
    const baseConceptId = conceptId.split('_')[0];
    return patient.events.filter(event => event.conceptId.toString() === baseConceptId);
  }

  public getPatientEventsTooltip(patient: Patient): string {
    if (patient.events.length === 0) {
      return 'No events';
    }
    
    const eventList = patient.events.map(event => 
      `${event.date}: ${event.conceptTerm}`
    ).join('\n');
    
    return eventList;
  }

  public getTotalPatientsCount(): string {
    // If we're at the root level (no current root selected)
    if (!this.currentRootId) {
      const rootItems = this.allData.filter(item => !item.parent || item.parent.trim() === '');
      const totalPatients = rootItems.reduce((sum, item) => sum + (item.value || 0), 0);
      return totalPatients.toLocaleString();
    }
    
    // Show the patient count of the current root node
    const currentRootItem = this.allData.find(item => item.id === this.currentRootId);
    if (currentRootItem) {
      return currentRootItem.value.toLocaleString();
    }
    
    return '0';
  }



} 