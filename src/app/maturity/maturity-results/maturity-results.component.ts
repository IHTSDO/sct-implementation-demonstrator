import { Component, ElementRef, Input, ViewChild, OnChanges, SimpleChanges, AfterViewInit, OnInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
    selector: 'app-maturity-results',
    templateUrl: './maturity-results.component.html',
    styleUrls: ['./maturity-results.component.css'],
    standalone: false
})


export class MaturityResultsComponent implements OnChanges, AfterViewInit, OnInit {
  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() maturityResponse: any;
  @Input() allQuestions: any[] = [];

  private chart!: Chart;

  overallAverage: number = 1;
  kpaAverages: Record<string, number> = {};
  commentList: any[] = [];

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

  ngOnInit(): void {
    this.processComments();
    this.computeKpaAverages();
    this.overallAverage = this.calculateOverallAverage(this.maturityResponse);
    console.log(this.allQuestions);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.radarCanvas && changes['maturityResponse'] && this.maturityResponse) {
      this.processComments();
      this.computeKpaAverages();
      this.overallAverage = this.calculateOverallAverage(this.maturityResponse);
      this.generateChart();
    }
  }

  private generateChart(): void {
    if (this.chart) {
      this.chart.destroy(); // Destroy existing chart to avoid duplication
    }
  
    // Parse and group the data (numeric only)
    const groupedData: Record<string, { sum: number, count: number }> = {};
  
    Object.entries(this.maturityResponse).forEach(([key, value]) => {
      // 1) Ensure `value` is a finite number (exclude strings, null, etc.)
      if (typeof value !== 'number' || !isFinite(value)) {
        return; // Skip non-numeric fields (including comments)
      }
  
      // 2) Decompose the key. Format = stakeholder_kpa_question
      const [stakeholder, kpa, question] = key.split('_');
  
      // 3) Only accumulate data for the selected stakeholder
      if (
        stakeholder &&
        kpa &&
        question &&
        stakeholder === this.maturityResponse.selectedStakeholder
      ) {
        groupedData[kpa] = groupedData[kpa] || { sum: 0, count: 0 };
        groupedData[kpa].sum += value;
        groupedData[kpa].count += 1;
      }
    });
  
    // Extract unique KPA IDs for the selected stakeholder
    const allKpaIds = Array.from(
      new Set(
        Object.keys(this.maturityResponse)
          .filter(key => key.startsWith(this.maturityResponse.selectedStakeholder))
          .map(key => key.split('_')[1])
      )
    );
  
    // Filter KPA IDs based on whether they are marked `true` in `selectedKpas`
    const kpaIds = allKpaIds.filter(kpaId => this.maturityResponse.selectedKpas?.[kpaId]);
  
    // Prepare labels (KPAs) and dataset (stakeholder)
    const kpaLabels = kpaIds.map(kpaId => this.getKpaName(kpaId) || kpaId);
    
    const datasets = [
      {
        label: this.getStakeholderName(),
        data: kpaIds.map(kpa => {
          const dataObj = groupedData[kpa];
          if (!dataObj) {
            return 0;
          }
          return dataObj.sum / dataObj.count; // Average
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.3)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff'
      }
    ];
  
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
    return Array.from(new Set(Object.keys(response).map((key) => key.split('_')[0])));
  }
  
  getKpas(response: any, stakeholder: string): string[] {
    const allKpas = Array.from(
      new Set(
        Object.keys(response)
          .filter((key) => key.startsWith(stakeholder + '_'))
          .map((key) => key.split('_')[1])
      )
    );
  
    return allKpas.filter(kpa => response.selectedKpas?.[kpa]);
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
      .filter((key) => key.startsWith(`${stakeholder}_${kpa}`))
      .reduce((acc, key) => {
        const questionKey = key.split('_').slice(2).join('_');
        acc[questionKey] = response[key];
        return acc;
      }, {} as Record<string, number | null>);
  }
  
  getStakeholderRowSpan(response: any, stakeholder: string): number {
    const kpas = this.getKpas(response, stakeholder);
    return kpas.reduce((total, kpa) => total + this.getKpaRowSpan(response, stakeholder, kpa), 0);
  }
  
  getKpaRowSpan(response: any, stakeholder: string, kpa: string): number {
    return Object.keys(response).filter((key) => key.startsWith(`${stakeholder}_${kpa}`)).length;
  }
  
  isFirstRowInStakeholder(index: number, stakeholder: string, kpa: string): boolean {
    const kpaIndex = this.getKpas(this.maturityResponse, stakeholder).indexOf(kpa);
    return index === 0 && kpaIndex === 0;
  }
  
  isFirstRowInKpa(index: number): boolean {
    return index === 0;
  }
  
  calculateAverage(questions: Record<string, any>): number {
    // Filter out anything that is not a valid finite number
    const numericValues = Object.values(questions)
      .filter(val => typeof val === 'number' && isFinite(val));
  
    if (numericValues.length === 0) {
      return 0;
    }
  
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    return sum / numericValues.length;
  }

  private computeKpaAverages(): void {
    this.kpaAverages = {}; // reset
    
    // Only compute for the currently selected stakeholder
    const stakeholder = this.maturityResponse.selectedStakeholder;
    // Get all selected KPA IDs
    const selectedKpas = this.getKpas(this.maturityResponse, stakeholder);

    selectedKpas.forEach(kpa => {
      // 1) Gather the KPA’s questions
      const questions = this.getQuestions(this.maturityResponse, stakeholder, kpa);
      // 2) Compute the average
      this.kpaAverages[kpa] = this.calculateAverage(questions);
    });
  }
  

  calculateOverallAverage(data: Record<string, any>): number {
    // Object to group values by KPA
    const kpas: { [key: string]: number[] } = {};
    // You might want to exclude any meta keys or other fields you don't want to process
    const excludedKeys = ['selectedStakeholder', 'name', 'author', 'timestamp', 'selectedKpas', 'comment'];
  
    // Process the data to group scores by KPA
    for (const key in data) {
      if (!data.hasOwnProperty(key)) {
        continue;
      }

      // Skip null values, excluded keys, etc.
      if (data[key] === null || excludedKeys.includes(key)) {
        continue;
      }

      const val = data[key];
  
      // Only push if val is a finite number
      if (typeof val != 'number' || !isFinite(val)) {
        continue;
      }

      // key format: stakeholder_kpa_question
      const [stakeholder, kpa, question] = key.split('_');
  
      // Make sure the KPA is in the selectedKpas and is set to true
      // (Change data.selectedKpas to this.maturityResponse.selectedKpas if needed)
      if (kpa && data['selectedKpas'] && data['selectedKpas'][kpa]) {
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

  private processComments(): void {
    const newComments: any[] = [];

    // Loop through allQuestions to find corresponding user selections and comments
    for (const item of this.allQuestions) {
      // e.g., "member_engagement_involvement"
      const fullPath = item.questionFullPath;
      if (!fullPath) {
        continue;
      }

      // Check if there's a numeric selection in maturityResponse
      const selectedValue = this.maturityResponse[fullPath];
      if (typeof selectedValue !== 'number' || !isFinite(selectedValue)) {
        continue; // skip if no valid numeric selection
      }

      // Find the matching option in 'options' by score
      const matchingOption = item.question.options.find((opt: any) => opt.score === selectedValue);
      const selectedOptionText = matchingOption ? matchingOption.text : '';

      // Check for a comment key (e.g. "member_engagement_involvement_comment")
      const commentKey = `${fullPath}_comment`;
      const commentValue: string = (this.maturityResponse[commentKey] || '').trim();

      // Only store if the comment is non-empty
      if (!commentValue) {
        continue;
      }

      // Build and push the comment item
      newComments.push({
        kpa: item.kpaId,
        questionText: item.question.question,
        selectedScore: selectedValue,
        selectedOptionText,
        text: commentValue
      });
    }

    this.commentList = newComments;
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
