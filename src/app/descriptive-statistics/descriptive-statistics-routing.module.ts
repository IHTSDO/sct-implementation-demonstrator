import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { D3SunburstChartComponent } from './d3-sunburst-chart/d3-sunburst-chart.component';
import { PlotlyTreemapChartComponent } from './plotly-treemap-chart/plotly-treemap-chart.component';
import { SunburstChartComponent } from './sunburst-chart/sunburst-chart.component';

const routes: Routes = [
  { path: 'sunburst-chart', component: SunburstChartComponent },
  { path: 'd3-sunburst-chart', component: D3SunburstChartComponent },
  { path: 'descriptive-analytics', component: PlotlyTreemapChartComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DescriptiveStatisticsRoutingModule {}
