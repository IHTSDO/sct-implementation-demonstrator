import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as d3 from 'd3';
import Papa from 'papaparse';

interface ChartItem {
  id: string;
  label: string;
  parent: string;
  value: number;
  labelCount?: number;
}

interface D3Node extends d3.HierarchyNode<any> {
  data: ChartItem;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

@Component({
  selector: 'app-d3-sunburst-chart',
  templateUrl: './d3-sunburst-chart.component.html',
  styleUrls: ['./d3-sunburst-chart.component.css'],
  standalone: false
})
export class D3SunburstChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  
  selectedItem: ChartItem | null = null;
  private chartData: ChartItem[] = [];
  private svg: any;
  private width = 600;
  private height = 600;
  private radius = Math.min(this.width, this.height) / 2;
  private color = d3.scaleOrdinal(d3.schemeCategory10);
  private partition = d3.partition().size([2 * Math.PI, this.radius]);
  private arc = d3.arc()
    .startAngle((d: any) => d.x0)
    .endAngle((d: any) => d.x1)
    .padAngle((d: any) => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(this.radius * 1.5)
    .innerRadius((d: any) => d.y0)
    .outerRadius((d: any) => d.y1 - 1);
  
  // Lazy loading and level management
  private maxVisibleLevels = 3;
  private currentRoot: any = null;
  private breadcrumb: any[] = [];
  public loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadChartData();
  }

  ngAfterViewInit() {
    this.initializeChart();
    // Add a simple test to verify D3 is working
    this.testD3Rendering();
  }

  private testD3Rendering() {
    console.log('=== TESTING D3 RENDERING ===');
    const g = this.svg.select('g');
    
    // Add a simple test circle
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 50)
      .attr('fill', 'red')
      .attr('stroke', 'darkred')
      .attr('stroke-width', 2);
    
    g.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '14px')
      .style('fill', 'white')
      .text('D3 Test');
    
    console.log('=== D3 TEST COMPLETED ===');
  }

  ngOnDestroy() {
    if (this.svg) {
      this.svg.remove();
    }
  }

  private initializeChart() {
    console.log('=== INITIALIZING CHART ===');
    
    // Clear any existing SVG
    d3.select(this.chartContainer.nativeElement).selectAll('*').remove();

    // Create SVG
    this.svg = d3.select(this.chartContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('font', '10px sans-serif');

    console.log('SVG created:', this.svg);

    // Create the main group for the sunburst
    const g = this.svg.append('g')
      .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

    console.log('Main group created:', g);

    // Add click handler for zoom
    g.on('click', (event: any, d: any) => {
      this.handleZoom(event, d);
    });
    
    console.log('=== CHART INITIALIZATION COMPLETED ===');
  }

  private loadChartData() {
    this.http.get('assets/data/test3.csv', { responseType: 'text' })
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
        console.log('=== CSV PARSING COMPLETED ===');
        console.log('Parsed rows:', results.data.length);
        
        this.chartData = results.data.map((row: any) => ({
          id: row.id,
          label: row.label,
          parent: row.parent || '',
          value: parseInt(row.value, 10),
          labelCount: row['label-count'] ? parseInt(row['label-count'], 10) : undefined
        }));
        
        console.log('=== STARTING RECOMPUTATION ===');
        this.recomputeValues();
        console.log('=== STARTING CHART CREATION ===');
        this.createSunburstChart();
        console.log('=== CHART CREATION COMPLETED ===');
      },
      error: (error: any) => {
        console.error('Error parsing CSV:', error);
        this.loadDefaultData();
      }
    });
  }

  private loadDefaultData() {
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
    console.log('=== STARTING VALUE RECOMPUTATION ===');
    
    const childrenMap = new Map<string, ChartItem[]>();
    
    this.chartData.forEach(item => {
      if (item.parent && item.parent.trim() !== '') {
        if (!childrenMap.has(item.parent)) {
          childrenMap.set(item.parent, []);
        }
        childrenMap.get(item.parent)!.push(item);
      }
    });

    const processedItems = new Set<string>();
    
    const processItem = (itemId: string): number => {
      if (processedItems.has(itemId)) {
        const item = this.chartData.find(i => i.id === itemId);
        return item ? item.value : 0;
      }
      
      const item = this.chartData.find(i => i.id === itemId);
      if (!item) return 0;
      
      const children = childrenMap.get(itemId);
      if (!children || children.length === 0) {
        processedItems.add(itemId);
        return item.value;
      }
      
      const childrenSum = children.reduce((total, child) => {
        return total + processItem(child.id);
      }, 0);
      
      item.value = childrenSum;
      processedItems.add(itemId);
      
      return childrenSum;
    };

    this.chartData.forEach(item => {
      processItem(item.id);
    });

    console.log('=== VALUE RECOMPUTATION COMPLETED ===');
  }

  private createSunburstChart() {
    console.log('=== CREATING D3 SUNBURST CHART ===');
    
    // Convert flat data to hierarchical structure
    const root = this.createHierarchy();
    
    // Set initial root and breadcrumb
    this.currentRoot = root;
    this.breadcrumb = [{ id: 'root', label: 'Root', node: root }];
    
    // Apply the partition layout
    const rootNode = this.partition(root as any);
    
    // Create the sunburst visualization with level limiting
    this.renderSunburst(rootNode);
    
    console.log('=== D3 SUNBURST CHART CREATED ===');
  }

  private createHierarchy() {
    console.log('=== CREATING HIERARCHY ===');
    console.log('Chart data:', this.chartData);
    
    // Create a map for quick lookup
    const itemMap = new Map<string, ChartItem>();
    this.chartData.forEach(item => itemMap.set(item.id, item));

    // Create hierarchical structure
    const root = {
      id: 'root',
      label: 'Root',
      value: 0,
      children: [] as any[]
    };

    // First pass: create all nodes
    const nodeMap = new Map<string, any>();
    this.chartData.forEach(item => {
      nodeMap.set(item.id, {
        id: item.id,
        label: item.label,
        value: item.value,
        labelCount: item.labelCount,
        children: []
      });
    });

    // Second pass: build parent-child relationships
    this.chartData.forEach(item => {
      const node = nodeMap.get(item.id);
      if (node) {
        if (!item.parent || item.parent.trim() === '') {
          // This is a root item
          root.children.push(node);
        } else {
          // This has a parent
          const parent = nodeMap.get(item.parent);
          if (parent) {
            parent.children.push(node);
          } else {
            // Parent not found, add to root
            root.children.push(node);
          }
        }
      }
    });

    console.log('Root children:', root.children);

    const hierarchy = d3.hierarchy(root)
      .sum((d: any) => d.value)
      .sort((a, b) => b.value! - a.value!);
      
    console.log('Final hierarchy:', hierarchy);
    console.log('Hierarchy descendants:', hierarchy.descendants().length);
    
    return hierarchy;
  }



  private renderSunburst(root: any) {
    console.log('=== RENDERING SUNBURST ===');
    console.log('Root:', root);
    
    const g = this.svg.select('g');
    console.log('Main group:', g);

    // Clear existing elements
    g.selectAll('*').remove();

    // Filter nodes to show only up to maxVisibleLevels from current root
    const visibleNodes = root.descendants().filter((d: any) => {
      const depthFromRoot = d.depth - root.depth;
      return depthFromRoot <= this.maxVisibleLevels;
    });

    console.log('Visible nodes:', visibleNodes.length);
    console.log('Visible nodes data:', visibleNodes);

    // If no visible nodes, show a simple circle
    if (visibleNodes.length <= 1) {
      console.log('No visible nodes, showing fallback circle');
      g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', this.radius * 0.8)
        .attr('fill', '#f0f0f0')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 2);
      
      g.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '16px')
        .style('fill', '#666')
        .text('No data to display');
      
      return;
    }

    // Create the sunburst segments
    const path = g.selectAll('path')
      .data(visibleNodes.slice(1)) // Skip the root node
      .join('path')
      .attr('fill', (d: any) => {
        // Color based on the first level from current root
        let colorNode = d;
        while (colorNode.depth > root.depth + 1) {
          colorNode = colorNode.parent;
        }
        return this.color(colorNode.data.label);
      })
      .attr('fill-opacity', (d: any) => arcVisible(d) ? (d.children ? 0.6 : 0.4) : 0)
      .attr('pointer-events', (d: any) => !arcVisible(d) ? 'none' : null)
      .attr('d', (d: any) => this.arc(d))
      .on('click', (event: any, d: any) => {
        this.handleZoom(event, d);
      })
      .on('mouseover', (event: any, d: any) => {
        this.handleMouseOver(event, d);
      })
      .on('mouseout', (event: any, d: any) => {
        this.handleMouseOut(event, d);
      });

    console.log('Paths created:', path.size());

    // Add labels
    const label = g.selectAll('text')
      .data(visibleNodes.slice(1))
      .join('text')
      .attr('dy', '0.35em')
      .attr('fill-opacity', (d: any) => labelVisible(d) ? 1 : 0)
      .attr('transform', (d: any) => labelTransform(d))
      .text((d: any) => d.data.label)
      .style('font-size', '10px')
      .style('pointer-events', 'none');

    console.log('Labels created:', label.size());

    // Add breadcrumb navigation
    this.renderBreadcrumb();

    // Helper functions
    function arcVisible(d: any) {
      // Simplified visibility - show all arcs for now
      return true;
    }

    function labelVisible(d: any) {
      // Show labels for larger segments
      return (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d: any) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = ((d.y0 + d.y1) / 2) * 0.8;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
    
    console.log('=== SUNBURST RENDERING COMPLETED ===');
  }

  private handleZoom(event: any, p: any) {
    event.stopPropagation();
    
    // Update the selected item
    this.selectedItem = {
      id: p.data.id,
      label: p.data.label,
      parent: p.parent ? p.parent.data.id : '',
      value: p.value,
      labelCount: p.data.labelCount
    };

    // Check if we should drill down or if this is a leaf node
    if (p.children && p.children.length > 0) {
      // Drill down to this node
      this.drillDown(p);
    } else {
      // This is a leaf node, just update selection
      console.log('Clicked on leaf node:', p.data.label);
    }
  }

  private drillDown(targetNode: any) {
    if (this.loading) return;
    
    this.loading = true;
    
    // Add to breadcrumb
    this.breadcrumb.push({
      id: targetNode.data.id,
      label: targetNode.data.label,
      node: targetNode
    });
    
    // Update current root
    this.currentRoot = targetNode;
    
    // Apply partition layout to new root
    const newRoot = this.partition(targetNode as any);
    
    // Animate transition to new view
    this.svg.transition().duration(750).tween('zoom', (d: any) => {
      const targetView: [number, number, number, number] = [targetNode.x0, targetNode.y0, targetNode.x1 - targetNode.x0, targetNode.y1 - targetNode.y0];
      return (t: number) => {
        this.view = [
          this.view[0] + (targetView[0] - this.view[0]) * t,
          this.view[1] + (targetView[1] - this.view[1]) * t,
          this.view[2] + (targetView[2] - this.view[2]) * t,
          this.view[3] + (targetView[3] - this.view[3]) * t
        ];
        this.zoomTo(this.view);
      };
    }).on('end', () => {
      // Re-render with new root
      this.renderSunburst(newRoot);
      this.loading = false;
    });
  }

  private drillUp(targetIndex: number) {
    if (this.loading || targetIndex >= this.breadcrumb.length) return;
    
    this.loading = true;
    
    // Update breadcrumb
    this.breadcrumb = this.breadcrumb.slice(0, targetIndex + 1);
    
    // Update current root
    this.currentRoot = this.breadcrumb[targetIndex].node;
    
    // Apply partition layout to new root
    const newRoot = this.partition(this.currentRoot as any);
    
    // Animate transition to new view
    this.svg.transition().duration(750).tween('zoom', (d: any) => {
      const targetView: [number, number, number, number] = [this.currentRoot.x0, this.currentRoot.y0, this.currentRoot.x1 - this.currentRoot.x0, this.currentRoot.y1 - this.currentRoot.y0];
      return (t: number) => {
        this.view = [
          this.view[0] + (targetView[0] - this.view[0]) * t,
          this.view[1] + (targetView[1] - this.view[1]) * t,
          this.view[2] + (targetView[2] - this.view[2]) * t,
          this.view[3] + (targetView[3] - this.view[3]) * t
        ];
        this.zoomTo(this.view);
      };
    }).on('end', () => {
      // Re-render with new root
      this.renderSunburst(newRoot);
      this.loading = false;
    });
  }

  private handleMouseOver(event: any, d: any) {
    // Highlight the segment
    d3.select(event.target)
      .attr('fill-opacity', 0.8);
  }

  private handleMouseOut(event: any, d: any) {
    // Reset the segment opacity
    d3.select(event.target)
      .attr('fill-opacity', d.children ? 0.6 : 0.4);
  }

  // Zoom state
  private view: [number, number, number, number] = [0, 0, 2 * Math.PI, this.radius];

  private zoomTo(v: [number, number, number, number]) {
    const k = this.width / v[2];
    this.svg.attr('transform', `translate(${(this.width - v[2] * k) / 2},${(this.height - v[3] * k) / 2})scale(${k})`);
    this.svg.selectAll('g').attr('transform', `translate(${v[0]},${v[1]})`);
  }

  public resetToRoot() {
    if (this.loading) return;
    
    this.loading = true;
    
    // Get the original root from the hierarchy
    const originalRoot = this.createHierarchy();
    
    // Reset breadcrumb and current root
    this.breadcrumb = [{ id: 'root', label: 'Root', node: originalRoot }];
    this.currentRoot = originalRoot;
    
    // Apply partition layout to root
    const rootNode = this.partition(originalRoot as any);
    
    // Animate transition back to root view
    this.svg.transition().duration(750).tween('zoom', (d: any) => {
      const targetView: [number, number, number, number] = [0, 0, 2 * Math.PI, this.radius];
      return (t: number) => {
        this.view = [
          this.view[0] + (targetView[0] - this.view[0]) * t,
          this.view[1] + (targetView[1] - this.view[1]) * t,
          this.view[2] + (targetView[2] - this.view[2]) * t,
          this.view[3] + (targetView[3] - this.view[3]) * t
        ];
        this.zoomTo(this.view);
      };
    }).on('end', () => {
      // Re-render with root
      this.renderSunburst(rootNode);
      this.loading = false;
    });
  }

  private renderBreadcrumb() {
    // Create breadcrumb container if it doesn't exist
    let breadcrumbContainer = this.svg.select('.breadcrumb-container');
    if (breadcrumbContainer.empty()) {
      breadcrumbContainer = this.svg.append('g')
        .attr('class', 'breadcrumb-container')
        .attr('transform', `translate(10, 10)`);
    }

    // Clear existing breadcrumb
    breadcrumbContainer.selectAll('*').remove();

    // Create breadcrumb items
    const breadcrumbItems = breadcrumbContainer.selectAll('.breadcrumb-item')
      .data(this.breadcrumb)
      .join('g')
      .attr('class', 'breadcrumb-item')
      .style('cursor', 'pointer');

    // Add background rectangles
    breadcrumbItems.append('rect')
      .attr('x', (d: any, i: number) => i * 120)
      .attr('y', 0)
      .attr('width', 110)
      .attr('height', 30)
      .attr('rx', 5)
      .attr('fill', (d: any, i: number) => i === this.breadcrumb.length - 1 ? '#007bff' : '#f8f9fa')
      .attr('stroke', '#dee2e6')
      .attr('stroke-width', 1);

    // Add text labels
    breadcrumbItems.append('text')
      .attr('x', (d: any, i: number) => i * 120 + 55)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any, i: number) => i === this.breadcrumb.length - 1 ? 'white' : '#495057')
      .style('font-size', '12px')
      .style('font-weight', (d: any, i: number) => i === this.breadcrumb.length - 1 ? 'bold' : 'normal')
      .text((d: any) => d.label.length > 15 ? d.label.substring(0, 12) + '...' : d.label);

    // Add click handlers for navigation
    breadcrumbItems.on('click', (event: any, d: any, i: number) => {
      if (i < this.breadcrumb.length - 1) {
        this.drillUp(i);
      }
    });

    // Add separators (arrows)
    breadcrumbContainer.selectAll('.breadcrumb-separator')
      .data(this.breadcrumb.slice(0, -1))
      .join('text')
      .attr('class', 'breadcrumb-separator')
      .attr('x', (d: any, i: number) => (i + 1) * 120 - 5)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6c757d')
      .style('font-size', '14px')
      .text('›');
  }
} 