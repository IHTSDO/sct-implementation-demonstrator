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
  @Input() expoMode: boolean = false;

  private chart!: Chart;

  public overallAverage: number = 1;
  public level: string = '';
  public kpaAverages: Record<string, number> = {};
  commentList: any[] = [];

  resultsScale = [
    { value: 1, label: 'Basic' },
    { value: 2, label: 'Emerging' },
    { value: 3, label: 'Advanced' },
    { value: 4, label: 'Integrated' },
    { value: 5, label: 'Optimizing' }
  ]
  

  ngAfterViewInit(): void {
    if (this.maturityResponse && !this.expoMode) {
      this.generateChart();
    }
  }

  ngOnInit(): void {
    this.processComments();
    this.computeKpaAverages();
    this.overallAverage = this.calculateOverallAverage(this.maturityResponse);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.radarCanvas && changes['maturityResponse'] && this.maturityResponse) {
      this.processComments();
      this.computeKpaAverages();
      this.overallAverage = this.calculateOverallAverage(this.maturityResponse);
      if (!this.expoMode) {
        this.generateChart();
      }
    }
  }

  /**
   * Helper function to extract KPA ID from a question path
   * Handles KPA IDs with spaces by using allQuestions array
   */
  private getKpaIdFromPath(questionPath: string): string | null {
    // First, try to find in allQuestions (most reliable)
    const questionItem = this.allQuestions.find(q => q.questionFullPath === questionPath);
    if (questionItem) {
      return questionItem.kpaId;
    }
    
    // Fallback: try to extract from path using selectedKpas keys
    // This handles cases where allQuestions might not be available
    const stakeholder = this.maturityResponse['selectedStakeholder'];
    if (!stakeholder || !questionPath.startsWith(stakeholder + '_')) {
      return null;
    }
    
    const pathAfterStakeholder = questionPath.substring(stakeholder.length + 1);
    const selectedKpas = this.maturityResponse['selectedKpas'] || {};
    const selectedKpaIds = Object.keys(selectedKpas)
      .filter(kpaId => selectedKpas[kpaId]);
    
    // Find the KPA ID that matches the beginning of the path
    for (const kpaId of selectedKpaIds) {
      const kpaPrefix = kpaId + '_';
      if (pathAfterStakeholder.startsWith(kpaPrefix)) {
        return kpaId;
      }
    }
    
    return null;
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
  
      // 2) Check if this key belongs to the selected stakeholder
      const stakeholder = this.maturityResponse['selectedStakeholder'];
      if (!stakeholder || !key.startsWith(stakeholder + '_')) {
        return;
      }
  
      // 3) Extract KPA ID using helper function (handles spaces in KPA IDs)
      const kpaId = this.getKpaIdFromPath(key);
      if (!kpaId || !this.maturityResponse.selectedKpas?.[kpaId]) {
        return; // Skip if KPA not selected
      }
  
      // 4) Accumulate data for this KPA
      groupedData[kpaId] = groupedData[kpaId] || { sum: 0, count: 0 };
      groupedData[kpaId].sum += value;
      groupedData[kpaId].count += 1;
    });
  
    // Extract unique KPA IDs from selectedKpas (most reliable source)
    const kpaIds = Object.keys(this.maturityResponse.selectedKpas || {})
      .filter(kpaId => this.maturityResponse.selectedKpas[kpaId]);
  
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
          const average = dataObj.sum / dataObj.count; // Average (already 0-100 scale)
          // Convert 0-100 scale to 0-5 scale for display
          return Math.round((average / 100) * 5);
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
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              callback: function(value) {
                return value;
              }
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
    // Use selectedKpas as the source of truth (handles KPA IDs with spaces)
    if (response.selectedKpas) {
      return Object.keys(response.selectedKpas)
        .filter(kpaId => response.selectedKpas[kpaId]);
    }
    
    // Fallback: try to extract from allQuestions
    if (this.allQuestions && this.allQuestions.length > 0) {
      const uniqueKpaIds = Array.from(new Set(
        this.allQuestions
          .filter(q => q.stakeholderName && 
            this.getStakeholderName() === q.stakeholderName)
          .map(q => q.kpaId)
      ));
      return uniqueKpaIds.filter(kpaId => response.selectedKpas?.[kpaId]);
    }
    
    // Last resort: try to parse from keys (may fail with spaces in KPA IDs)
    const allKpas = Array.from(
      new Set(
        Object.keys(response)
          .filter((key) => key.startsWith(stakeholder + '_'))
          .map((key) => {
            // Try to find matching KPA ID from allQuestions
            const questionItem = this.allQuestions?.find(q => q.questionFullPath === key);
            return questionItem ? questionItem.kpaId : key.split('_')[1];
          })
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
    return kpa ? kpa.kpaName : '';
  }
  
  
  getQuestions(response: any, stakeholder: string, kpa: string): Record<string, number | null> {
    // Build the prefix for this KPA (handles spaces in KPA ID)
    const kpaPrefix = `${stakeholder}_${kpa}_`;
    
    return Object.keys(response)
      .filter((key) => {
        // Check if key starts with the KPA prefix
        if (!key.startsWith(kpaPrefix)) {
          return false;
        }
        // Also verify it's a numeric value (not a comment or other field)
        const value = response[key];
        return typeof value === 'number' && isFinite(value);
      })
      .reduce((acc, key) => {
        // Extract question ID by removing the prefix
        const questionKey = key.substring(kpaPrefix.length);
        acc[questionKey] = response[key];
        return acc;
      }, {} as Record<string, number | null>);
  }
  
  getStakeholderRowSpan(response: any, stakeholder: string): number {
    const kpas = this.getKpas(response, stakeholder);
    return kpas.reduce((total, kpa) => total + this.getKpaRowSpan(response, stakeholder, kpa), 0);
  }
  
  getKpaRowSpan(response: any, stakeholder: string, kpa: string): number {
    // Build the prefix for this KPA (handles spaces in KPA ID)
    const kpaPrefix = `${stakeholder}_${kpa}_`;
    return Object.keys(response)
      .filter((key) => {
        // Check if key starts with the KPA prefix and is a numeric value
        if (!key.startsWith(kpaPrefix)) {
          return false;
        }
        const value = response[key];
        return typeof value === 'number' && isFinite(value);
      })
      .length;
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
    const stakeholder = this.maturityResponse['selectedStakeholder'];
    // Get all selected KPA IDs (using selectedKpas directly for reliability)
    const selectedKpasObj = this.maturityResponse['selectedKpas'] || {};
    const selectedKpas = Object.keys(selectedKpasObj)
      .filter(kpaId => selectedKpasObj[kpaId]);

    selectedKpas.forEach(kpaId => {
      // 1) Gather the KPA's questions
      const questions = this.getQuestions(this.maturityResponse, stakeholder, kpaId);
      // 2) Compute the average
      this.kpaAverages[kpaId] = this.calculateAverage(questions);
    });
  }
  

  calculateOverallAverage(data: Record<string, any>): number {
    // Object to group values by KPA
    const kpas: { [key: string]: number[] } = {};
    // You might want to exclude any meta keys or other fields you don't want to process
    const excludedKeys = ['selectedStakeholder', 'name', 'author', 'timestamp', 'selectedKpas', 'comment'];
    const stakeholder = data['selectedStakeholder'] || (this.maturityResponse ? this.maturityResponse['selectedStakeholder'] : undefined);
  
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

      // Check if this key belongs to the selected stakeholder
      if (!stakeholder || !key.startsWith(stakeholder + '_')) {
        continue;
      }

      // Extract KPA ID using helper function (handles spaces in KPA IDs)
      const kpaId = this.getKpaIdFromPath(key);
  
      // Make sure the KPA is in the selectedKpas and is set to true
      if (kpaId && data['selectedKpas'] && data['selectedKpas'][kpaId]) {
        if (!kpas[kpaId]) {
          kpas[kpaId] = [];
        }
        kpas[kpaId].push(data[key]);
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

  mapToFiveLevels(value: number): number {
    const clamped = Math.max(0, Math.min(100, value)); // ensure within range
    return Math.min(5, Math.floor(clamped / 25) + 1);
  }

  getScaleLabel(value: number): string {
    // Return "None" if the score is 0.00
    if (value === 0) {
      this.level = 'None';
      return this.level;
    }
    
    // Find the appropriate scale label for the given value based on ranges
    // 0-1: Basic, 1-2: Emerging, 2-3: Advanced, 3-4: Integrated, 4-5: Optimizing
    if (value <= 1) {
      this.level = 'Basic';
    } else if (value <= 2) {
      this.level = 'Emerging';
    } else if (value <= 3) {
      this.level = 'Advanced';
    } else if (value <= 4) {
      this.level = 'Integrated';
    } else {
      this.level = 'Optimizing';
    }
    return this.level;
  }

  getMarkerPosition(value: number): number {
    // Assuming your valid range is 0 through 5
    const min = 0;
    const max = 5;
  
    if (value < min) value = min;
    if (value > max) value = max;
    
    // Convert the 0–5 score to 0–100%
    return ((value - min) / (max - min)) * 100;
  }

  // Convert 0-100 scale to 0-5 scale for display
  convertToFiveScale(value: number): number {
    return Math.round((value / 100) * 5 * 100) / 100; // Round to 2 decimal places
  }

  // Get display value for overall average (0-5 scale)
  getDisplayOverallAverage(): number {
    return this.convertToFiveScale(this.overallAverage);
  }

  // Get display value for KPA average (0-5 scale)
  getDisplayKpaAverage(kpaId: string): number {
    return this.convertToFiveScale(this.kpaAverages[kpaId] || 0);
  }

  // Get color for score level
  getScoreColor(score: number): string {
    if (score === 0) {
      return '#808080'; // Gray for None
    }
    
    // Calculate exact color from gradient interpolation
    // Based on CSS gradient: #c03700 0%, #d47f00 33%, #dfc500 66%, #417505 100%
    const gradientStops = [
      { position: 0, color: '#c03700' },   // Basic (score=1)
      { position: 0.33, color: '#d47f00' }, // Emerging (score=2) 
      { position: 0.66, color: '#dfc500' }, // Advanced (score=3)
      { position: 1, color: '#417505' }     // Integrated/Optimizing (score=4-5)
    ];
    
    // Convert score from 0-5 scale to 0-1 scale for gradient position
    const gradientPosition = Math.min(1, Math.max(0, (score - 1) / 4)); // 1-5 maps to 0-1
    
    return this.interpolateColor(gradientPosition, gradientStops);
  }

  // Interpolate color between gradient stops
  private interpolateColor(position: number, stops: Array<{position: number, color: string}>): string {
    // Find the two stops to interpolate between
    let startStop = stops[0];
    let endStop = stops[stops.length - 1];
    
    for (let i = 0; i < stops.length - 1; i++) {
      if (position >= stops[i].position && position <= stops[i + 1].position) {
        startStop = stops[i];
        endStop = stops[i + 1];
        break;
      }
    }
    
    // Calculate interpolation factor
    const factor = (position - startStop.position) / (endStop.position - startStop.position);
    
    // Parse hex colors to RGB
    const startColor = this.hexToRgb(startStop.color);
    const endColor = this.hexToRgb(endStop.color);
    
    // Interpolate RGB values
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * factor);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * factor);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * factor);
    
    // Convert back to hex
    return this.rgbToHex(r, g, b);
  }

  // Convert hex color to RGB
  private hexToRgb(hex: string): {r: number, g: number, b: number} {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : {r: 0, g: 0, b: 0};
  }

  // Convert RGB to hex color
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
}
