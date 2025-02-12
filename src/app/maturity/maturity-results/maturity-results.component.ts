import { Component, ElementRef, Input, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { TitleCasePipe } from '@angular/common';
Chart.register(...registerables);

@Component({
    selector: 'app-maturity-results',
    templateUrl: './maturity-results.component.html',
    styleUrls: ['./maturity-results.component.css'],
    standalone: false
})
export class MaturityResultsComponent implements OnChanges, AfterViewInit {
  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() maturityResponse: any;
  @Input() allQuestions: any[] = [];

  private chart!: Chart;

  resultsScale = [
    { value: 1, label: 'Basic' },
    { value: 2, label: 'Limited' },
    { value: 3, label: 'Advanced' },
    { value: 4, label: 'Integrated' },
    { value: 5, label: 'Optimizing' }
  ]

  ngAfterViewInit(): void {
    if (this.maturityResponse) {
      this.generateChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.radarCanvas && changes['maturityResponse'] && this.maturityResponse) {
      this.generateChart();
    }
  }

  private generateChart(): void {
    if (this.chart) {
      this.chart.destroy(); // Destroy existing chart to avoid duplication
    }
  
    // Parse and group the data
    const groupedData: Record<string, { sum: number, count: number }> = {};
    Object.entries(this.maturityResponse).forEach(([key, value]) => {
      const [stakeholder, kpa, question] = key.split('.');
      if (stakeholder && kpa && question && stakeholder === this.maturityResponse.selectedStakeholder) {
        groupedData[kpa] = groupedData[kpa] || { sum: 0, count: 0 };
        groupedData[kpa].sum += value as number || 0;
        groupedData[kpa].count += 1;
      }
    });
  
    // Prepare labels (KPAs) and datasets (stakeholders)
    const kpaIds = Array.from(new Set(Object.keys(this.maturityResponse)
      .filter(key => key.startsWith(this.maturityResponse.selectedStakeholder))
      .map(key => key.split('.')[1]))); // Extract unique KPA IDs
  
    const kpaLabels = kpaIds.map(kpaId => this.getKpaName(kpaId) || kpaId); // Use getKpaNameById to resolve KPA names
  
    const datasets = [{
      label: this.getStakeholderName(),
      data: kpaIds.map(kpa => groupedData[kpa] ? groupedData[kpa].sum / groupedData[kpa].count : 0), // Calculate average
      backgroundColor: 'rgba(54, 162, 235, 0.3)',
      borderColor: 'rgba(54, 162, 235, 1)',
      pointBackgroundColor: 'rgba(54, 162, 235, 1)',
      pointBorderColor: '#fff'
    }];
  
    // Create Radar Chart
    this.chart = new Chart(this.radarCanvas.nativeElement, {
      type: 'radar',
      data: {
        labels: kpaLabels,
        datasets
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
            text: 'Maturity Results by Stakeholder and KPA'
          }
        },
        scales: {
          r: {
            pointLabels: {
              padding: 5
            },
            suggestedMin: 0,
            suggestedMax: 5,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  getStakeholders(response: any): string[] {
    return Array.from(new Set(Object.keys(response).map((key) => key.split('.')[0])));
  }
  
  getKpas(response: any, stakeholder: string): string[] {
    return Array.from(
      new Set(
        Object.keys(response)
          .filter((key) => key.startsWith(stakeholder))
          .map((key) => key.split('.')[1])
      )
    );
  }

  getStakeholderName(): string {
    return this.allQuestions[0].stakeholderName;
  }

  getKpaName(kpaId: string): string {
    // Find the first matching KPA with the given kpaId
    const kpa = this.allQuestions.find(item => item.kpaId === kpaId);
    // Return the KPA name if found, otherwise return null
    return kpa ? kpa.kpaName : null;
  }
  
  
  getQuestions(response: any, stakeholder: string, kpa: string): Record<string, number | null> {
    return Object.keys(response)
      .filter((key) => key.startsWith(`${stakeholder}.${kpa}`))
      .reduce((acc, key) => {
        const questionKey = key.split('.').slice(2).join('.');
        acc[questionKey] = response[key];
        return acc;
      }, {} as Record<string, number | null>);
  }
  
  getStakeholderRowSpan(response: any, stakeholder: string): number {
    const kpas = this.getKpas(response, stakeholder);
    return kpas.reduce((total, kpa) => total + this.getKpaRowSpan(response, stakeholder, kpa), 0);
  }
  
  getKpaRowSpan(response: any, stakeholder: string, kpa: string): number {
    return Object.keys(response).filter((key) => key.startsWith(`${stakeholder}.${kpa}`)).length;
  }
  
  isFirstRowInStakeholder(index: number, stakeholder: string, kpa: string): boolean {
    const kpaIndex = this.getKpas(this.maturityResponse, stakeholder).indexOf(kpa);
    return index === 0 && kpaIndex === 0;
  }
  
  isFirstRowInKpa(index: number): boolean {
    return index === 0;
  }
  
  calculateAverage(questions: Record<string, number | null>): number {
    const values = Object.values(questions).filter((value) => value !== null) as number[];
    const sum = values.reduce((acc, val) => acc + val, 0);
    return values.length > 0 ? sum / values.length : 0;
  }

  calculateOverallAverage(data: Record<string, any>): number {
    // Object to group values by KPA
    const kpas: { [key: string]: number[] } = {};
    const excludedKeys = ['selectedStakeholder', 'name', 'author', 'timestamp', 'selectedKpas'];
  
    // Process the data to group scores by KPA
    for (const key in data) {
      if (data.hasOwnProperty(key) && data[key] !== null && !excludedKeys.includes(key)) {
        const kpa = key.split('.')[1]; // Extract the KPA from the key
        if (!kpas[kpa]) {
          kpas[kpa] = [];
        }
        kpas[kpa].push(data[key]);
      }
    }
  
    // Calculate the average for each KPA, ignoring empty groups
    const kpaAverages = Object.keys(kpas)
      .filter(kpa => kpas[kpa].length > 0) // Ignore empty KPA groups
      .map(kpa => {
        const values = kpas[kpa];
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      });
  
    // Calculate the overall average of the KPA averages
    const overallAverage =
      kpaAverages.length > 0
        ? kpaAverages.reduce((sum, avg) => sum + avg, 0) / kpaAverages.length
        : 0; // Return 0 if no KPA averages exist
  
    return overallAverage;
  }

  getScaleLabel(value: number): string {
    // round to the lowest whole number
    value = Math.floor(value);
    return this.resultsScale.find((scale) => scale.value === value)?.label || '';
  }

  getMarkerPosition(value: number): number {
    // Assuming your valid range is 1 through 5
    const min = 1;
    const max = 5;
  
    if (value < min) value = min;
    if (value > max) value = max;
    
    // Convert the 1–5 score to 0–100%
    return ((value - min) / (max - min)) * 100;
  }
  
  
}
