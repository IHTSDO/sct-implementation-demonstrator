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
}

@Component({
  selector: 'app-sunburst-chart',
  templateUrl: './sunburst-chart.component.html',
  styleUrls: ['./sunburst-chart.component.css'],
  standalone: false
})
export class SunburstChartComponent implements OnInit {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  
  selectedItem: ChartItem | null = null;
  private chartData: ChartItem[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadChartData();
  }

  private loadChartData() {
    this.http.get('assets/data/test3.csv', { responseType: 'text' })
      .subscribe({
        next: (csvData: string) => {
          this.parseCSVData(csvData);
        },
        error: (error: any) => {
          console.error('Error loading CSV data:', error);
          // Fallback to default data if CSV loading fails
          this.loadDefaultData();
        }
      });
  }

  private parseCSVData(csvData: string) {
    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.chartData = results.data.map((row: any) => ({
          id: row.id,
          label: row.label,
          parent: row.parent || '',
          value: parseInt(row.value, 10),
          labelCount: row['label-count'] ? parseInt(row['label-count'], 10) : undefined
        }));
        
        this.recomputeValues();
        this.createSunburstChart();
      },
      error: (error: any) => {
        console.error('Error parsing CSV:', error);
        this.loadDefaultData();
      }
    });
  }

  private loadDefaultData() {
    // Fallback data if CSV loading fails
    this.chartData = [
      { id: '1', label: 'Patients', parent: '', value: 1000, labelCount: 1000 },
      { id: '2', label: 'Respiratory disorders', parent: '1', value: 400, labelCount: 400 },
      { id: '3', label: 'Asthma', parent: '2', value: 250, labelCount: 250 },
      { id: '4', label: 'Bronchitis', parent: '2', value: 150, labelCount: 150 },
      { id: '5', label: 'Chronic diseases', parent: '1', value: 600, labelCount: 600 },
      { id: '6', label: 'Diabetes', parent: '5', value: 350, labelCount: 350 },
      { id: '7', label: 'Hypertension', parent: '5', value: 250, labelCount: 250 }
    ];
    this.recomputeValues();
    this.createSunburstChart();
  }

  private recomputeValues() {
    // Create a map of parent IDs to their children
    const childrenMap = new Map<string, ChartItem[]>();
    
    // Group children by parent
    this.chartData.forEach(item => {
      if (item.parent && item.parent.trim() !== '') {
        if (!childrenMap.has(item.parent)) {
          childrenMap.set(item.parent, []);
        }
        childrenMap.get(item.parent)!.push(item);
      }
    });

    // First pass: recompute leaf nodes (nodes with no children) to use their actual values
    // Second pass: recompute parent nodes as sum of their children
    const processedItems = new Set<string>();
    
    // Process items in order from leaves to roots
    const processItem = (itemId: string): number => {
      if (processedItems.has(itemId)) {
        const item = this.chartData.find(i => i.id === itemId);
        return item ? item.value : 0;
      }
      
      const item = this.chartData.find(i => i.id === itemId);
      if (!item) return 0;
      
      const children = childrenMap.get(itemId);
      if (!children || children.length === 0) {
        // This is a leaf node, keep its original value
        processedItems.add(itemId);
        return item.value;
      }
      
      // This is a parent node, sum up all its children
      const childrenSum = children.reduce((total, child) => {
        return total + processItem(child.id);
      }, 0);
      
      // Update the parent's value
      item.value = childrenSum;
      processedItems.add(itemId);
      
      return childrenSum;
    };

    // Process all items
    this.chartData.forEach(item => {
      processItem(item.id);
    });
  }

  private createSunburstChart() {
    // Extract arrays for Plotly
    const ids = this.chartData.map(row => row.id);
    const labels = this.chartData.map(row => row.label);
    const parents = this.chartData.map(row => row.parent);
    const values = this.chartData.map(row => row.value);

    const plotData: any = [{
      type: 'sunburst',
      ids: ids,
      labels: labels,
      parents: parents,
      values: values,
      branchvalues: 'total',
      textinfo: 'label+text',
      text: this.chartData.map(item => `${item.labelCount || item.value}`),
      textfont: { size: 14 },
      marker: {
        colors: [
          '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
          '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'
        ]
      }
    }];

    const layout = {
      title: {
        text: 'Patient Distribution by Condition',
        font: { size: 20 }
      },
      margin: { l: 0, r: 0, b: 0, t: 50 },
      autosize: true,
      height: 600
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false
    };

    Plotly.newPlot(this.chartContainer.nativeElement, plotData, layout, config)
      .then(() => {
        // Add click event listener after the plot is created
        this.chartContainer.nativeElement.on('plotly_click', (data: any) => {
          this.handleChartClick(data);
        });
        
        // Resize the chart to fit the container
        Plotly.relayout(this.chartContainer.nativeElement, {
          width: this.chartContainer.nativeElement.offsetWidth,
          height: 600
        });
      })
      .catch((error: any) => {
        console.error('Plotly error:', error);
      });
  }

  private handleChartClick(data: any) {
    if (data && data.points && data.points.length > 0) {
      const point = data.points[0];
      const clickedId = point.id;
      
      // Find the corresponding item in our data
      const selectedItem = this.chartData.find(item => item.id === clickedId);
      
      if (selectedItem) {
        this.selectedItem = selectedItem;
      }
    }
  }


} 