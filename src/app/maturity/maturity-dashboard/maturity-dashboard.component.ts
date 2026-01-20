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
import { MatDialog } from '@angular/material/dialog';
import { MaturityResultsDialogComponent } from '../maturity-results-dialog';

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
  
  // Continent-based cycling properties
  private continentGroups: Map<string, { markers: L.Marker[], data: any[] }> = new Map();
  private continentOrder: string[] = [];
  private currentContinentIndex: number = 0;
  private currentMarkerInContinent: number = 0;
  private isShowingWorldView: boolean = true;
  
  // Debug properties
  private debugPolygons: boolean = false; // Set to false to disable debug polygons
  private regionPolygons: L.Rectangle[] = [];
  
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
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
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
    this.clearDebugPolygons();
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
   * Note: questionFullPath construction handles KPA IDs with spaces correctly
   */
  private createMockAllQuestions(assessment: MaturityAssessmentResult): any[] {
    const questions: any[] = [];
    
    // Get selected KPAs
    const selectedKpas = Object.keys(assessment.selectedKpas).filter(kpaId => assessment.selectedKpas[kpaId]);
    
    selectedKpas.forEach(kpaId => {
      // Build question path (handles KPA IDs with spaces correctly)
      const questionFullPath = [assessment.selectedStakeholder, kpaId, 'question'].join('_');
      
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
        questionFullPath: questionFullPath
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
   * Handles KPA IDs with spaces (e.g., "human capital") by using allQuestions if available,
   * otherwise falls back to a mapping or returns the ID itself
   */
  private getKpaDisplayName(kpaId: string, allQuestions?: any[]): string {
    // First, try to find in allQuestions if available (most reliable)
    if (allQuestions && allQuestions.length > 0) {
      const questionItem = allQuestions.find(q => q.kpaId === kpaId);
      if (questionItem && questionItem.kpaName) {
        return questionItem.kpaName;
      }
    }
    
    // Fallback to hardcoded mapping for common KPAs
    const kpaNames: Record<string, string> = {
      'scope': 'Scope of SNOMED CT Implementation',
      'provisioning': 'Terminology Provisioning and Maintenance',
      'usability': 'Usability and Tool Support',
      'governance': 'Governance and Strategy',
      'training': 'User Proficiency and Training',
      'interoperability': 'Interoperability',
      'analytics': 'Analytics and Decision Support',
      'adoption': 'Growth and Adoption',
      'engagement': 'Stakeholder Engagement',
      'extension': 'National Extension Management',
      'complex': 'Secondary Use',
      'political': 'Political and Legal',
      'financial': 'Financial and administrative',
      'technical': 'Technical',
      'human capital': 'Human capital'
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
    // Load index file that lists all available JSON files
    const indexUrl = 'assets/maturity/dashboard-examples/index.json';
    
    this.uploadedData = [];
    this.kpasNames = {};
    
    fetch(indexUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error fetching index file: ${response.statusText}`);
        }
        return response.json();
      })
      .then(indexData => {
        // Get the list of files from the index
        const exampleFiles = indexData.files.map((filename: string) => 
          `assets/maturity/dashboard-examples/${filename}`
        );
        
        this.totalFilesCount = exampleFiles.length;
        this.filesReadCount = 0;
        
        // Load each file listed in the index
        for (const file of exampleFiles) {
          this.readJSONFileFromUrl(file);
        }
      })
      .catch(error => {
        console.error('Error loading example files index:', error);
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: `Error loading example files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          panelClass: ['red-snackbar']
        });
      });
  }

  /**
   * Convert 0-100 scale to 0-5 scale for display (same as maturity-results component)
   */
  private convertToFiveScale(value: number): number {
    return Math.round((value / 100) * 5 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Normalize scores in the data entry: use normalized scores if available, otherwise convert from 0-100 to 0-5
   */
  private normalizeScores(entry: any): void {
    // If normalized scores exist, use them directly
    if (entry.overallScoreNormalized !== undefined) {
      entry.overallScore = entry.overallScoreNormalized;
    } else if (entry.overallScore !== undefined && entry.overallScore > 5) {
      // If overallScore is > 5, it's likely in 0-100 scale, convert it
      entry.overallScore = this.convertToFiveScale(entry.overallScore);
    }

    // Normalize KPA scores
    if (entry.kpasScoresNormalized !== undefined) {
      entry.kpasScores = entry.kpasScoresNormalized;
    } else if (entry.kpasScores) {
      // Check if any KPA score is > 5, indicating 0-100 scale
      const hasLargeScores = Object.values(entry.kpasScores).some(
        (score: any) => typeof score === 'number' && score > 5
      );
      
      if (hasLargeScores) {
        // Convert all KPA scores from 0-100 to 0-5
        entry.kpasScores = Object.fromEntries(
          Object.entries(entry.kpasScores).map(([key, value]) => [
            key,
            typeof value === 'number' ? this.convertToFiveScale(value) : value
          ])
        );
      }
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
        // Normalize scores before adding to uploadedData
        this.normalizeScores(jsonContent);
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
      bottom: 60px;
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
      <p style="margin: 0 0 8px 0; color: #666; font-size: 14px; font-weight: bold;">
        ${this.uploadedData.length} assessments loaded
      </p>
      <div style="display: flex; gap: 15px; justify-content: center; align-items: center; margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background: #1565c0; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
          <span style="font-size: 11px; color: #333; font-weight: 500;">Vendor</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background: #2e7d32; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
          <span style="font-size: 11px; color: #333; font-weight: 500;">User Organization</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background: #d84315; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
          <span style="font-size: 11px; color: #333; font-weight: 500;">Member Organization</span>
        </div>
      </div>
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
    
    // Fit map to show all markers (no animation for initial setup)
    this.fitMapToMarkers(false);
    
    // Create debug polygons if enabled
    if (this.debugPolygons) {
      // Small delay to ensure markers are fully rendered
      setTimeout(() => {
        this.createDebugPolygons();
      }, 500);
    }
  }

  private clearMapMarkers(): void {
    this.mapMarkers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.mapMarkers = [];
    
    // Also clear debug polygons when clearing markers
    this.clearDebugPolygons();
  }

  private clearCalloutTimer(): void {
    if (this.calloutCycleTimer) {
      clearInterval(this.calloutCycleTimer);
      this.calloutCycleTimer = null;
    }
  }

  private startCalloutCycling(): void {
    if (this.mapMarkers.length === 0) return;
    
    // Group markers by continent
    this.groupMarkersByContinent();
    
    // Start with world view
    this.currentContinentIndex = 0;
    this.currentMarkerInContinent = 0;
    this.isShowingWorldView = true;
    
    // Show world view first, then start the continent cycling
    this.showWorldView();
    
    // Set up the cycling timer - 4 seconds for world view, then continent cycling
    this.calloutCycleTimer = setInterval(() => {
      this.processContinentCycle();
    }, 4000); // 4 seconds per phase
  }

  /**
   * Process the continent cycling logic
   */
  private processContinentCycle(): void {
    if (this.continentOrder.length === 0) return;
    
    if (this.isShowingWorldView) {
      // Move from world view to next continent
      this.isShowingWorldView = false;
      this.currentMarkerInContinent = 0;
      this.showCurrentContinent();
    } else {
      // We're currently showing a continent
      const currentContinent = this.continentOrder[this.currentContinentIndex];
      const currentGroup = this.continentGroups.get(currentContinent);
      
      if (currentGroup && this.currentMarkerInContinent < currentGroup.markers.length) {
        // Hide current marker callout and show next marker in same continent
        this.hideCurrentMarkerCallout();
        this.currentMarkerInContinent++;
        
        if (this.currentMarkerInContinent < currentGroup.markers.length) {
          // Show next marker in same continent
          this.showCurrentMarkerInContinent();
        } else {
          // Finished with this continent, transition back to world view
          this.moveToNextContinent();
        }
      } else {
        // No markers in current continent, move to next
        this.moveToNextContinent();
      }
    }
  }

  /**
   * Show world view with all markers visible, centered like initial load
   */
  private showWorldView(): void {
    this.hideAllCallouts();
    
    if (this.mapMarkers.length > 0) {
      // Fit to show all markers with proper world view
      this.fitMapToMarkers(true);
    } else {
      // If no markers, show default world view
      this.map.setView([20, 0], 2, {
        animate: true,
        duration: 0.8
      });
    }
  }

  /**
   * Show current continent by zooming to its bounds
   */
  private showCurrentContinent(): void {
    if (this.currentContinentIndex >= this.continentOrder.length) {
      this.isShowingWorldView = true;
      this.showWorldView();
      return;
    }
    
    const continent = this.continentOrder[this.currentContinentIndex];
    const bounds = this.getContinentBounds(continent);
    
    if (bounds && this.map) {
      // Calculate optimal zoom level to fit the bounds exactly
      const optimalZoom = this.calculateOptimalZoom(bounds);
      const center = bounds.getCenter();
      
      console.log(`🔍 Zooming to ${continent}: center=${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}, zoom=${optimalZoom}`);
      
      // Zoom to the exact center and calculated zoom level
      this.map.setView(center, optimalZoom, {
        animate: true,
        duration: 0.8
      });
      
      // Start showing markers after zoom completes
      setTimeout(() => {
        this.currentMarkerInContinent = 0;
        this.showCurrentMarkerInContinent();
      }, 900);
    } else {
      // No markers in this continent, move to next
      this.moveToNextContinent();
    }
  }

  /**
   * Show current marker callout in the current continent
   */
  private showCurrentMarkerInContinent(): void {
    const continent = this.continentOrder[this.currentContinentIndex];
    const group = this.continentGroups.get(continent);
    
    if (group && this.currentMarkerInContinent < group.markers.length) {
      const marker = group.markers[this.currentMarkerInContinent];
      marker.openTooltip();
    }
  }

  /**
   * Hide current marker callout
   */
  private hideCurrentMarkerCallout(): void {
    const continent = this.continentOrder[this.currentContinentIndex];
    const group = this.continentGroups.get(continent);
    
    if (group && this.currentMarkerInContinent < group.markers.length) {
      const marker = group.markers[this.currentMarkerInContinent];
      marker.closeTooltip();
    }
  }

  /**
   * Hide all marker callouts
   */
  private hideAllCallouts(): void {
    this.mapMarkers.forEach(marker => marker.closeTooltip());
  }

  /**
   * Move to next continent or back to world view
   */
  private moveToNextContinent(): void {
    // Always transition through world view between continents
    this.isShowingWorldView = true;
    this.currentContinentIndex++;
    
    if (this.currentContinentIndex >= this.continentOrder.length) {
      // Finished all continents, reset to beginning
      this.currentContinentIndex = 0;
    }
    
    // Show world view as transition
    this.showWorldView();
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

  /**
   * Map country codes to continents
   */
  private getContinentByCountryCode(countryCode: string): string {
    const continentMapping: Record<string, string> = {
      // US & Canada
      'us': 'US & Canada', 'ca': 'US & Canada',
      
      // Mexico & Central America (including Caribbean)
      'mx': 'Mexico & Central America', 'gt': 'Mexico & Central America', 'bz': 'Mexico & Central America', 
      'sv': 'Mexico & Central America', 'hn': 'Mexico & Central America', 'ni': 'Mexico & Central America',
      'cr': 'Mexico & Central America', 'pa': 'Mexico & Central America', 'cu': 'Mexico & Central America', 
      'jm': 'Mexico & Central America', 'ht': 'Mexico & Central America', 'do': 'Mexico & Central America', 
      'bs': 'Mexico & Central America', 'bb': 'Mexico & Central America', 'tt': 'Mexico & Central America', 
      'gd': 'Mexico & Central America', 'vc': 'Mexico & Central America', 'lc': 'Mexico & Central America',
      'dm': 'Mexico & Central America', 'ag': 'Mexico & Central America', 'kn': 'Mexico & Central America',
      
      // South America
      'br': 'South America', 'ar': 'South America', 'co': 'South America', 've': 'South America',
      'pe': 'South America', 'ec': 'South America', 'bo': 'South America', 'py': 'South America',
      'uy': 'South America', 'cl': 'South America', 'gy': 'South America', 'sr': 'South America',
      'gf': 'South America',
      
      // Belgium (separate from Europe for detailed focus)
      'be': 'Belgium',
      
      // Europe (excluding Belgium)
      'gb': 'Europe', 'fr': 'Europe', 'de': 'Europe', 'it': 'Europe', 'es': 'Europe', 'pt': 'Europe',
      'nl': 'Europe', 'ch': 'Europe', 'at': 'Europe', 'se': 'Europe', 'no': 'Europe',
      'dk': 'Europe', 'fi': 'Europe', 'ie': 'Europe', 'is': 'Europe', 'pl': 'Europe', 'cz': 'Europe',
      'sk': 'Europe', 'hu': 'Europe', 'ro': 'Europe', 'bg': 'Europe', 'hr': 'Europe', 'si': 'Europe',
      'rs': 'Europe', 'ba': 'Europe', 'me': 'Europe', 'mk': 'Europe', 'al': 'Europe', 'gr': 'Europe',
      'cy': 'Europe', 'mt': 'Europe', 'lu': 'Europe', 'li': 'Europe', 'mc': 'Europe', 'sm': 'Europe',
      'va': 'Europe', 'ad': 'Europe', 'ee': 'Europe', 'lv': 'Europe', 'lt': 'Europe', 'by': 'Europe',
      'ua': 'Europe', 'md': 'Europe', 'ru': 'Europe',
      
      // East Asia (China, Japan, Korea, Mongolia, Southeast Asia)
      'cn': 'East Asia', 'jp': 'East Asia', 'kr': 'East Asia', 'kp': 'East Asia', 'mn': 'East Asia',
      'th': 'East Asia', 'vn': 'East Asia', 'ph': 'East Asia', 'my': 'East Asia', 'sg': 'East Asia', 
      'mm': 'East Asia', 'kh': 'East Asia', 'la': 'East Asia', 'bn': 'East Asia', 'tl': 'East Asia',
      'id': 'East Asia', 'tw': 'East Asia', 'hk': 'East Asia', 'mo': 'East Asia',
      
      // West & Central Asia (India, Central Asia, Caucasus)
      'in': 'West & Central Asia', 'pk': 'West & Central Asia', 'bd': 'West & Central Asia', 
      'lk': 'West & Central Asia', 'mv': 'West & Central Asia', 'bt': 'West & Central Asia', 
      'np': 'West & Central Asia', 'kz': 'West & Central Asia', 'uz': 'West & Central Asia', 
      'tm': 'West & Central Asia', 'kg': 'West & Central Asia', 'tj': 'West & Central Asia',
      'af': 'West & Central Asia', 'am': 'West & Central Asia', 'az': 'West & Central Asia', 
      'ge': 'West & Central Asia',
      
      // Middle East
      'sa': 'Middle East', 'ae': 'Middle East', 'qa': 'Middle East', 'kw': 'Middle East', 'bh': 'Middle East',
      'om': 'Middle East', 'ye': 'Middle East', 'jo': 'Middle East', 'sy': 'Middle East', 'lb': 'Middle East',
      'il': 'Middle East', 'ps': 'Middle East', 'iq': 'Middle East', 'ir': 'Middle East', 'tr': 'Middle East',
      
      // Africa
      'eg': 'Africa', 'ly': 'Africa', 'tn': 'Africa', 'dz': 'Africa', 'ma': 'Africa', 'sd': 'Africa',
      'ss': 'Africa', 'et': 'Africa', 'er': 'Africa', 'dj': 'Africa', 'so': 'Africa', 'ke': 'Africa',
      'ug': 'Africa', 'tz': 'Africa', 'rw': 'Africa', 'bi': 'Africa', 'cd': 'Africa', 'cf': 'Africa',
      'cm': 'Africa', 'td': 'Africa', 'ne': 'Africa', 'ng': 'Africa', 'bj': 'Africa', 'tg': 'Africa',
      'gh': 'Africa', 'ci': 'Africa', 'bf': 'Africa', 'ml': 'Africa', 'sn': 'Africa', 'gm': 'Africa',
      'gw': 'Africa', 'gn': 'Africa', 'sl': 'Africa', 'lr': 'Africa', 'mr': 'Africa', 'cv': 'Africa',
      'st': 'Africa', 'gq': 'Africa', 'ga': 'Africa', 'cg': 'Africa', 'ao': 'Africa', 'na': 'Africa',
      'bw': 'Africa', 'za': 'Africa', 'sz': 'Africa', 'ls': 'Africa', 'mz': 'Africa', 'mw': 'Africa',
      'zm': 'Africa', 'zw': 'Africa', 'mg': 'Africa', 'mu': 'Africa', 'sc': 'Africa', 'km': 'Africa',
      
      // Oceania
      'au': 'Oceania', 'nz': 'Oceania', 'pg': 'Oceania', 'fj': 'Oceania', 'sb': 'Oceania', 'vu': 'Oceania',
      'nc': 'Oceania', 'pf': 'Oceania', 'ws': 'Oceania', 'to': 'Oceania', 'tv': 'Oceania', 'nr': 'Oceania',
      'ki': 'Oceania', 'mh': 'Oceania', 'fm': 'Oceania', 'pw': 'Oceania', 'ck': 'Oceania', 'nu': 'Oceania'
    };
    
    return continentMapping[countryCode.toLowerCase()] || 'Other';
  }

  /**
   * Group markers by continent and create continent order
   */
  private groupMarkersByContinent(): void {
    this.continentGroups.clear();
    this.continentOrder = [];
    
    this.uploadedData.forEach((entry, index) => {
      const location = entry.location || entry.responses?.location;
      if (!location || typeof location.y !== 'number' || typeof location.x !== 'number') {
        return;
      }
      
      // Get continent from country code
      const countryCode = location.countryCode || location.raw?.address?.country_code;
      const continent = countryCode ? this.getContinentByCountryCode(countryCode) : 'Other';
      
      // Initialize continent group if it doesn't exist
      if (!this.continentGroups.has(continent)) {
        this.continentGroups.set(continent, { markers: [], data: [] });
        this.continentOrder.push(continent);
      }
      
      // Find the corresponding marker
      const marker = this.mapMarkers[index];
      if (marker) {
        const group = this.continentGroups.get(continent)!;
        group.markers.push(marker);
        group.data.push(entry);
      }
    });
    
    // Sort continent order for consistent presentation
    this.continentOrder.sort((a, b) => {
      const order = ['US & Canada', 'Mexico & Central America', 'South America', 'Europe', 'Belgium', 'Middle East', 'West & Central Asia', 'East Asia', 'Africa', 'Oceania', 'Other'];
      return order.indexOf(a) - order.indexOf(b);
    });
    
  }

  /**
   * Get predefined geographic bounds for each continent
   */
  private getContinentBounds(continent: string): L.LatLngBounds | null {
    const group = this.continentGroups.get(continent);
    if (!group || group.markers.length === 0) {
      return null;
    }
    
    // Use predefined geographic bounds for each continent/region
    const continentBounds: Record<string, [[number, number], [number, number]]> = {
      'US & Canada': [
        [25, -170],  // Southwest: Southern US (Florida/Texas), Western Alaska
        [62.5, -50]  // Northeast: Reduced from 75° to 62.5° (25% shorter) - excludes far northern Canada/Arctic
      ],
      'Mexico & Central America': [
        [8, -120],   // Southwest: Southern Panama, Western Mexico
        [33, -60]    // Northeast: Southern US border, Eastern Caribbean
      ],
      'South America': [
        [-60, -85],  // Southwest: Southern Chile, Western Peru
        [15, -30]    // Northeast: Northern Colombia/Venezuela, Eastern Brazil
      ],
      'Europe': [
        [35, -25],   // Southwest: Southern Spain/Portugal, Atlantic
        [65, 45]     // Northeast: Reduced from 75° to 65° (25% shorter) - excludes far northern Scandinavia/Siberia
      ],
      'Belgium': [
        [49.5, 2.5],  // Southwest: Southern Belgium near French border
        [52.2, 6.4]   // Northeast: Extended north for callout padding on small screens
      ],
      'East Asia': [
        [-10, 95],   // Southwest: Southern Indonesia, Western Myanmar
        [55, 180]    // Northeast: Northern Mongolia, Eastern Russia/Japan
      ],
      'West & Central Asia': [
        [5, 60],     // Southwest: Southern India, Western Iran
        [55, 100]    // Northeast: Northern Kazakhstan, Eastern China border
      ],
      'Middle East': [
        [10, 25],    // Southwest: Southern Yemen, Eastern Egypt
        [45, 65]     // Northeast: Northern Turkey, Eastern Iran
      ],
      'Africa': [
        [-40, -20],  // Southwest: Southern South Africa, Western Atlantic
        [40, 55]     // Northeast: Northern Egypt, Eastern Somalia
      ],
      'Oceania': [
        [-50, 110],  // Southwest: Southern New Zealand, Western Australia
        [-5, 180]    // Northeast: Northern Australia/Papua New Guinea, Eastern New Zealand
      ],
      'Other': [
        [-60, -180], // Global bounds as fallback
        [85, 180]
      ]
    };
    
    const bounds = continentBounds[continent];
    if (!bounds) {
      return null;
    }
    
    return L.latLngBounds(bounds[0], bounds[1]);
  }


  /**
   * Create debug polygons showing region boundaries
   */
  private createDebugPolygons(): void {
    if (!this.debugPolygons || !this.map) return;
    
    // Clear existing polygons
    this.clearDebugPolygons();
    
    // Get all region bounds
    const regionBounds = this.getAllRegionBounds();
    
    // Create a rectangle for each region
    regionBounds.forEach(({ region, bounds, hasMarkers }) => {
      const rectangle = L.rectangle(bounds, {
        color: hasMarkers ? '#ff0000' : '#cccccc', // Red if has markers, gray if empty
        weight: 2,
        opacity: 0.8,
        fillColor: hasMarkers ? '#ff0000' : '#cccccc',
        fillOpacity: 0.1
      }).addTo(this.map);
      
      // Add label
      const center = bounds.getCenter();
      const label = L.marker(center, {
        icon: L.divIcon({
          className: 'region-label',
          html: `<div style="background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; color: ${hasMarkers ? '#ff0000' : '#666'}; border: 1px solid ${hasMarkers ? '#ff0000' : '#ccc'};">${region}</div>`,
          iconSize: [100, 20],
          iconAnchor: [50, 10]
        })
      }).addTo(this.map);
      
      this.regionPolygons.push(rectangle);
      this.regionPolygons.push(label as any); // Store label as well for cleanup
    });
  }

  /**
   * Clear debug polygons from map
   */
  private clearDebugPolygons(): void {
    this.regionPolygons.forEach(polygon => {
      if (this.map) {
        this.map.removeLayer(polygon);
      }
    });
    this.regionPolygons = [];
  }

  /**
   * Get bounds for all regions with marker status
   */
  private getAllRegionBounds(): { region: string, bounds: L.LatLngBounds, hasMarkers: boolean }[] {
    const regionBoundsData: Record<string, [[number, number], [number, number]]> = {
      'US & Canada': [
        [25, -170],  // Southwest: Southern US (Florida/Texas), Western Alaska
        [62.5, -50]  // Northeast: Reduced from 75° to 62.5° (25% shorter) - excludes far northern Canada/Arctic
      ],
      'Mexico & Central America': [
        [8, -120],   // Southwest: Southern Panama, Western Mexico
        [33, -60]    // Northeast: Southern US border, Eastern Caribbean
      ],
      'South America': [
        [-60, -85],  // Southwest: Southern Chile, Western Peru
        [15, -30]    // Northeast: Northern Colombia/Venezuela, Eastern Brazil
      ],
      'Europe': [
        [35, -25],   // Southwest: Southern Spain/Portugal, Atlantic
        [65, 45]     // Northeast: Reduced from 75° to 65° (25% shorter) - excludes far northern Scandinavia/Siberia
      ],
      'Belgium': [
        [49.5, 2.5],  // Southwest: Southern Belgium near French border
        [52.2, 6.4]   // Northeast: Extended north for callout padding on small screens
      ],
      'East Asia': [
        [-10, 95],   // Southwest: Southern Indonesia, Western Myanmar
        [55, 180]    // Northeast: Northern Mongolia, Eastern Russia/Japan
      ],
      'West & Central Asia': [
        [5, 60],     // Southwest: Southern India, Western Iran
        [55, 100]    // Northeast: Northern Kazakhstan, Eastern China border
      ],
      'Middle East': [
        [10, 25],    // Southwest: Southern Yemen, Eastern Egypt
        [45, 65]     // Northeast: Northern Turkey, Eastern Iran
      ],
      'Africa': [
        [-40, -20],  // Southwest: Southern South Africa, Western Atlantic
        [40, 55]     // Northeast: Northern Egypt, Eastern Somalia
      ],
      'Oceania': [
        [-50, 110],  // Southwest: Southern New Zealand, Western Australia
        [-5, 180]    // Northeast: Northern Australia/Papua New Guinea, Eastern New Zealand
      ]
    };

    return Object.entries(regionBoundsData).map(([region, boundsArray]) => ({
      region,
      bounds: L.latLngBounds(boundsArray[0], boundsArray[1]),
      hasMarkers: this.continentGroups.has(region) && this.continentGroups.get(region)!.markers.length > 0
    }));
  }

  /**
   * Toggle debug polygons on/off
   */
  public toggleDebugPolygons(): void {
    this.debugPolygons = !this.debugPolygons;
    
    if (this.debugPolygons) {
      this.createDebugPolygons();
    } else {
      this.clearDebugPolygons();
    }
    
    console.log(`Debug polygons ${this.debugPolygons ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update continent grouping when a new marker is added
   */
  private updateContinentGroupingForNewMarker(marker: L.Marker, data: any): void {
    const location = data.location || data.responses?.location;
    if (!location || typeof location.y !== 'number' || typeof location.x !== 'number') {
      return;
    }
    
    // Get continent from country code
    const countryCode = location.countryCode || location.raw?.address?.country_code;
    const continent = countryCode ? this.getContinentByCountryCode(countryCode) : 'Other';
    
    // Initialize continent group if it doesn't exist
    if (!this.continentGroups.has(continent)) {
      this.continentGroups.set(continent, { markers: [], data: [] });
      // Add to continent order if it's a new continent
      if (!this.continentOrder.includes(continent)) {
        this.continentOrder.push(continent);
        // Re-sort continent order
        this.continentOrder.sort((a, b) => {
          const order = ['US & Canada', 'Mexico & Central America', 'South America', 'Europe', 'Belgium', 'Middle East', 'West & Central Asia', 'East Asia', 'Africa', 'Oceania', 'Other'];
          return order.indexOf(a) - order.indexOf(b);
        });
      }
    }
    
    // Add marker and data to the continent group
    const group = this.continentGroups.get(continent)!;
    group.markers.unshift(marker); // Add to beginning for priority
    group.data.unshift(data);
    
    // Update debug polygons if enabled
    if (this.debugPolygons) {
      this.createDebugPolygons();
    }
  }

  /**
   * Update continent grouping when a marker is removed
   */
  private updateContinentGroupingForRemovedMarker(marker: L.Marker, data: any): void {
    const location = data.location || data.responses?.location;
    if (!location || typeof location.y !== 'number' || typeof location.x !== 'number') {
      return;
    }
    
    // Get continent from country code
    const countryCode = location.countryCode || location.raw?.address?.country_code;
    const continent = countryCode ? this.getContinentByCountryCode(countryCode) : 'Other';
    
    const group = this.continentGroups.get(continent);
    if (!group) return;
    
    // Remove marker and data from the continent group
    const markerIndex = group.markers.indexOf(marker);
    if (markerIndex !== -1) {
      group.markers.splice(markerIndex, 1);
      group.data.splice(markerIndex, 1);
    }
    
    // If continent group is now empty, remove it from the order
    if (group.markers.length === 0) {
      this.continentGroups.delete(continent);
      const orderIndex = this.continentOrder.indexOf(continent);
      if (orderIndex !== -1) {
        this.continentOrder.splice(orderIndex, 1);
        
        // Adjust current continent index if we removed a continent before the current one
        if (this.currentContinentIndex > orderIndex) {
          this.currentContinentIndex--;
        } else if (this.currentContinentIndex === orderIndex) {
          // We removed the current continent, reset cycling
          if (this.currentContinentIndex >= this.continentOrder.length) {
            this.currentContinentIndex = 0;
          }
          this.isShowingWorldView = true;
        }
      }
    }
    
    // Update debug polygons if enabled
    if (this.debugPolygons) {
      this.createDebugPolygons();
    }
  }

  /**
   * Calculate optimal zoom level to fit bounds exactly
   */
  private calculateOptimalZoom(bounds: L.LatLngBounds): number {
    if (!this.map) return 2;
    
    // Use Leaflet's built-in method to calculate the zoom level that fits the bounds
    // with a small padding to ensure the bounds are fully visible
    const optimalZoom = this.map.getBoundsZoom(bounds, false, L.point(20, 20));
    
    // Clamp between reasonable limits
    return Math.max(2, Math.min(18, optimalZoom));
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
      switch (change.type) {
        case 'added':
          // Skip added events for documents that were loaded during initial load to avoid duplicates
          if (this.initialDocumentIds.has(change.docId)) {
            return;
          }
          this.handleAssessmentAdded(change.data, change.docId);
          break;
        case 'removed':
          // Always handle removal events, even for initially loaded documents
          console.log(`Dashboard: Handling removal of doc ${change.docId}`);
          this.handleAssessmentRemoved(change.docId);
          break;
        case 'modified':
          // Handle modification events for all documents
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
    console.log(`Dashboard: Attempting to remove doc ${docId} from uploadedData`);
    
    // Remove from uploadedData
    const index = this.uploadedData.findIndex(item => item.docId === docId);
    console.log(`Dashboard: Found doc at index ${index}, current uploadedData length: ${this.uploadedData.length}`);
    if (index !== -1) {
      this.uploadedData.splice(index, 1);
      console.log(`Dashboard: Removed from uploadedData, new length: ${this.uploadedData.length}`);
    } else {
      console.log('Dashboard: Doc not found in uploadedData');
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
    
    // Update continent grouping to include the new marker
    this.updateContinentGroupingForNewMarker(marker, data);
    
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
      
      // Update continent grouping to remove the marker
      this.updateContinentGroupingForRemovedMarker(markerData.marker, markerData.data);
      
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

  private fitMapToMarkers(animate: boolean = true): void {
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
        padding: [20, 20],
        animate: animate,
        duration: animate ? 0.8 : 0 // 800ms animation when animate is true
      });
    }
    
  }

  getScoreColor(score: number): string {
    // Clamp score to valid range (0-5), allowing 0 for "None"
    const clamped = Math.max(0, Math.min(5, score));
    
    // Handle score of 0 (None) - return gray
    if (clamped === 0) {
      return '#808080'; // Gray for None
    }
    
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
        // Normalize scores before adding to uploadedData
        this.normalizeScores(jsonContent);
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
        console.error(entry);
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

  openMaturityResultsDialog(stakeholder: any): void {
    // The maturity-results component expects a flat structure with keys like "stakeholder_kpa_question"
    // JSON files store this in the "responses" object (which contains responseForm.value)
    // Firebase data might have it in responses or at the top level
    
    let maturityResponse: any = {};
    
    // Helper function to check if a key looks like a question path
    // Note: This handles KPA IDs with spaces by checking if key starts with stakeholder_ and contains at least one more underscore
    const isQuestionKey = (key: string, stakeholderId?: string): boolean => {
      const excludedKeys = ['selectedStakeholder', 'selectedKpas', 'name', 'author', 'timestamp', 
                            'systemName', 'location', 'overallScore', 'kpasScores', 'level', 
                            'allQuestions', 'responses', 'stakeHolderName', 'color', 'docId',
                            'overallScoreNormalized', 'kpasScoresNormalized'];
      
      if (excludedKeys.includes(key)) {
        return false;
      }
      
      // If we have stakeholder ID, check if key starts with it
      if (stakeholderId && key.startsWith(stakeholderId + '_')) {
        // Must have at least one more underscore after stakeholder (for kpa_question)
        const afterStakeholder = key.substring(stakeholderId.length + 1);
        return afterStakeholder.includes('_');
      }
      
      // Fallback: check if it has at least 2 underscores (stakeholder_kpa_question minimum)
      // This is less reliable but works as a fallback
      const underscoreCount = (key.match(/_/g) || []).length;
      return underscoreCount >= 2;
    };
    
    const stakeholderId = stakeholder.selectedStakeholder || stakeholder.responses?.selectedStakeholder;
    
    // Priority 1: Check if responses object exists and has question keys (JSON files)
    if (stakeholder.responses && typeof stakeholder.responses === 'object') {
      // Check if responses has question keys (format: stakeholder_kpa_question)
      const hasQuestionKeys = Object.keys(stakeholder.responses).some(key => 
        isQuestionKey(key, stakeholderId)
      );
      
      if (hasQuestionKeys) {
        // responses object has the question keys - use it as base
        maturityResponse = { ...stakeholder.responses };
      }
    }
    
    // Priority 2: Check if stakeholder object itself has question keys at top level
    if (Object.keys(maturityResponse).length === 0) {
      const hasQuestionKeys = Object.keys(stakeholder).some(key => 
        isQuestionKey(key, stakeholderId)
      );
      
      if (hasQuestionKeys) {
        maturityResponse = { ...stakeholder };
        // Remove non-question keys
        delete maturityResponse.allQuestions;
        delete maturityResponse.responses;
        delete maturityResponse.stakeHolderName;
        delete maturityResponse.color;
        delete maturityResponse.docId;
        delete maturityResponse.overallScore;
        delete maturityResponse.kpasScores;
        delete maturityResponse.overallScoreNormalized;
        delete maturityResponse.kpasScoresNormalized;
        delete maturityResponse.level;
      }
    }
    
    // Priority 3: Reconstruct from allQuestions if available
    if (Object.keys(maturityResponse).length === 0 && stakeholder.allQuestions && Array.isArray(stakeholder.allQuestions)) {
      stakeholder.allQuestions.forEach((question: any) => {
        if (question.questionFullPath) {
          const responseValue = stakeholder[question.questionFullPath] || 
                               stakeholder.responses?.[question.questionFullPath];
          if (responseValue !== undefined) {
            maturityResponse[question.questionFullPath] = responseValue;
          }
          
          const commentKey = `${question.questionFullPath}_comment`;
          const commentValue = stakeholder[commentKey] || 
                             stakeholder.responses?.[commentKey];
          if (commentValue !== undefined) {
            maturityResponse[commentKey] = commentValue;
          }
        }
      });
    }
    
    // Ensure we have the required metadata fields
    if (!maturityResponse.selectedStakeholder) {
      maturityResponse.selectedStakeholder = stakeholder.selectedStakeholder || stakeholder.responses?.selectedStakeholder;
    }
    if (!maturityResponse.selectedKpas) {
      maturityResponse.selectedKpas = stakeholder.selectedKpas || stakeholder.responses?.selectedKpas;
    }
    if (!maturityResponse.name) {
      maturityResponse.name = stakeholder.name || stakeholder.responses?.name;
    }
    if (!maturityResponse.author) {
      maturityResponse.author = stakeholder.author || stakeholder.responses?.author;
    }
    if (!maturityResponse.timestamp) {
      maturityResponse.timestamp = stakeholder.timestamp || stakeholder.responses?.timestamp;
    }
    if (!maturityResponse.systemName) {
      maturityResponse.systemName = stakeholder.systemName || stakeholder.responses?.systemName;
    }
    if (!maturityResponse.location) {
      maturityResponse.location = stakeholder.location || stakeholder.responses?.location;
    }
    
    this.dialog.open(MaturityResultsDialogComponent, {
      width: '90%',
      maxWidth: '1600px',
      height: '90vh',
      data: { 
        maturityResponse: maturityResponse,
        allQuestions: stakeholder.allQuestions || [],
        stakeholderName: stakeholder.name || stakeholder.responses?.name || 'Unknown Stakeholder'
      }
    });
  }
  
}
