import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { D3SunburstChartComponent } from './d3-sunburst-chart/d3-sunburst-chart.component';
import { DescriptiveStatisticsModule } from './descriptive-statistics.module';

@NgModule({
  imports: [
    DescriptiveStatisticsModule,
    RouterModule.forChild([{ path: '', component: D3SunburstChartComponent }]),
  ],
})
export class D3SunburstEntryModule {}
