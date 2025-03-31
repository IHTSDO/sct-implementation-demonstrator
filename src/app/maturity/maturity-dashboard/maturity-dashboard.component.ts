import { Component, ElementRef, ViewChild } from '@angular/core';
import { Chart } from 'chart.js';

import * as L from 'leaflet';
import { AfterViewInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';

@Component({
  selector: 'app-maturity-dashboard',
  templateUrl: './maturity-dashboard.component.html',
  styleUrl: './maturity-dashboard.component.css',
  standalone: false
})
export class MaturityDashboardComponent  implements AfterViewInit {

  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overallScoreCanvas') overallScoreCanvas!: ElementRef<HTMLCanvasElement>;

  uploadedData: any[] = [];
  kpasNames: Record<string, string> = {};

  private totalFilesCount = 0;
  private filesReadCount = 0;
  opened = false;
  overallScore = 0;
  level = '';
  markers: any = { 
    "1": { color: "#555", type: "triangle", size: 8, label: "Basic", font: "12px arial" },
    "2": { color: "#555", type: "triangle", size: 8, label: "Emerging", font: "12px arial" },
    "3": { color: "#555", type: "triangle", size: 8, label: "Advanced", font: "12px arial" },
    "4": { color: "#555", type: "triangle", size: 8, label: "Integrated", font: "12px arial" },
    "5": { color: "#555", type: "triangle", size: 8, label: "Optimizing", font: "12px arial" }  
  };

  private chart!: Chart;
  private overallScoreChart!: Chart;
  private map!: L.Map;

  colorPalette = [
    { bg: 'rgba(22, 160, 133, 0.3)', border: 'rgba(22, 160, 133, 1)' },  // Teal
    { bg: 'rgba(142, 68, 173, 0.3)', border: 'rgba(142, 68, 173, 1)' },  // Purple
    { bg: 'rgba(230, 126, 34, 0.3)', border: 'rgba(230, 126, 34, 1)' },  // Orange
    { bg: 'rgba(192, 57, 43, 0.3)', border: 'rgba(192, 57, 43, 1)' },    // Dark Red
    { bg: 'rgba(41, 128, 185, 0.3)', border: 'rgba(41, 128, 185, 1)' },  // Strong Blue
    { bg: 'rgba(39, 174, 96, 0.3)', border: 'rgba(39, 174, 96, 1)' },    // Emerald Green
    { bg: 'rgba(127, 140, 141, 0.3)', border: 'rgba(127, 140, 141, 1)' },// Gray
    { bg: 'rgba(44, 62, 80, 0.3)', border: 'rgba(44, 62, 80, 1)' },      // Dark Blue Gray
  ];
  

  constructor(private _snackBar: MatSnackBar) {}

  ngAfterViewInit(): void {
    this.initMap();
  }

  reset(): void {
    // reload page
    window.location.reload();
  }

  loadExamples(): void {
    const exampleFiles = [
      'assets/maturity/dashboard-examples/maturity-assessment-results (9).json',
      'assets/maturity/dashboard-examples/maturity-assessment-results (10).json',
      'assets/maturity/dashboard-examples/maturity-assessment-results (11).json'
    ];
    this.uploadedData = [];
    this.kpasNames = {};
    this.totalFilesCount = exampleFiles.length;
    this.filesReadCount = 0;
    for (const file of exampleFiles) {
      this.readJSONFileFromUrl(file);
    }
  }

  readJSONFileFromUrl(fileUrl: string): void {
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error fetching file: ${response.statusText}`);
        }
        return response.json();
      })
      .then(jsonContent => {
        this.uploadedData.push(jsonContent);
        this.filesReadCount++;
        if (this.filesReadCount === this.totalFilesCount) {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: `${this.totalFilesCount} assessment files have been imported`,
            panelClass: ['red-snackbar']
          });
          this.verifyFiles();
          this.processData();
        }
      })
      .catch(error => {
        console.error('Error parsing JSON file:', fileUrl, error);
      });
  }

  private initMap(): void {
    this.map = L.map('map').setView([20, 0], 2); // Default view

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  private updateMapMarkers(): void {
    if (!this.map) return;
  
    const iconRetinaUrl = 'assets/leaflet/marker-icon-2x.png';
    const iconUrl = 'assets/leaflet/marker-icon.png';
    const shadowUrl = 'assets/leaflet/marker-shadow.png';
  
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  
    const bounds = L.latLngBounds([]);
  
    this.uploadedData.forEach(entry => {
      const location = entry.location || entry.responses?.location;
      if (location && typeof location.y === 'number' && typeof location.x === 'number') {
        const score = entry.overallScore ?? 0;
        const scoreColor = this.getScoreColor(score);
        const label = `
          <div style="background-color:${entry.color.border}; padding: 4px 6px; border-radius: 4px; color: white; font-weight: bold; font-size: 13px;">
            ${entry.name || entry.stakeHolderName || 'Unnamed'}: ${score.toFixed(1)}<br/>
            <span style="font-weight: normal;">Maturity level: ${entry.level ?? ''}</span>
          </div>
        `;
        L.marker([location.y, location.x])
          .addTo(this.map)
          .bindTooltip(label, {
            permanent: true,
            direction: 'top',
            offset: [0, -50],
            className: 'map-label' // Optional: custom class for styling
        });
  
        bounds.extend([location.y, location.x]);
      }
    });
  
    if (bounds.isValid()) {
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();
    
      // Expand the top (north) by e.g. +0.2 degrees
      const expandedBounds = L.latLngBounds(
        [southWest.lat, southWest.lng],
        [northEast.lat + 0.4, northEast.lng]
      );
    
      this.map.fitBounds(expandedBounds, {
        padding: [20, 20]
      });
    }
    
  }

  getScoreColor(score: number): string {
    const clamped = Math.max(1, Math.min(5, score));
    
    // Factor for darkening each color channel.
    const darkenFactor = 0.7; // Adjust as desired (0.7, 0.9, etc.)
  
    if (clamped <= 3) {
      // Interpolate [1..3] from Red (255,0,0) → Yellow (255,255,0)
      const t = (clamped - 1) / 2;
      let r = 255;                     // stays 255
      let g = Math.round(255 * t);     // 0 → 255
      let b = 0;
  
      // Darken each channel
      r = Math.round(r * darkenFactor);
      g = Math.round(g * darkenFactor);
      b = Math.round(b * darkenFactor);
  
      return `rgb(${r},${g},${b})`;
    } else {
      // Interpolate [3..5] from Yellow (255,255,0) → Green (0,128,0)
      const t = (clamped - 3) / 2;
      let r = Math.round(255 * (1 - t));          // 255 → 0
      let g = Math.round(255 + (128 - 255) * t);  // 255 → 128
      let b = 0;
  
      // Darken each channel
      r = Math.round(r * darkenFactor);
      g = Math.round(g * darkenFactor);
      b = Math.round(b * darkenFactor);
  
      return `rgb(${r},${g},${b})`;
    }
  }

  onFilesSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement.files?.length) {
      return; // No files selected
    }

    this.uploadedData = [];
    this.kpasNames = {};

    const files = Array.from(inputElement.files);
    this.totalFilesCount = files.length;
    this.filesReadCount = 0;
    for (const file of files) {
      this.readJSONFile(file);
    }
  }

  private readJSONFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // Convert the file content from text to JSON
        const jsonContent = JSON.parse(reader.result as string);
        // You can store it for later use (for example, building charts or metrics)
        this.uploadedData.push(jsonContent);
      } catch (error) {
        console.error('Error parsing JSON file:', file.name, error);
      } finally {
        // Once this file is read, increment the counter
        this.filesReadCount++;

        // If all files are loaded, then process the data
        if (this.filesReadCount === this.totalFilesCount) {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: `${this.totalFilesCount} assessment files have been imported`,
            panelClass: ['red-snackbar']
          });
          this.verifyFiles();
          this.processData();
        }
      }
    };
    // Read the file as a text string
    reader.readAsText(file);
  }

  private verifyFiles(): void {
    this.uploadedData.forEach((entry, index) => {
      if (!entry.overallScore || !entry.kpasScores || !entry.level || !entry.name) {
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: `File number ${index} is not a valid assessment results file`,
          panelClass: ['red-snackbar']
        });
        // remove this entry form array
        this.uploadedData.splice(index, 1);
      } else if (!entry.location?.label) {
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: `File number ${index} does not include location information`,
          panelClass: ['red-snackbar']
        });
      }
    });
  }
  private processData(): void {
    this.uploadedData.forEach((maturityResponse, index) => {
      if (maturityResponse.allQuestions && Array.isArray(maturityResponse.allQuestions)) {
        if (!maturityResponse.stakeHolderName && maturityResponse.allQuestions.length > 0) {
          maturityResponse.stakeHolderName = maturityResponse.allQuestions[0].stakeholderName || '';
        }

        maturityResponse.allQuestions.forEach((questionObj: any) => {
          const { kpaId, kpaName } = questionObj;
          if (kpaId && kpaName) {
            this.kpasNames[kpaId] = kpaName;
          }
        });
      }
      const color = this.colorPalette[index % this.colorPalette.length];
      maturityResponse.color = color;
    });
    console.log('Processed data:', this.uploadedData);
    this.generateRadarChart();
    this.generateOverallBarChart();
    // Set this.overallScore to the vaerage of all overall scores
    const overallScores = this.uploadedData.map(entry => entry.overallScore || 0);
    const sum = overallScores.reduce((acc, val) => acc + val, 0);
    this.overallScore = overallScores.length > 0 ? sum / overallScores.length : 0;
    this.overallScore = Math.round(this.overallScore * 10) / 10;
    this.updateMapMarkers();
    this.setScaleLabel(this.overallScore);
  }

  private generateRadarChart(): void {
    if (this.chart) {
      this.chart.destroy();
    }

    if (this.uploadedData.length === 0) {
      return;
    }
  
    const selectedKpas = this.uploadedData[0].selectedKpas || {};
    const kpaIds = Object.keys(selectedKpas).filter(kpaId => selectedKpas[kpaId]);
    const kpaLabels = kpaIds.map(kpaId => this.kpasNames[kpaId] || kpaId);
  
    const datasets = this.uploadedData.map((entry, index) => {
      const stakeholderLabel = entry.name || entry.stakeHolderName || 'Unnamed Stakeholder';
  
      const scores = kpaIds.map(kpaId => {
        const score = entry.kpasScores?.[kpaId];
        return typeof score === 'number' ? score : 0;
      });
  
      // const color = this.colorPalette[index % this.colorPalette.length];
  
      return {
        label: stakeholderLabel,
        data: scores,
        backgroundColor: 'transparent',
        borderColor: entry.color.border,
        pointBackgroundColor: entry.color.border,
        pointBorderColor: '#fff'
      };
    });
  
    // ➕ Compute average for each KPA
    const averageScores = kpaIds.map(kpaId => {
      const validScores = this.uploadedData
        .map(entry => entry.kpasScores?.[kpaId])
        .filter(score => typeof score === 'number');
  
      const sum = validScores.reduce((acc, val) => acc + val, 0);
      return validScores.length > 0 ? sum / validScores.length : 0;
    });
  
    datasets.unshift({
      label: 'Average (All Stakeholders)',
      data: averageScores,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      borderColor: 'rgba(0, 0, 0, 0.8)',
      pointBackgroundColor: 'rgba(0, 0, 0, 0.8)',
      pointBorderColor: '#fff',
      borderDash: [5, 5]
    }  as any);
  
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
            position: 'top'
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

  private generateOverallBarChart(): void {
    if (this.overallScoreChart) {
      this.overallScoreChart.destroy();
    }
  
    if (this.uploadedData.length === 0) {
      return;
    }
  
    const labels = this.uploadedData.map(entry =>
      entry.name || entry.stakeHolderName || 'Unnamed Stakeholder'
    );
  
    const scores = this.uploadedData.map(entry =>
      typeof entry.overallScore === 'number' ? entry.overallScore : 0
    );
  
    const colors = this.uploadedData.map(entry => entry.color?.border || 'rgba(0,0,0,0.8)');
  
    this.overallScoreChart = new Chart(this.overallScoreCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Overall Average Score',
            data: scores,
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        aspectRatio: 2.0,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Overall Maturity Score by Stakeholder'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 5,
            title: {
              display: true,
              text: 'Overall Score'
            },
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  setScaleLabel(value: number): void {
    const resultsScale = [
      { value: 1, label: 'Basic' },
      { value: 2, label: 'Emerging' },
      { value: 3, label: 'Advanced' },
      { value: 4, label: 'Integrated' },
      { value: 5, label: 'Optimizing' }
    ]
    // round to the lowest whole number
    value = Math.floor(value);
    this.level = resultsScale.find((scale) => scale.value === value)?.label || '';
  }
  
  
}
