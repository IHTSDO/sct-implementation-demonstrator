import { Component, ElementRef, ViewChild, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Chart } from 'chart.js';

import * as L from 'leaflet';
import { AfterViewInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { get } from 'lodash';
import { FirebaseService, MaturityAssessmentResult } from 'src/app/services/firebase.service';
import { ActivatedRoute } from '@angular/router';
import { Unsubscribe } from 'firebase/firestore';

@Component({
  selector: 'app-maturity-dashboard',
  templateUrl: './maturity-dashboard.component.html',
  styleUrl: './maturity-dashboard.component.css',
  standalone: false
})
export class MaturityDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overallScoreCanvas') overallScoreCanvas!: ElementRef<HTMLCanvasElement>;

  uploadedData: any[] = [];
  kpasNames: Record<string, string> = {};

  private totalFilesCount = 0;
  private filesReadCount = 0;
  opened = false;
  overallScore = 0;
  level = '';
  expoMode: boolean = false;
  loadingFirebaseData: boolean = false;
  private initialDocumentIds: Set<string> = new Set();
  
  // Cycling callouts properties
  private calloutCycleTimer: any;
  private currentCalloutIndex: number = 0;
  private mapMarkers: L.Marker[] = [];
  
  // Real-time listener properties
  private firebaseUnsubscribe: Unsubscribe | null = null;
  private markerDataMap: Map<string, { marker: L.Marker, data: any }> = new Map();
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
  private mapOverlay: any;

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
  

  constructor(
    private _snackBar: MatSnackBar,
    private firebaseService: FirebaseService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Check for Expo mode from route parameters synchronously
    const params = this.route.snapshot.queryParams;
    if (params['expo']) {
      this.expoMode = true;
      // Use setTimeout to ensure the change happens after the current change detection cycle
      setTimeout(() => {
        this.loadFirebaseData();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    // Clean up timer and markers when component is destroyed
    this.clearCalloutTimer();
    this.clearMapMarkers();
    this.clearRealtimeListener();
    this.removeMapOverlay();
  }

  ngAfterViewInit(): void {
    // this.initMap();
  }

  reset(): void {
    if (this.expoMode) {
      // In Expo mode, just reload Firebase data instead of full page reload
      this.uploadedData = [];
      this.kpasNames = {};
      this.overallScore = 0;
      this.level = '';
      this.loadFirebaseData();
    } else {
      // In regular mode, reload the page
      window.location.reload();
    }
  }

  /**
   * Load Expo 2025 assessment data from Firebase
   */
  async loadFirebaseData(): Promise<void> {
    this.loadingFirebaseData = true;
    
    try {
      const firebaseAssessments = await this.firebaseService.getMaturityAssessmentResults('Expo 2025');
      
      if (firebaseAssessments.length === 0) {
        this.loadingFirebaseData = false;
        return;
      }

      // Track document IDs from initial load to prevent real-time notifications for existing data
      this.initialDocumentIds.clear();
      firebaseAssessments.forEach(assessment => {
        if (assessment['id']) {
          this.initialDocumentIds.add(assessment['id']);
        }
      });

      // Convert Firebase data to the format expected by the dashboard
      this.uploadedData = firebaseAssessments.map(assessment => this.convertFirebaseToLocalFormat(assessment));
      
      this.verifyFiles();
      this.processData();
      
      // Set up real-time listener for future changes
      this.setupRealtimeListener();
      
    } catch (error) {
      console.error('❌ Error loading Firebase data:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5 * 1000,
        data: `Error loading Expo 2025 data from Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
        panelClass: ['red-snackbar']
      });
    } finally {
      this.loadingFirebaseData = false;
    }
  }

  /**
   * Convert Firebase assessment data to the format expected by the dashboard
   */
  private convertFirebaseToLocalFormat(firebaseAssessment: MaturityAssessmentResult, docId?: string): any {
    try {
      // Create mock allQuestions array for compatibility
      const allQuestions = this.createMockAllQuestions(firebaseAssessment);
      
      const convertedData = {
        // Basic assessment info
        selectedStakeholder: firebaseAssessment.selectedStakeholder,
        selectedKpas: firebaseAssessment.selectedKpas,
        name: firebaseAssessment.name,
        author: firebaseAssessment.author,
        timestamp: firebaseAssessment.timestamp,
        systemName: firebaseAssessment.systemName,
        location: firebaseAssessment.location,
        level: firebaseAssessment.level,
        
        // Use normalized scores (0-5 scale) for display
        overallScore: firebaseAssessment.overallScoreNormalized || 0,
        kpasScores: firebaseAssessment.kpasScoresNormalized || {},
        
        // Mock data for compatibility
        allQuestions: allQuestions,
        stakeHolderName: this.getStakeholderDisplayName(firebaseAssessment.selectedStakeholder),
        
        // Include raw responses for compatibility (if available)
        responses: this.extractResponsesFromFirebase(firebaseAssessment),
        
        // Add color for marker styling
        color: this.getColorForStakeholder(firebaseAssessment.selectedStakeholder),
        
        // Add docId for tracking
        docId: docId
      };
      
      return convertedData;
    } catch (error) {
      console.error('❌ Error converting Firebase assessment:', error);
      throw error;
    }
  }

  /**
   * Create mock allQuestions array for compatibility with existing dashboard logic
   */
  private createMockAllQuestions(assessment: MaturityAssessmentResult): any[] {
    const questions: any[] = [];
    
    // Get selected KPAs
    const selectedKpas = Object.keys(assessment.selectedKpas).filter(kpaId => assessment.selectedKpas[kpaId]);
    
    selectedKpas.forEach(kpaId => {
      questions.push({
        stakeholderName: this.getStakeholderDisplayName(assessment.selectedStakeholder),
        kpaName: this.getKpaDisplayName(kpaId),
        kpaId: kpaId,
        question: {
          name: `${kpaId} Question`,
          id: `${kpaId}_question`,
          question: `Assessment for ${kpaId}`,
          options: []
        },
        questionFullPath: `${assessment.selectedStakeholder}_${kpaId}_question`
      });
    });
    
    return questions;
  }

  /**
   * Get display name for stakeholder type
   */
  private getStakeholderDisplayName(stakeholderId: string): string {
    const stakeholderNames: Record<string, string> = {
      'vendor': 'Vendor',
      'user': 'User Organization',
      'member': 'Member Organization'
    };
    return stakeholderNames[stakeholderId] || stakeholderId;
  }

  /**
   * Get display name for KPA
   */
  private getKpaDisplayName(kpaId: string): string {
    const kpaNames: Record<string, string> = {
      'scope': 'Scope of SNOMED CT Implementation',
      'governance': 'Governance and Strategy',
      'training': 'User Proficiency and Training',
      'interoperability': 'Interoperability',
      'analytics': 'Analytics and Decision Support',
      'adoption': 'Adoption and Engagement',
      'extension': 'Extension and Customization'
    };
    return kpaNames[kpaId] || kpaId;
  }

  /**
   * Extract question responses from Firebase data for compatibility
   */
  private extractResponsesFromFirebase(assessment: MaturityAssessmentResult): Record<string, any> {
    const responses: Record<string, any> = {
      selectedStakeholder: assessment.selectedStakeholder,
      selectedKpas: assessment.selectedKpas,
      name: assessment.name,
      author: assessment.author,
      timestamp: assessment.timestamp,
      systemName: assessment.systemName,
      location: assessment.location
    };

    // Add any question responses that might be stored in the Firebase document
    Object.keys(assessment).forEach(key => {
      if (key.includes('_') && !['selectedStakeholder', 'selectedKpas', 'name', 'author', 'timestamp', 'systemName', 'location', 'overallScore', 'kpasScores', 'overallScoreNormalized', 'kpasScoresNormalized', 'level', 'eventName', 'createdAt'].includes(key)) {
        responses[key] = (assessment as any)[key];
      }
    });

    return responses;
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
    // Check if map container exists in DOM
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      return;
    }

    // Check if map is already initialized
    if (this.map) {
      return;
    }
    
    // Set different initial views based on mode
    if (this.expoMode) {
      // For Expo mode, start with a world view
      this.map = L.map('map').setView([20, 0], 2);
    } else {
      // For regular mode, use default view
      this.map = L.map('map').setView([20, 0], 2);
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    
    // For Expo mode, add overlay and trigger a resize after a short delay to ensure proper rendering
    if (this.expoMode) {
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          this.createMapOverlay();
        }
      }, 300);
    }
  }

  private createMapOverlay(): void {
    if (!this.map) return;

    // Check if map container is ready
    const mapContainer = this.map.getContainer();
    if (!mapContainer) return;

    // Remove existing overlay if it exists
    this.removeMapOverlay();

    // Create overlay div directly in the map container
    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'map-overlay';
    overlayDiv.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid #333;
      border-radius: 8px;
      padding: 15px 20px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      font-family: Arial, sans-serif;
      min-width: 400px;
      text-align: center;
      z-index: 1000;
    `;
    
    overlayDiv.innerHTML = `
      <h2 style="margin: 0 0 8px 0; color: #333; font-size: 18px; font-weight: bold;">
        Maturity Assessment Framework Demo
      </h2>
      <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; font-style: italic;">
        Try the assessment tool and place your organization or tool in the map!
      </p>
      <p style="margin: 0; color: #666; font-size: 14px; font-weight: bold;">
        ${this.uploadedData.length} assessments loaded
      </p>
    `;

    // Add to map container
    mapContainer.appendChild(overlayDiv);
    
    // Store reference for later removal
    (this.mapOverlay as any) = overlayDiv;
  }

  private removeMapOverlay(): void {
    if (this.mapOverlay) {
      if (this.map && this.map.getContainer()) {
        const mapContainer = this.map.getContainer();
        const overlayElement = this.mapOverlay as any;
        if (overlayElement && overlayElement.parentNode) {
          overlayElement.parentNode.removeChild(overlayElement);
        }
      }
      this.mapOverlay = null;
    }
  }

  private updateMapOverlay(): void {
    if (!this.expoMode) return;

    // Remove and recreate the overlay to update the count
    this.createMapOverlay();
  }

  private updateMapMarkers(): void {
    if (!this.map) {
      return;
    }
  
    // Clear existing markers and timer
    this.clearMapMarkers();
    this.clearCalloutTimer();
  
    const bounds = L.latLngBounds([]);
    let markersAdded = 0;
  
    this.uploadedData.forEach((entry, index) => {
      const location = entry.location || entry.responses?.location;
      
      if (location && typeof location.y === 'number' && typeof location.x === 'number') {
        const score = entry.overallScore ?? 0;
        const scoreColor = this.getScoreColor(score);
        
        // Get stakeholder type and location for display
        const stakeholderType = this.getStakeholderDisplayName(entry.stakeHolderName || '');
        const shortLocation = this.getShortLocationName(location);
        const locationText = shortLocation ? ` - ${shortLocation}` : '';
        
        // Use stakeholder colors in expo mode for better contrast with white text
        const calloutColor = this.expoMode ? 
          this.getColorForStakeholder(entry.selectedStakeholder || entry.responses?.selectedStakeholder).border : 
          entry.color.border;
          
        const label = `
          <div style="background-color:${calloutColor}; padding: 4px 6px; border-radius: 4px; color: white; font-weight: bold; font-size: 13px;">
            ${entry.name || entry.stakeHolderName || 'Unnamed'}: ${score.toFixed(1)}<br/>
            <span style="font-weight: normal; font-size: 11px; opacity: 0.9;">${stakeholderType}${locationText}</span><br/>
            <span style="font-weight: normal;">Maturity level: ${entry.level ?? ''}</span>
          </div>
        `;
        
        // Create marker with custom color in expo mode
        let marker: L.Marker;
        if (this.expoMode) {
          const markerIcon = this.createColoredMarkerIcon(calloutColor);
          marker = L.marker([location.y, location.x], { icon: markerIcon }).addTo(this.map);
        } else {
          // Use default marker in regular mode
          const iconRetinaUrl = 'assets/leaflet/marker-icon-2x.png';
          const iconUrl = 'assets/leaflet/marker-icon.png';
          const shadowUrl = 'assets/leaflet/marker-shadow.png';
          
          const defaultIcon = L.icon({
            iconRetinaUrl,
            iconUrl,
            shadowUrl,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          
          marker = L.marker([location.y, location.x], { icon: defaultIcon }).addTo(this.map);
        }
        
        // Store marker for cycling callouts
        this.mapMarkers.push(marker);
        
        // In Expo mode, don't show tooltips permanently - we'll cycle through them
        if (!this.expoMode) {
          marker.bindTooltip(label, {
            permanent: true,
            direction: 'top',
            offset: [0, -50],
            className: 'map-label'
          });
        } else {
          // In Expo mode, bind tooltip but don't show it yet
          marker.bindTooltip(label, {
            permanent: false,
            direction: 'top',
            offset: [0, -50],
            className: 'map-label'
          });
        }
  
        bounds.extend([location.y, location.x]);
        markersAdded++;
      }
    });
    
    // Start cycling callouts in Expo mode
    if (this.expoMode && this.mapMarkers.length > 0) {
      this.startCalloutCycling();
    }
    
    // Fit map to show all markers
    this.fitMapToMarkers();
  }

  private clearMapMarkers(): void {
    this.mapMarkers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.mapMarkers = [];
  }

  private clearCalloutTimer(): void {
    if (this.calloutCycleTimer) {
      clearInterval(this.calloutCycleTimer);
      this.calloutCycleTimer = null;
    }
  }

  private startCalloutCycling(): void {
    if (this.mapMarkers.length === 0) return;
    
    // Start with the first callout
    this.currentCalloutIndex = 0;
    this.showCurrentCallout();
    
    // Set up the cycling timer
    this.calloutCycleTimer = setInterval(() => {
      this.hideCurrentCallout();
      this.currentCalloutIndex = (this.currentCalloutIndex + 1) % this.mapMarkers.length;
      this.showCurrentCallout();
    }, 2000); // 2 seconds per callout
  }

  private showCurrentCallout(): void {
    if (this.mapMarkers[this.currentCalloutIndex]) {
      this.mapMarkers[this.currentCalloutIndex].openTooltip();
    }
  }

  private hideCurrentCallout(): void {
    if (this.mapMarkers[this.currentCalloutIndex]) {
      this.mapMarkers[this.currentCalloutIndex].closeTooltip();
    }
  }

  private getShortLocationName(location: any): string {
    if (!location) return '';
    
    // Try to get city first, then country
    if (location.placeName) {
      return location.placeName;
    }
    
    if (location.country) {
      return location.country;
    }
    
    // Fallback to parsing the label
    if (location.label) {
      const parts = location.label.split(',');
      if (parts.length > 0) {
        return parts[0].trim(); // First part is usually the city
      }
    }
    
    return '';
  }

  private getColorForStakeholder(stakeholderType: string): any {
    // Define colors for different stakeholder types with good contrast for white text
    const stakeholderColors: Record<string, any> = {
      'vendor': { border: '#1565c0', background: '#e3f2fd' },   // Deep Blue - excellent contrast
      'user': { border: '#2e7d32', background: '#e8f5e8' },     // Deep Green - excellent contrast  
      'member': { border: '#d84315', background: '#fff3e0' }    // Deep Orange-Red - excellent contrast
    };
    
    return stakeholderColors[stakeholderType] || { border: '#424242', background: '#f5f5f5' }; // Default dark gray
  }

  private createColoredMarkerIcon(color: string): L.Icon {
    // Create a custom colored marker using SVG
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 7.2 12.5 28.5 12.5 28.5s12.5-21.3 12.5-28.5C25 5.6 19.4 0 12.5 0z" 
              fill="${color}" stroke="#fff" stroke-width="1"/>
        <circle cx="12.5" cy="12.5" r="6" fill="#fff"/>
      </svg>
    `;
    
    const iconUrl = 'data:image/svg+xml;base64,' + btoa(svgIcon);
    
    return L.icon({
      iconUrl: iconUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'assets/leaflet/marker-shadow.png',
      shadowSize: [41, 41]
    });
  }

  private setupRealtimeListener(): void {
    // Clear any existing listener
    this.clearRealtimeListener();
    
    this.firebaseUnsubscribe = this.firebaseService.subscribeToMaturityAssessmentResults(
      'Expo 2025',
      (changes) => {
        this.handleRealtimeChanges(changes);
      }
    );
  }

  private clearRealtimeListener(): void {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
  }

  private handleRealtimeChanges(changes: { type: 'added' | 'removed' | 'modified', data: MaturityAssessmentResult, docId: string }[]): void {
    changes.forEach(change => {
      // Skip changes for documents that were loaded during initial load
      if (this.initialDocumentIds.has(change.docId)) {
        return;
      }

      switch (change.type) {
        case 'added':
          this.handleAssessmentAdded(change.data, change.docId);
          break;
        case 'removed':
          this.handleAssessmentRemoved(change.docId);
          break;
        case 'modified':
          this.handleAssessmentModified(change.data, change.docId);
          break;
      }
    });
  }

  private handleAssessmentAdded(assessment: MaturityAssessmentResult, docId: string): void {
    
    // Convert to local format
    const convertedData = this.convertFirebaseToLocalFormat(assessment, docId);
    
    // Add to uploadedData
    this.uploadedData.unshift(convertedData); // Add to beginning (newest first)
    
    // Add marker to map
    this.addSingleMarker(convertedData, docId);
    
    // Update cycling system
    this.updateCalloutCycling();
    
    // Update overlay count
    this.updateMapOverlay();
    
    // Show notification
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 3000,
      data: `New assessment added: ${convertedData.name}`,
      panelClass: ['green-snackbar']
    });
  }

  private handleAssessmentRemoved(docId: string): void {
    
    // Remove from uploadedData
    const index = this.uploadedData.findIndex(item => item.docId === docId);
    if (index !== -1) {
      this.uploadedData.splice(index, 1);
    }
    
    // Remove marker from map
    this.removeSingleMarker(docId);
    
    // Update cycling system
    this.updateCalloutCycling();
    
    // Update overlay count
    this.updateMapOverlay();
    
    // Show notification
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 3000,
      data: 'Assessment removed from map',
      panelClass: ['orange-snackbar']
    });
  }

  private handleAssessmentModified(assessment: MaturityAssessmentResult, docId: string): void {
    
    // Convert to local format
    const convertedData = this.convertFirebaseToLocalFormat(assessment, docId);
    
    // Update in uploadedData
    const index = this.uploadedData.findIndex(item => item.docId === docId);
    if (index !== -1) {
      this.uploadedData[index] = convertedData;
    }
    
    // Update marker on map
    this.updateSingleMarker(convertedData, docId);
    
    // Show notification
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 3000,
      data: `Assessment updated: ${convertedData.name}`,
      panelClass: ['blue-snackbar']
    });
  }

  private addSingleMarker(data: any, docId: string): void {
    if (!this.map) return;
    
    const location = data.location || data.responses?.location;
    if (!location || typeof location.y !== 'number' || typeof location.x !== 'number') {
      return;
    }
    
    const score = data.overallScore ?? 0;
    const stakeholderType = this.getStakeholderDisplayName(data.stakeHolderName || '');
    const shortLocation = this.getShortLocationName(location);
    const locationText = shortLocation ? ` - ${shortLocation}` : '';
    
    // Use stakeholder colors in expo mode for better contrast with white text
    const calloutColor = this.expoMode ? 
      this.getColorForStakeholder(data.selectedStakeholder || data.responses?.selectedStakeholder).border : 
      data.color.border;
      
    const label = `
      <div style="background-color:${calloutColor}; padding: 4px 6px; border-radius: 4px; color: white; font-weight: bold; font-size: 13px;">
        ${data.name || data.stakeHolderName || 'Unnamed'}: ${score.toFixed(1)}<br/>
        <span style="font-weight: normal; font-size: 11px; opacity: 0.9;">${stakeholderType}${locationText}</span><br/>
        <span style="font-weight: normal;">Maturity level: ${data.level ?? ''}</span>
      </div>
    `;
    
    // Create marker with custom color in expo mode
    let marker: L.Marker;
    if (this.expoMode) {
      const markerIcon = this.createColoredMarkerIcon(calloutColor);
      marker = L.marker([location.y, location.x], { icon: markerIcon }).addTo(this.map);
    } else {
      // Use default marker in regular mode
      const iconRetinaUrl = 'assets/leaflet/marker-icon-2x.png';
      const iconUrl = 'assets/leaflet/marker-icon.png';
      const shadowUrl = 'assets/leaflet/marker-shadow.png';
      
      const defaultIcon = L.icon({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      
      marker = L.marker([location.y, location.x], { icon: defaultIcon }).addTo(this.map);
    }
    
    // Store marker with docId for tracking
    data.docId = docId;
    this.markerDataMap.set(docId, { marker, data });
    
    // Add new marker to the beginning so it gets visited sooner
    this.mapMarkers.unshift(marker);
    
    // Adjust current index if we're in the middle of cycling
    if (this.calloutCycleTimer && this.currentCalloutIndex >= 0) {
      this.currentCalloutIndex++; // Shift index because we added to the beginning
    }
    
    // Bind tooltip
    if (!this.expoMode) {
      marker.bindTooltip(label, {
        permanent: true,
        direction: 'top',
        offset: [0, -50],
        className: 'map-label'
      });
    } else {
      marker.bindTooltip(label, {
        permanent: false,
        direction: 'top',
        offset: [0, -50],
        className: 'map-label'
      });
    }
  }

  private removeSingleMarker(docId: string): void {
    const markerData = this.markerDataMap.get(docId);
    if (!markerData) return;
    
    // Remove from map
    if (this.map) {
      this.map.removeLayer(markerData.marker);
    }
    
    // Remove from arrays
    const markerIndex = this.mapMarkers.indexOf(markerData.marker);
    if (markerIndex !== -1) {
      this.mapMarkers.splice(markerIndex, 1);
      
      // Adjust current index if we're in the middle of cycling
      if (this.calloutCycleTimer && this.currentCalloutIndex >= 0) {
        if (markerIndex < this.currentCalloutIndex) {
          // Removed marker was before current position, shift index down
          this.currentCalloutIndex--;
        } else if (markerIndex === this.currentCalloutIndex) {
          // Removed marker was the current one, stay at same index (next marker)
          if (this.currentCalloutIndex >= this.mapMarkers.length) {
            this.currentCalloutIndex = 0; // Wrap to beginning if needed
          }
        }
        // If markerIndex > currentCalloutIndex, no adjustment needed
      }
    }
    
    // Remove from tracking map
    this.markerDataMap.delete(docId);
  }

  private updateSingleMarker(data: any, docId: string): void {
    const markerData = this.markerDataMap.get(docId);
    if (!markerData) return;
    
    // Remove old marker
    this.removeSingleMarker(docId);
    
    // Add updated marker
    this.addSingleMarker(data, docId);
  }

  private updateCalloutCycling(): void {
    if (!this.expoMode) return;
    
    // If no markers, stop cycling
    if (this.mapMarkers.length === 0) {
      this.clearCalloutTimer();
      return;
    }
    
    // If cycling is not active, start it
    if (!this.calloutCycleTimer) {
      this.startCalloutCycling();
      return;
    }
    
    // If we're cycling and have markers, adjust the current index if needed
    if (this.currentCalloutIndex >= this.mapMarkers.length) {
      this.currentCalloutIndex = 0;
    }
    
    // Continue cycling with the current timer - don't restart
  }

  private fitMapToMarkers(): void {
    if (!this.map || this.mapMarkers.length === 0) return;
    
    const bounds = L.latLngBounds([]);
    this.mapMarkers.forEach(marker => {
      bounds.extend(marker.getLatLng());
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
    
    // Use setTimeout to ensure DOM is ready before initializing map
    setTimeout(() => {
      this.initMap();
      
      // Only generate charts in regular mode (not in Expo mode)
      if (!this.expoMode) {
        this.generateRadarChart();
        this.generateOverallBarChart();
      }
      
      // Set this.overallScore to the average of all overall scores
      const overallScores = this.uploadedData.map(entry => entry.overallScore || 0);
      const sum = overallScores.reduce((acc, val) => acc + val, 0);
      this.overallScore = overallScores.length > 0 ? sum / overallScores.length : 0;
      this.overallScore = Math.round(this.overallScore * 10) / 10;
      
      this.updateMapMarkers();
      
      // Only set scale label in regular mode
      if (!this.expoMode) {
        this.setScaleLabel(this.overallScore);
      }
    }, 100); // Small delay to ensure DOM is ready
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

  getScaleLabel(value: number): string {
    const resultsScale = [
      { value: 1, label: 'Basic' },
      { value: 2, label: 'Emerging' },
      { value: 3, label: 'Advanced' },
      { value: 4, label: 'Integrated' },
      { value: 5, label: 'Optimizing' }
    ]
    // round to the lowest whole number
    value = Math.floor(value);
    return resultsScale.find((scale) => scale.value === value)?.label || '';
  }

  setScaleLabel(value: number): void {
    this.level = this.getScaleLabel(value);
  }
  
}
