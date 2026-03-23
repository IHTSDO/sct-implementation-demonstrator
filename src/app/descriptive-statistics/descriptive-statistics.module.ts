import { NgModule } from '@angular/core';
import { D3SunburstChartComponent } from './d3-sunburst-chart/d3-sunburst-chart.component';
import { PlotlyTreemapChartComponent } from './plotly-treemap-chart/plotly-treemap-chart.component';
import { SunburstChartComponent } from './sunburst-chart/sunburst-chart.component';
import { AppMaterialModule } from '../shared/app-material.module';

const DECLARATIONS = [
  D3SunburstChartComponent,
  PlotlyTreemapChartComponent,
  SunburstChartComponent,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [AppMaterialModule],
  exports: DECLARATIONS,
})
export class DescriptiveStatisticsModule {}
