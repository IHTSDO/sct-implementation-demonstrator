import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { PatientService, Patient } from '../services/patient.service';
import { PatientDataTransformerService } from '../services/patient-data-transformer.service';
import { PatientSimulationService } from '../services/patient-simulation.service';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BatchPatientDialogComponent } from './batch-patient-dialog/batch-patient-dialog.component';
import { catchError, delay } from 'rxjs/operators';

@Component({
  selector: 'app-benefits-demo',
  templateUrl: './benefits-demo.component.html',
  styleUrls: ['./benefits-demo.component.css'],
  standalone: false
})
export class BenefitsDemoComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  searchTerm: string = '';
  selectedPatient: Patient | null = null;
  showAnalytics = false;
  analyticsMode: 'regular' | 'icd10' = 'regular';
  private subscriptions: Subscription[] = [];

  constructor(
    private patientService: PatientService,
    private patientDataTransformer: PatientDataTransformerService,
    private patientSimulationService: PatientSimulationService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Subscribe to patients list
    this.subscriptions.push(
      this.patientService.getPatients().subscribe(patients => {
        this.patients = this.sortPatientsByCreationDate(patients);
        this.filterPatients();
      })
    );

    // Subscribe to selected patient
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.selectedPatient = patient;
      })
    );
  }

  filterPatients(): void {
    if (!this.searchTerm.trim()) {
      this.filteredPatients = this.patients;
      return;
    }

    const searchLower = this.searchTerm.toLowerCase().trim();
    this.filteredPatients = this.patients.filter(patient => {
      if (patient.name && patient.name.length > 0) {
        const name = patient.name[0];
        
        // Check family name (last name)
        if (name.family && name.family.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Check given names (first name, middle names, etc.)
        if (name.given) {
          const givenMatches = name.given.some(givenName => 
            givenName.toLowerCase().includes(searchLower)
          );
          if (givenMatches) {
            return true;
          }
        }
        
        // Check full text name if available
        if (name.text && name.text.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
      
      return false;
    });
  }

  onSearchChange(): void {
    this.filterPatients();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filterPatients();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  selectPatient(patient: Patient): void {
    this.patientService.selectPatient(patient);
  }

  clearSelection(): void {
    this.patientService.selectPatient(null);
  }

  getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) {
        return name.text;
      }
      if (name.given && name.family) {
        return `${name.given.join(' ')} ${name.family}`;
      }
      if (name.family) {
        return name.family;
      }
    }
    return `Patient ${patient.id}`;
  }

  getPatientAge(birthDate: string | undefined): string {
    if (!birthDate) return 'Unknown';
    
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return `${age - 1} years`;
    }
    return `${age} years`;
  }

  getPatientIdentifier(patient: Patient): string {
    if (patient.identifier && patient.identifier.length > 0) {
      return patient.identifier[0].value;
    }
    return patient.id;
  }

  private sortPatientsByCreationDate(patients: Patient[]): Patient[] {
    return patients.sort((a, b) => {
      // Extract timestamp from patient ID (format: patient-timestamp-random)
      const getTimestampFromId = (id: string): number => {
        const parts = id.split('-');
        if (parts.length >= 2) {
          const timestamp = parseInt(parts[1], 10);
          return isNaN(timestamp) ? 0 : timestamp;
        }
        return 0;
      };

      const timestampA = getTimestampFromId(a.id);
      const timestampB = getTimestampFromId(b.id);
      
      // Sort in descending order (newest first)
      return timestampB - timestampA;
    });
  }

  openClinicalRecord(): void {
    if (this.selectedPatient) {
      this.router.navigate(['/clinical-record', this.selectedPatient.id]);
    }
  }

  deleteSelectedPatient(): void {
    if (!this.selectedPatient) {
      return;
    }

    const patientName = this.getPatientDisplayName(this.selectedPatient);
    const confirmation = confirm(
      `Are you sure you want to delete patient "${patientName}"?\n\n` +
      'This will permanently delete:\n' +
      '• Patient record\n' +
      '• All clinical conditions\n' +
      '• All procedures\n' +
      '• All medications\n' +
      '• All allergies\n\n' +
      'This action cannot be undone.'
    );

    if (confirmation) {
      try {
        // Clear all clinical data for this patient
        this.patientService.clearAllPatientEvents(this.selectedPatient.id);
        
        // Delete the patient
        this.patientService.deletePatient(this.selectedPatient.id);
        
        // Clear selection
        this.patientService.selectPatient(null);
        
        alert(`Patient "${patientName}" has been deleted successfully.`);
      } catch (error) {
        console.error('Error deleting patient:', error);
        alert('Error deleting patient. Please try again.');
      }
    }
  }

  createNewPatient(): void {
    this.router.navigate(['/create-patient']);
  }

  createRandomPatient(): void {
    const randomPatient = this.patientSimulationService.generateRandomPatient();
    this.patientService.addPatient(randomPatient);
    this.patientService.selectPatient(randomPatient);
    this.router.navigate(['/clinical-record', randomPatient.id]);
  }

  createRandomPatientWithDiagnoses(): void {
    this.patientSimulationService.generateRandomPatientWithDiagnoses().subscribe({
      next: (result) => {
        // Add the patient to the service
        this.patientService.addPatient(result.patient);
        
        // Add the diagnoses as conditions
        result.diagnoses.forEach(diagnosis => {
          this.patientService.addPatientCondition(result.patient.id, diagnosis);
        });
        
        // Select the patient and navigate to clinical record
        this.patientService.selectPatient(result.patient);
        this.router.navigate(['/clinical-record', result.patient.id]);
      },
      error: (error) => {
        console.error('Error generating patient with diagnoses:', error);
        alert('Error generating patient with diagnoses. Please try again.');
      }
    });
  }

  createBatchPatients(): void {
    const dialogRef = this.dialog.open(BatchPatientDialogComponent, {
      width: '80vw',
      maxWidth: '1400px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.generateMultiplePatients(
          result.numberOfPatients, 
          result.includeDiagnoses,
          result.minDiagnoses,
          result.maxDiagnoses,
          result.genderDistribution,
          result.ageDistribution
        );
      }
    });
  }

  private async generateMultiplePatients(
    count: number, 
    includeDiagnoses: boolean, 
    minDiagnoses: number = 1, 
    maxDiagnoses: number = 4, 
    genderDistribution: number = 0.5,
    ageDistribution?: { children: number; adults: number; elderly: number }
  ): Promise<void> {
    const snackBarRef = this.snackBar.open(`Generating ${count} patients...`, 'Cancel', {
      duration: undefined
    });

    let completed = 0;
    let lastPatientId: string | null = null;

    try {
      for (let i = 0; i < count; i++) {
        // Check if user cancelled
        if (!snackBarRef) break;

        if (includeDiagnoses) {
          // Generate patient with diagnoses
          await new Promise<void>((resolve, reject) => {
            this.patientSimulationService.generateRandomPatientWithDiagnoses(minDiagnoses, maxDiagnoses, genderDistribution, ageDistribution)
              .pipe(
                catchError(error => {
                  console.error(`Error generating patient ${i + 1}:`, error);
                  return of(null);
                })
              )
              .subscribe({
                next: (result) => {
                  if (result) {
                    // Add the patient to the service
                    this.patientService.addPatient(result.patient);
                    
                    // Add the diagnoses as conditions
                    result.diagnoses.forEach(diagnosis => {
                      this.patientService.addPatientCondition(result.patient.id, diagnosis);
                    });
                    
                    lastPatientId = result.patient.id;
                  }
                  completed++;
                  snackBarRef.instance.data.message = `Generated ${completed} of ${count} patients...`;
                  resolve();
                },
                error: reject
              });
          });
        } else {
          // Generate simple random patient with gender and age distribution
          const gender = this.patientSimulationService.getRandomGenderWithDistribution(genderDistribution);
          
          let randomPatient: Patient;
          if (ageDistribution) {
            const [minAge, maxAge] = this.patientSimulationService.getRandomAgeGroupWithDistribution(ageDistribution);
            randomPatient = this.patientSimulationService.generateRandomPatientWithAgeRange(minAge, maxAge);
            // Set gender after age generation
            randomPatient.gender = gender;
            // Update name to match gender
            const firstName = this.patientSimulationService.getRandomFirstNameForGender(gender as 'male' | 'female');
            if (randomPatient.name && randomPatient.name.length > 0) {
              randomPatient.name[0].given = [firstName];
            }
          } else {
            randomPatient = this.patientSimulationService.generateRandomPatientWithGender(gender as 'male' | 'female');
          }
          
          this.patientService.addPatient(randomPatient);
          lastPatientId = randomPatient.id;
          completed++;
          snackBarRef.instance.data.message = `Generated ${completed} of ${count} patients...`;
        }

        // Small delay to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      snackBarRef.dismiss();
      
      // Show success message
      this.snackBar.open(`Successfully generated ${completed} patients!`, 'Close', {
        duration: 5000,
        panelClass: ['success-snackbar']
      });

      // Select the last created patient if available
      if (lastPatientId) {
        const lastPatient = this.patients.find(p => p.id === lastPatientId);
        if (lastPatient) {
          this.patientService.selectPatient(lastPatient);
        }
      }
    } catch (error) {
      console.error('Error in batch patient generation:', error);
      snackBarRef.dismiss();
      this.snackBar.open('Error generating patients. Some patients may not have been created.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    }

    // Handle cancel button
    snackBarRef.onAction().subscribe(() => {
      snackBarRef.dismiss();
      this.snackBar.open(`Cancelled. Generated ${completed} of ${count} patients.`, 'Close', {
        duration: 3000
      });
    });
  }

  openAnalytics(): void {
    this.router.navigate(['/ehr-lab/analytics']);
  }

  openIcd10Analytics(): void {
    this.router.navigate(['/ehr-lab/analytics'], { queryParams: { mode: 'icd10' } });
  }

  hasAnalyticsData(): boolean {
    return this.patientDataTransformer.hasPatientData(false);
  }

  hasIcd10AnalyticsData(): boolean {
    return this.patientDataTransformer.hasPatientData(true);
  }

  getAnalyticsDataSummary(): { patients: number, conditions: number, procedures: number, medications: number } {
    return this.patientDataTransformer.getDataSummary(false);
  }

  getIcd10AnalyticsDataSummary(): { patients: number, conditions: number, procedures: number, medications: number } {
    return this.patientDataTransformer.getDataSummary(true);
  }

  closeAnalytics(): void {
    this.showAnalytics = false;
    this.analyticsMode = 'regular';
  }

  openInteroperability(): void {
    this.router.navigate(['/interoperability']);
  }

  async downloadPatientsAsZip(): Promise<void> {
    try {
      await this.patientService.downloadPatientsZip();
    } catch (error) {
      console.error('Error downloading patients ZIP:', error);
      alert('Error generating export file. Please try again.');
    }
  }

  triggerFileUpload(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please select a ZIP file.');
      return;
    }

    try {
      const result = await this.patientService.importPatientsFromZip(file);
      
      if (result.success) {
        alert(result.message);
        // Clear the file input
        input.value = '';
      } else {
        alert(`Import failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error importing patients:', error);
      alert('Error importing patient data. Please try again.');
    }
  }

  clearAllData(): void {
    const confirmation = confirm(
      'Are you sure you want to clear all patient data?\n\n' +
      'This will permanently delete:\n' +
      '• All patient records\n' +
      '• All clinical conditions\n' +
      '• All procedures\n' +
      '• All medications\n\n' +
      'This action cannot be undone.'
    );

    if (confirmation) {
      try {
        this.patientService.clearAllPatientsAndClinicalData();
        alert('All patient data has been cleared successfully.');
      } catch (error) {
        console.error('Error clearing patient data:', error);
        alert('Error clearing patient data. Please try again.');
      }
    }
  }
}
