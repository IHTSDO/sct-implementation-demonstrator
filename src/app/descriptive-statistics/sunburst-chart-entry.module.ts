import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SunburstChartComponent } from './sunburst-chart/sunburst-chart.component';
import { DescriptiveStatisticsModule } from './descriptive-statistics.module';

@NgModule({
  imports: [
    DescriptiveStatisticsModule,
    RouterModule.forChild([{ path: '', component: SunburstChartComponent }]),
  ],
})
export class SunburstChartEntryModule {}
