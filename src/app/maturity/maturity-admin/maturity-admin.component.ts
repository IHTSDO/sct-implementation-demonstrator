import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { FirebaseService, MaturityAssessmentResult } from 'src/app/services/firebase.service';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { Unsubscribe } from 'firebase/firestore';

@Component({
  selector: 'app-maturity-admin',
  templateUrl: './maturity-admin.component.html',
  styleUrl: './maturity-admin.component.css',
  standalone: false
})
export class MaturityAdminComponent implements OnInit, OnDestroy {
  assessments: (MaturityAssessmentResult & { id: string })[] = [];
  dataSource = new MatTableDataSource<MaturityAssessmentResult & { id: string }>([]);
  loading = true;
  selectedEventName = 'Expo 2025';
  availableEvents: string[] = [];
  
  // Table columns to display
  displayedColumns: string[] = ['name', 'author', 'systemName', 'timestamp', 'level', 'overallScore', 'location', 'actions'];
  
  private firebaseUnsubscribe: Unsubscribe | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private _snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadAvailableEvents();
    this.loadAssessments();
  }

  ngOnDestroy(): void {
    this.clearRealtimeListener();
  }

  /**
   * Load available event names for filtering
   */
  async loadAvailableEvents(): Promise<void> {
    try {
      const eventGroups = await this.firebaseService.getMaturityAssessmentResultsByEvent();
      this.availableEvents = Object.keys(eventGroups).sort();
    } catch (error) {
      console.error('Error loading available events:', error);
    }
  }

  /**
   * Load assessments for the selected event
   */
  async loadAssessments(): Promise<void> {
    this.loading = true;
    this.clearRealtimeListener();
    
    try {
      const results = await this.firebaseService.getMaturityAssessmentResults(this.selectedEventName, 100);
      this.assessments = results as (MaturityAssessmentResult & { id: string })[];
      this.dataSource.data = this.assessments;
      
      // Set up real-time listener
      this.setupRealtimeListener();
      
    } catch (error) {
      console.error('Error loading assessments:', error);
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5000,
        data: `Error loading assessments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        panelClass: ['red-snackbar']
      });
    } finally {
      this.loading = false;
    }
  }

  /**
   * Set up real-time listener for assessment changes
   */
  private setupRealtimeListener(): void {
    this.firebaseUnsubscribe = this.firebaseService.subscribeToMaturityAssessmentResults(
      this.selectedEventName,
      (changes) => {
        // Run inside Angular zone to ensure change detection
        this.ngZone.run(() => {
          let hasChanges = false;
          changes.forEach(change => {
            console.log(`Real-time change detected: ${change.type} for doc ${change.docId}`);
            switch (change.type) {
              case 'added':
                // Check if assessment is not already in the list (avoid duplicates from initial load)
                const existingIndex = this.assessments.findIndex(a => a.id === change.docId);
                if (existingIndex === -1) {
                  this.assessments.unshift({ ...change.data, id: change.docId } as MaturityAssessmentResult & { id: string });
                  this.dataSource.data = [...this.assessments]; // Update dataSource
                  hasChanges = true;
                  console.log('Added assessment to local array');
                }
                break;
              case 'removed':
                const removeIndex = this.assessments.findIndex(a => a.id === change.docId);
                console.log(`Trying to remove doc ${change.docId}, found at index: ${removeIndex}, current array length: ${this.assessments.length}`);
                if (removeIndex !== -1) {
                  this.assessments.splice(removeIndex, 1);
                  this.dataSource.data = [...this.assessments]; // Update dataSource
                  hasChanges = true;
                  console.log(`Removed assessment from local array, new length: ${this.assessments.length}`);
                } else {
                  console.log('Assessment not found in local array for removal');
                }
                break;
              case 'modified':
                const modifyIndex = this.assessments.findIndex(a => a.id === change.docId);
                if (modifyIndex !== -1) {
                  this.assessments[modifyIndex] = { ...change.data, id: change.docId } as MaturityAssessmentResult & { id: string };
                  this.dataSource.data = [...this.assessments]; // Update dataSource
                  hasChanges = true;
                  console.log('Modified assessment in local array');
                }
                break;
            }
          });
          
          // Log final state for debugging
          if (hasChanges) {
            console.log(`Changes applied, final array length: ${this.assessments.length}`);
          }
        });
      }
    );
  }

  /**
   * Clear the real-time listener
   */
  private clearRealtimeListener(): void {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
  }

  /**
   * Handle event selection change
   */
  onEventChange(): void {
    this.loadAssessments();
  }

  /**
   * Delete an assessment
   */
  async deleteAssessment(assessment: MaturityAssessmentResult & { id: string }): Promise<void> {
    const confirmDelete = confirm(
      `Are you sure you want to delete the assessment "${assessment.name}" by ${assessment.author}?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      // Delete from Firebase - let the real-time listener handle the UI update
      await this.firebaseService.deleteMaturityAssessmentResult(assessment.id);
      
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 3000,
        data: `Assessment "${assessment.name}" has been deleted successfully`,
        panelClass: ['green-snackbar']
      });
    } catch (error) {
      console.error('Error deleting assessment:', error);
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5000,
        data: `Error deleting assessment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        panelClass: ['red-snackbar']
      });
    }
  }

  /**
   * Get location display text
   */
  getLocationDisplay(location: any): string {
    if (!location) return 'N/A';
    
    if (location.placeName) return location.placeName;
    if (location.country) return location.country;
    if (location.label) {
      const parts = location.label.split(',');
      return parts[0]?.trim() || 'N/A';
    }
    
    return 'N/A';
  }

  /**
   * Get stakeholder display name
   */
  getStakeholderDisplay(stakeholder: string): string {
    const stakeholderNames: Record<string, string> = {
      'vendor': 'Vendor',
      'user': 'User Organization',
      'member': 'Member Organization'
    };
    return stakeholderNames[stakeholder] || stakeholder;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Get score color based on value
   */
  getScoreColor(score: number): string {
    if (score >= 4) return '#4caf50'; // Green
    if (score >= 3) return '#ff9800'; // Orange
    if (score >= 2) return '#f44336'; // Red
    return '#9e9e9e'; // Gray
  }

  /**
   * Refresh the assessments list
   */
  refresh(): void {
    this.loadAssessments();
  }
}
