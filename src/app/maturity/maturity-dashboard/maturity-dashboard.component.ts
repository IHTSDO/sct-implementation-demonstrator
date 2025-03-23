import { Component, ElementRef, ViewChild } from '@angular/core';
import { Chart } from 'chart.js';
import * as L from 'leaflet';
import { AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-maturity-dashboard',
  templateUrl: './maturity-dashboard.component.html',
  styleUrl: './maturity-dashboard.component.css',
  standalone: false
})
export class MaturityDashboardComponent  implements AfterViewInit {

  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  uploadedData: any[] = [];
  kpasNames: Record<string, string> = {};

  private totalFilesCount = 0;
  private filesReadCount = 0;

  private chart!: Chart;
  private map!: L.Map;


  constructor() {}

  ngAfterViewInit(): void {
    this.initMap();
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
        const bgColor = this.getScoreColor(score);
        const label = `
          <div style="background-color:${bgColor}; padding: 4px 6px; border-radius: 4px; color: white; font-weight: bold; font-size: 13px;">
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
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  private getScoreColor(score: number): string {
    // Clamp score between 1 and 5
    const clamped = Math.max(1, Math.min(5, score));
  
    // Convert to 0–1 scale
    const t = (clamped - 1) / 4;
  
    // Interpolate from red (255,0,0) to green (0,128,0)
    const r = Math.round(255 * (1 - t));
    const g = Math.round(128 * t);
    const b = 0;
  
    return `rgb(${r},${g},${b})`;
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
          this.processData();
          this.updateMapMarkers();
        }
      }
    };
    // Read the file as a text string
    reader.readAsText(file);
  }

  private processData(): void {
    console.log('Uploaded data:', this.uploadedData);

    for (const maturityResponse of this.uploadedData) {
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
    }

    console.log('KPA Names:', this.kpasNames);
    this.generateChart();
  }

  private generateChart(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  
    const selectedKpas = this.uploadedData[0].selectedKpas || {};
    const kpaIds = Object.keys(selectedKpas).filter(kpaId => selectedKpas[kpaId]);
    const kpaLabels = kpaIds.map(kpaId => this.kpasNames[kpaId] || kpaId);
  
    const colorPalette = [
      { bg: 'rgba(54, 162, 235, 0.3)', border: 'rgba(54, 162, 235, 1)' },
      { bg: 'rgba(255, 99, 132, 0.3)', border: 'rgba(255, 99, 132, 1)' },
      { bg: 'rgba(255, 206, 86, 0.3)', border: 'rgba(255, 206, 86, 1)' },
      { bg: 'rgba(75, 192, 192, 0.3)', border: 'rgba(75, 192, 192, 1)' },
      { bg: 'rgba(153, 102, 255, 0.3)', border: 'rgba(153, 102, 255, 1)' },
      { bg: 'rgba(255, 159, 64, 0.3)', border: 'rgba(255, 159, 64, 1)' },
      { bg: 'rgba(0, 128, 128, 0.3)', border: 'rgba(0, 128, 128, 1)' },
      { bg: 'rgba(128, 0, 128, 0.3)', border: 'rgba(128, 0, 128, 1)' }
    ];
  
    const datasets = this.uploadedData.map((entry, index) => {
      const stakeholderLabel = entry.name || entry.stakeHolderName || 'Unnamed Stakeholder';
  
      const scores = kpaIds.map(kpaId => {
        const score = entry.kpasScores?.[kpaId];
        return typeof score === 'number' ? score : 0;
      });
  
      const color = colorPalette[index % colorPalette.length];
  
      return {
        label: stakeholderLabel,
        data: scores,
        backgroundColor: 'transparent',
        borderColor: color.border,
        pointBackgroundColor: color.border,
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
  
}
