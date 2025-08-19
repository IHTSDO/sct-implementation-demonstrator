import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
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
export class PlotlyTreemapChartComponent implements OnInit {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  
  selectedItem: ChartItem | null = null;
  private chartData: ChartItem[] = [];
  private allData: ChartItem[] = [];
  public currentRootId: string = '';
  public maxLevels = 4;
  public isLoading = false;
  public searchTerm: string = '';
  public searchResults: ChartItem[] = [];
  public patients: Patient[] = [];
  public isLoadingPatients = false;
  public showPatients = false;
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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadChartData();
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
        hoverTexts.push(`<b>${item.label}</b><br>Value: ${item.value}<br><i>Click to go back</i>`);
      } else {
        hoverTexts.push(`<b>${item.label}</b><br>Value: ${item.value}`);
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
        // Always update the selected item when clicking
        this.selectedItem = clickedItem;
        
        // Clear any previously loaded patients when selecting a new item
        this.closePatients();
        
        // Check if this is the current root (parent box)
        if (clickedId === this.currentRootId) {
          // Clicking on the current root navigates back to its parent
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
    this.showPatients = false;
    this.patients = [];

    // Extract the base conceptId by removing any suffix (e.g., "373873005_1" -> "373873005")
    const baseConceptId = conceptId.split('_')[0];

    // Get all descendant conceptIds (including the base conceptId itself)
    const descendantConceptIds = this.getAllDescendantConceptIds(baseConceptId);

    this.http.get<PatientResponse>('assets/data/mock_patients_5000.json')
      .subscribe({
        next: (response: PatientResponse) => {
          // Filter patients that have events with any of the descendant conceptIds
          this.patients = response.content.filter(patient => {
            const hasMatchingEvent = patient.events.some(event => {
              const eventConceptId = event.conceptId.toString();
              return descendantConceptIds.includes(eventConceptId);
            });
            return hasMatchingEvent;
          });
          
          this.isLoadingPatients = false;
          this.showPatients = true;
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
    
    // Recursive function to find all descendants
    const findDescendants = (parentId: string) => {
      // Find all items in allData that have this parentId
      const children = this.allData.filter(item => {
        const itemBaseId = item.id.split('_')[0];
        const parentBaseId = parentId.split('_')[0];
        return itemBaseId !== parentBaseId && item.parent && item.parent.split('_')[0] === parentBaseId;
      });
      
      // Add each child and recursively find their descendants
      children.forEach(child => {
        const childBaseId = child.id.split('_')[0];
        if (!descendants.has(childBaseId)) {
          descendants.add(childBaseId);
          findDescendants(childBaseId);
        }
      });
    };
    
    findDescendants(conceptId);
    
    return Array.from(descendants);
  }

  public closePatients(): void {
    this.showPatients = false;
    this.patients = [];
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

  public getSelectedConceptLabel(): string {
    if (this.selectedItem) {
      return this.selectedItem.label;
    }
    return 'selected concept';
  }



} 