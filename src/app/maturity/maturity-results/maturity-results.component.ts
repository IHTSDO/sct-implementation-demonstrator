import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-maturity-results',
  templateUrl: './maturity-results.component.html',
  styleUrl: './maturity-results.component.css'
})

export class MaturityResultsComponent {

  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() maturityResponse: any;

  objectKeys(obj: Record<string, unknown>): number {
    return Object.keys(obj).length;
  }

  ngAfterViewInit(): void {
    // Convert the object into an array of [KPA, { questions }]
    const kpaEntries = Object.entries(this.maturityResponse);
    // e.g. [ [ 'KPA1', { Q1: 5, Q2: 3, Q3: 8 } ], [ 'KPA2', {...} ] ...]

    // Labels will be the KPA keys: ['KPA1', 'KPA2', 'KPA3']
    const labels = kpaEntries.map(([kpaKey]) => kpaKey);

    // Compute the sum of questions for each KPA
    const dataSums = kpaEntries.map(([_, questions]) => 
      Object.values(questions as Record<string, number>)
            .reduce((acc, val) => acc + val, 0)
    );

    // Now create one single Radar chart
    new Chart(this.radarCanvas.nativeElement, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'KPAs Totals',
            data: dataSums,
            backgroundColor: 'rgba(54, 162, 235, 0.3)',
            borderColor: 'rgba(54, 162, 235, 1)',
            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
            pointBorderColor: '#fff'
          }
        ]
      },
      options: {
        aspectRatio: 2.0,
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Results by KPAs'
          }
        },
        layout: {
          padding: 0  // or a small numeric value
        },
        scales: {
          r: {
            pointLabels: {
              padding: 5  // smaller padding = labels closer to the graph
            },
            suggestedMin: 0,
            suggestedMax: 10,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
}
