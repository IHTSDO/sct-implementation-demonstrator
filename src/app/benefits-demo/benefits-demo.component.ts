import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { PatientService, Patient } from '../services/patient.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-benefits-demo',
  templateUrl: './benefits-demo.component.html',
  styleUrls: ['./benefits-demo.component.css'],
  standalone: false
})
export class BenefitsDemoComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  patients: Patient[] = [];
  selectedPatient: Patient | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private patientService: PatientService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Subscribe to patients list
    this.subscriptions.push(
      this.patientService.getPatients().subscribe(patients => {
        this.patients = patients;
      })
    );

    // Subscribe to selected patient
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.selectedPatient = patient;
      })
    );
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

  openClinicalRecord(): void {
    if (this.selectedPatient) {
      this.router.navigate(['/clinical-record']);
    }
  }

  createNewPatient(): void {
    this.router.navigate(['/create-patient']);
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
