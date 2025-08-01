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
  originalParent?: string; // For navigation when parent is cleared for Plotly
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
  private allData: ChartItem[] = [];
  public currentRootId: string = '';
  public maxLevels = 4;
  public isLoading = false;

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
    
    // Add a small delay to show loading state and allow fade transition
    setTimeout(() => {
      if (rootId === '') {
        // Get root level items (items with no parent or empty parent)
        const rootItems = this.allData.filter(item => !item.parent || item.parent.trim() === '');
        
        // TEMPORARY HACK: Only use the first root item
        if (rootItems.length > 0) {
          const firstRoot = rootItems[0];
          this.chartData = this.getItemsUpToLevel([firstRoot], 1);
          this.currentRootId = firstRoot.id;
        } else {
          this.chartData = [];
          this.currentRootId = '';
        }
      } else {
        // Get items starting from the specified root
        const rootItem = this.allData.find(item => item.id === rootId);
        if (rootItem) {
          // Use the new method that includes the root item itself
          this.chartData = this.getItemsUpToLevelWithRoot(rootItem, 1);
          this.currentRootId = rootId;
        }
      }
      
      this.recomputeValues();
      
      // Ensure the root item is preserved after recompute
      if (this.currentRootId !== '') {
        const rootItem = this.allData.find(item => item.id === this.currentRootId);
        if (rootItem && !this.chartData.find(item => item.id === this.currentRootId)) {
          this.chartData.unshift(rootItem); // Add at the beginning
        }
      }
      
      this.mergeSmallSegments();
    this.createSunburstChart();
      
      // Add a small delay before hiding loading state for smooth transition
      setTimeout(() => {
        this.isLoading = false;
      }, 200);
    }, 150);
  }

  private getItemsUpToLevel(rootItems: ChartItem[], currentLevel: number): ChartItem[] {
    if (currentLevel > this.maxLevels) {
      return rootItems;
    }

    const result: ChartItem[] = [...rootItems];
    
    // Get children of current level items
    const children = this.allData.filter(item => 
      item.parent && rootItems.some(root => root.id === item.parent)
    );

    if (children.length > 0) {
      result.push(...this.getItemsUpToLevel(children, currentLevel + 1));
    }

    return result;
  }

  private getItemsUpToLevelWithRoot(rootItem: ChartItem, currentLevel: number): ChartItem[] {
    if (currentLevel > this.maxLevels) {
      return [rootItem];
    }

    // Create a copy of the root item and clear its parent to make it a root for Plotly
    // But preserve the original parent in a custom property for navigation
    const rootItemCopy = { 
      ...rootItem, 
      parent: '',
      originalParent: rootItem.parent // Store the original parent for navigation
    };
    const result: ChartItem[] = [rootItemCopy];
    
    // Get children of the root item
    const children = this.allData.filter(item => item.parent === rootItem.id);

    if (children.length > 0) {
      result.push(...this.getItemsUpToLevel(children, currentLevel + 1));
    }

    return result;
  }

  private loadDefaultData() {
    // Fallback data if CSV loading fails
    this.allData = [
      { id: '1', label: 'Patients', parent: '', value: 1000, labelCount: 1000 },
      { id: '2', label: 'Respiratory disorders', parent: '1', value: 400, labelCount: 400 },
      { id: '3', label: 'Asthma', parent: '2', value: 250, labelCount: 250 },
      { id: '4', label: 'Bronchitis', parent: '2', value: 150, labelCount: 150 },
      { id: '5', label: 'Chronic diseases', parent: '1', value: 600, labelCount: 600 },
      { id: '6', label: 'Diabetes', parent: '5', value: 350, labelCount: 350 },
      { id: '7', label: 'Hypertension', parent: '5', value: 250, labelCount: 250 }
    ];
    this.getData();
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

  private mergeSmallSegments() {
    const threshold = 100; // Merge segments with values less than this
    const maxSegments = 1000; // Only merge if we have more than this many segments
    
    // Check if we need to merge at all
    if (this.chartData.length <= maxSegments) {
      return;
    }
    
    const mergedItems: ChartItem[] = [];
    const processedParents = new Set<string>();

    // Create a map of parent IDs to their children to identify leaf nodes
    const childrenMap = new Map<string, ChartItem[]>();
    this.chartData.forEach(item => {
      if (item.parent && item.parent.trim() !== '') {
        if (!childrenMap.has(item.parent)) {
          childrenMap.set(item.parent, []);
        }
        childrenMap.get(item.parent)!.push(item);
      }
    });

    // Group items by parent
    const parentGroups = new Map<string, ChartItem[]>();
    this.chartData.forEach(item => {
      if (item.parent && item.parent.trim() !== '') {
        if (!parentGroups.has(item.parent)) {
          parentGroups.set(item.parent, []);
        }
        parentGroups.get(item.parent)!.push(item);
      }
    });

    // Process each parent group - only merge leaf nodes
    parentGroups.forEach((children, parentId) => {
      // Identify leaf nodes (nodes with no children)
      const leafNodes = children.filter(item => !childrenMap.has(item.id));
      const nonLeafNodes = children.filter(item => childrenMap.has(item.id));

      // Only merge small leaf nodes
      const smallLeafNodes = leafNodes.filter(item => item.value < threshold);
      const largeLeafNodes = leafNodes.filter(item => item.value >= threshold);

      if (smallLeafNodes.length > 1) {
        // Merge small leaf nodes into one "Other" category
        const totalValue = smallLeafNodes.reduce((sum, item) => sum + item.value, 0);
        const mergedItem: ChartItem = {
          id: `${parentId}_other`,
          label: 'Other',
          parent: parentId,
          value: totalValue,
          labelCount: totalValue
        };
        
        mergedItems.push(mergedItem);
        processedParents.add(parentId);
      } else {
        // Keep small leaf nodes as they are if there's only one
        mergedItems.push(...smallLeafNodes);
      }

      // Keep all large leaf nodes and all non-leaf nodes (parents)
      mergedItems.push(...largeLeafNodes);
      mergedItems.push(...nonLeafNodes);
    });

    // Add items that don't have parents (root items)
    const rootItems = this.chartData.filter(item => !item.parent || item.parent.trim() === '');
    mergedItems.push(...rootItems);

    // Add items whose parents weren't processed (they might be at different levels)
    const unprocessedItems = this.chartData.filter(item => 
      item.parent && 
      item.parent.trim() !== '' && 
      !processedParents.has(item.parent) &&
      !parentGroups.has(item.parent)
    );
    mergedItems.push(...unprocessedItems);

    // Ensure the current root item is always included
    if (this.currentRootId !== '') {
      const currentRootItem = this.allData.find(item => item.id === this.currentRootId);
      if (currentRootItem && !mergedItems.find(item => item.id === this.currentRootId)) {
        console.log('Adding current root item to merged items:', currentRootItem);
        mergedItems.unshift(currentRootItem); // Add at the beginning
      }
    }

    this.chartData = mergedItems;
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

    // If we have a current root ID, ensure it's treated as a root item for Plotly
    if (this.currentRootId !== '') {
      const currentRootItem = this.chartData.find(item => item.id === this.currentRootId);
      if (currentRootItem) {
        // Temporarily clear the parent to make it a root item for Plotly
        const originalParent = currentRootItem.parent;
        currentRootItem.parent = '';
      }
    }

    const layout = {
      title: {
        text: this.getCurrentRootLabel() === 'Root' ? 'Patient Distribution by Condition' : `${this.getCurrentRootLabel()} - Details`,
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

    // Check if chart already exists for smooth transition
    const existingChart = this.chartContainer.nativeElement.data;
    
    // Check if we can safely animate (only when drilling down to nodes already in the chart)
    const canAnimate = existingChart && 
                      existingChart.length > 0 && 
                      this.currentRootId !== '' &&
                      existingChart[0].ids && 
                      existingChart[0].ids.includes(this.currentRootId);
    
    if (canAnimate) {
      // Update existing chart with transition
      Plotly.animate(this.chartContainer.nativeElement, {
        data: plotData,
        layout: layout
      }, {
        transition: {
          duration: 800,
          easing: 'cubic-in-out'
        },
        frame: {
          duration: 800,
          redraw: true
        }
      });
    } else {
      // Create new chart (no animation for navigation to new areas)
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
  }

  public goToRoot() {
    this.getData();
  }

  public getCurrentRootLabel(): string {
    if (this.currentRootId === '') {
      return 'Root';
    }
    const rootItem = this.allData.find(item => item.id === this.currentRootId);
    return rootItem ? rootItem.label : 'Root';
  }

  private handleChartClick(data: any) {
    if (data && data.points && data.points.length > 0) {
      const point = data.points[0];
      const clickedId = point.id;
      
      // Find the corresponding item in our current chart data
      const selectedItem = this.chartData.find(item => item.id === clickedId);
      
      if (selectedItem) {
        this.selectedItem = selectedItem;
        
        // Check if this is a center click (current root item)
        if (clickedId === this.currentRootId) {
          // Check if we can navigate up to the original parent
          if (selectedItem.originalParent && selectedItem.originalParent.trim() !== '') {
            this.getData(selectedItem.originalParent);
            return;
          } else {
            this.getData(); // Go to absolute root
            return;
          }
        }
        
        // Check if this item exists in the full dataset and has children
        const itemInAllData = this.allData.find(item => item.id === clickedId);
        const hasChildren = this.allData.some(item => item.parent === clickedId);
        
        if (itemInAllData && hasChildren) {
          // Drill down to this node
          this.getData(clickedId);
        }
      }
    }
  }


} 