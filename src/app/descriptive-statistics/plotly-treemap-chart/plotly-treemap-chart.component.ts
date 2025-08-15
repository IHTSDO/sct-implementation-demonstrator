import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Plotly from 'plotly.js-dist';
import Papa from 'papaparse';

interface ChartItem {
  id: string;
  label: string;
  parent: string;
  value: number;
  labelCount?: number;
  originalParent?: string;
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
          value: parseInt(row.value, 10),
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
        } else {
          this.chartData = [];
          this.currentRootId = '';
        }
      } else {
        const rootItem = this.allData.find(item => item.id === rootId);
        if (rootItem) {
          this.chartData = this.getItemsUpToLevel([rootItem], 1);
          this.currentRootId = rootId;
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
      { id: 'root', label: 'Root', parent: '', value: 100 },
      { id: 'child1', label: 'Child 1', parent: 'root', value: 60 },
      { id: 'child2', label: 'Child 2', parent: 'root', value: 40 },
      { id: 'grandchild1', label: 'Grandchild 1', parent: 'child1', value: 30 },
      { id: 'grandchild2', label: 'Grandchild 2', parent: 'child1', value: 30 },
      { id: 'grandchild3', label: 'Grandchild 3', parent: 'child2', value: 40 }
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
      parents.push(item.parent || '');
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
        // Check if this is the current root (parent box)
        if (clickedId === this.currentRootId) {
          // Clicking on the current root navigates back to its parent
          this.drillUp();
        } else {
          // Check if this item has children
          const children = this.allData.filter(item => item.parent === clickedId);
          if (children.length > 0) {
            this.drillDown(clickedId);
          } else {
            this.selectedItem = clickedItem;
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

} 