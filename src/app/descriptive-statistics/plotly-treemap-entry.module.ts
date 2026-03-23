import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PlotlyTreemapChartComponent } from './plotly-treemap-chart/plotly-treemap-chart.component';
import { DescriptiveStatisticsModule } from './descriptive-statistics.module';

@NgModule({
  imports: [
    DescriptiveStatisticsModule,
    RouterModule.forChild([{ path: '', component: PlotlyTreemapChartComponent }]),
  ],
})
export class PlotlyTreemapEntryModule {}
