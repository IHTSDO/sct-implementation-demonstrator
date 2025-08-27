import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PatientService, Patient } from '../../services/patient.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create-patient',
  templateUrl: './create-patient.component.html',
  styleUrls: ['./create-patient.component.css'],
  standalone: false
})
export class CreatePatientComponent implements OnInit, OnDestroy {
  patientForm: FormGroup;
  isSubmitting = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private router: Router
  ) {
    this.patientForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      birthDate: ['', Validators.required],
      gender: ['', Validators.required],
      phone: ['', [Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      email: ['', [Validators.email]],
      addressLine1: [''],
      city: [''],
      state: [''],
      postalCode: [''],
      country: ['US']
    });
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onSubmit(): void {
    if (this.patientForm.valid) {
      this.isSubmitting = true;
      
      const formValue = this.patientForm.value;
      
      // Generate a unique ID
      const patientId = 'patient-' + Date.now();
      const mrn = 'MRN' + String(Date.now()).slice(-6);
      
      const newPatient: Patient = {
        resourceType: 'Patient',
        id: patientId,
        identifier: [
          {
            system: 'http://hospital.example.org/identifiers/patient',
            value: mrn
          }
        ],
        active: true,
        name: [
          {
            use: 'official',
            family: formValue.lastName,
            given: [formValue.firstName]
          }
        ],
        telecom: [
          {
            system: 'phone',
            value: formValue.phone,
            use: 'home'
          },
          {
            system: 'email',
            value: formValue.email,
            use: 'home'
          }
        ],
        gender: formValue.gender,
        birthDate: formValue.birthDate,
        address: [
          {
            use: 'home',
            type: 'physical',
            line: [formValue.addressLine1],
            city: formValue.city,
            state: formValue.state,
            postalCode: formValue.postalCode,
            country: formValue.country
          }
        ]
      };

      // Add the patient to the service
      this.patientService.addPatient(newPatient);
      
      // Select the new patient
      this.patientService.selectPatient(newPatient);
      
      // Navigate to clinical record
      this.router.navigate(['/clinical-record']);
    } else {
      this.markFormGroupTouched();
    }
  }

  cancel(): void {
    this.router.navigate(['/benefits-demo']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.patientForm.controls).forEach(key => {
      const control = this.patientForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.patientForm.get(controlName);
    if (control?.hasError('required')) {
      return 'This field is required';
    }
    if (control?.hasError('minlength')) {
      return `Minimum length is ${control.errors?.['minlength'].requiredLength} characters`;
    }
    if (control?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    if (control?.hasError('pattern')) {
      return 'Please enter a valid phone number';
    }
    return '';
  }
}
