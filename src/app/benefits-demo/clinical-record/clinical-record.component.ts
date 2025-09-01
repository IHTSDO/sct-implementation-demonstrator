import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService, Patient, Condition, Procedure, MedicationRequest } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { ClinicalEntryComponent } from '../clinical-entry/clinical-entry.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-clinical-record',
  templateUrl: './clinical-record.component.html',
  styleUrls: ['./clinical-record.component.css'],
  standalone: false
})
export class ClinicalRecordComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('conditionEntry') conditionEntry!: ClinicalEntryComponent;
  @ViewChild('procedureEntry') procedureEntry!: ClinicalEntryComponent;
  @ViewChild('medicationEntry') medicationEntry!: ClinicalEntryComponent;
  @ViewChild('headPoint') headPoint!: ElementRef;
  @ViewChild('centerPoint') centerPoint!: ElementRef;
  @ViewChild('firstConditionTarget') firstConditionTarget!: ElementRef;
  @ViewChild('secondConditionTarget') secondConditionTarget!: ElementRef;
  @ViewChild('connectionLine') connectionLine!: ElementRef;
  @ViewChild('secondConnectionLine') secondConnectionLine!: ElementRef;

  patient: Patient | null = null;
  conditions: Condition[] = [];
  procedures: Procedure[] = [];
  medications: MedicationRequest[] = [];
  currentDate = new Date();
  private subscriptions: Subscription[] = [];

  constructor(
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Subscribe to selected patient
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.patient = patient;
        if (patient) {
          this.loadClinicalData(patient.id);
        } else {
          this.router.navigate(['/benefits-demo']);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngAfterViewInit(): void {
    // Calculate and draw connection line after view is initialized
    setTimeout(() => this.updateConnectionLine(), 100);
  }

  goBack(): void {
    this.router.navigate(['/benefits-demo']);
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

  getBodyModelImage(gender: string | undefined): string {
    if (gender === 'female') {
      return 'assets/img/body-model-female.png';
    } else if (gender === 'male') {
      return 'assets/img/body-model-male.png';
    } else {
      // Default to male model if gender is unknown
      return 'assets/img/body-model-male.png';
    }
  }

  loadClinicalData(patientId: string): void {
    this.conditions = this.patientService.getPatientConditions(patientId);
    this.procedures = this.patientService.getPatientProcedures(patientId);
    this.medications = this.patientService.getPatientMedications(patientId);
    
    // Update connection line after data is loaded
    setTimeout(() => this.updateConnectionLine(), 50);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  }

  getConditionStatus(condition: Condition): string {
    if (condition.clinicalStatus?.text) {
      return condition.clinicalStatus.text;
    }
    if (condition.clinicalStatus?.coding && condition.clinicalStatus.coding.length > 0) {
      return condition.clinicalStatus.coding[0].display || condition.clinicalStatus.coding[0].code || 'Unknown';
    }
    return 'Unknown';
  }

  getProcedureStatus(procedure: Procedure): string {
    return procedure.status || 'Unknown';
  }

  getMedicationStatus(medication: MedicationRequest): string {
    return medication.status || 'Unknown';
  }

  toggleConditionEntry(): void {
    this.conditionEntry.toggleAddForm();
  }

  onConditionAdded(event: any): void {
    this.loadClinicalData(this.patient!.id);
  }

  toggleProcedureEntry(): void {
    this.procedureEntry.toggleAddForm();
  }

  onProcedureAdded(event: any): void {
    this.loadClinicalData(this.patient!.id);
  }

  toggleMedicationEntry(): void {
    this.medicationEntry.toggleAddForm();
  }

  onMedicationAdded(event: any): void {
    this.loadClinicalData(this.patient!.id);
  }

  updateConnectionLine(): void {
    // Update first connection line (head to first condition)
    this.drawConnectionLine(
      this.headPoint,
      this.firstConditionTarget,
      this.connectionLine,
      0
    );

    // Update second connection line (center to second condition)
    this.drawConnectionLine(
      this.centerPoint,
      this.secondConditionTarget,
      this.secondConnectionLine,
      1
    );
  }

  private drawConnectionLine(
    startPoint: ElementRef,
    endPoint: ElementRef,
    lineElement: ElementRef,
    conditionIndex: number
  ): void {
    if (!startPoint || !endPoint || !lineElement || this.conditions.length <= conditionIndex) {
      return;
    }

    try {
      const startEl = startPoint.nativeElement;
      const endEl = endPoint.nativeElement;
      const lineEl = lineElement.nativeElement;

      // Get positions relative to the page
      const startRect = startEl.getBoundingClientRect();
      const endRect = endEl.getBoundingClientRect();
      
      // Get the container to calculate relative positions
      const containerRect = startEl.parentElement.getBoundingClientRect();

      // Calculate relative positions within the container
      const startX = startRect.left + startRect.width / 2 - containerRect.left;
      const startY = startRect.top + startRect.height / 2 - containerRect.top;
      const endX = endRect.left + endRect.width / 2 - containerRect.left;
      const endY = endRect.top + endRect.height / 2 - containerRect.top;

      // Calculate distance and angle
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      // Apply calculated values to the line
      lineEl.style.width = `${distance}px`;
      lineEl.style.transform = `rotate(${angle}deg)`;
      lineEl.style.left = `${startX}px`;
      lineEl.style.top = `${startY}px`;
      lineEl.style.position = 'absolute';
      lineEl.style.transformOrigin = '0 50%';

    } catch (error) {
      console.log(`Could not calculate connection line ${conditionIndex + 1} positions`);
    }
  }

  getConceptId(resource: any): string {
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].code;
    }
    return '';
  }

  deleteCondition(conditionId: string): void {
    if (!this.patient) return;
    
    const condition = this.conditions.find(c => c.id === conditionId);
    if (condition && confirm(`Are you sure you want to delete the condition "${condition.code.text}"?`)) {
      this.patientService.deletePatientCondition(this.patient.id, conditionId);
      this.loadClinicalData(this.patient.id);
    }
  }

  deleteProcedure(procedureId: string): void {
    if (!this.patient) return;
    
    const procedure = this.procedures.find(p => p.id === procedureId);
    if (procedure && confirm(`Are you sure you want to delete the procedure "${procedure.code.text}"?`)) {
      this.patientService.deletePatientProcedure(this.patient.id, procedureId);
      this.loadClinicalData(this.patient.id);
    }
  }

  deleteMedication(medicationId: string): void {
    if (!this.patient) return;
    
    const medication = this.medications.find(m => m.id === medicationId);
    if (medication && confirm(`Are you sure you want to delete the medication "${medication.medicationCodeableConcept?.text}"?`)) {
      this.patientService.deletePatientMedication(this.patient.id, medicationId);
      this.loadClinicalData(this.patient.id);
    }
  }
}
