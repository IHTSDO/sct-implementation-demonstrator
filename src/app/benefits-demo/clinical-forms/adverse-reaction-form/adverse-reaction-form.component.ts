import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Patient, Condition, MedicationStatement } from '../../../services/patient.service';
import { TerminologyService } from '../../../services/terminology.service';

export interface AdverseReactionReport {
  // Case Identification & Administrative
  reportId: string;
  dateOfReceipt: Date;
  senderInformation: {
    name: string;
    address: string;
    country: string;
    qualification: string;
  };
  reportType: string;
  
  // Patient Details (pre-populated from clinical record)
  patientId: string;
  patientInitials: string;
  age: number;
  dateOfBirth: Date;
  gender: string;
  medicalHistory: string;
  
  // Adverse Reaction Details
  adverseReaction: {
    description: string;
    dateOfOnset: Date;
    duration: string;
    dateOfRecovery: Date | null;
    seriousness: string[];
    outcome: string;
  };
  
  // Suspected Medicinal Product
  suspectedProduct: {
    name: string;
    activeSubstance: string;
    dose: string;
    frequency: string;
    duration: string;
    routeOfAdministration: string;
    startDate: Date;
    stopDate: Date | null;
    batchNumber: string;
  };
  
  // Concomitant Products
  concomitantProducts: Array<{
    name: string;
    activeSubstance: string;
    dose: string;
    frequency: string;
    startDate: Date;
    stopDate: Date | null;
  }>;
  
  // Follow-up Information
  therapeuticMeasures: string;
  laboratoryData: string;
  caseNarrative: string;
  
  // Additional Information
  countryOfReaction: string;
  countryOfReporter: string;
  reporterType: string;
  literatureReference: string;
}

@Component({
  selector: 'app-adverse-reaction-form',
  templateUrl: './adverse-reaction-form.component.html',
  styleUrls: ['./adverse-reaction-form.component.css'],
  standalone: false
})
export class AdverseReactionFormComponent implements OnInit {
  @Input() patient: Patient | null = null;
  @Input() conditions: Condition[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Output() formSubmitted = new EventEmitter<AdverseReactionReport>();
  @Output() formCancelled = new EventEmitter<void>();

  adverseReactionForm: FormGroup;
  selectedCondition: Condition | null = null;
  selectedMedication: MedicationStatement | null = null;
  medraMappings: any[] = [];
  isLoadingMedra: boolean = false;
  activeIngredients: any[] = [];
  isLoadingIngredients: boolean = false;

  // Options for dropdowns
  reportTypes = [
    'Spontaneous',
    'Solicited',
    'Literature',
    'Clinical Trial',
    'Regulatory Authority',
    'Other'
  ];

  seriousnessOptions = [
    'Death',
    'Life-threatening',
    'Hospitalization',
    'Disability/Incapacity',
    'Congenital Anomaly/Birth Defect',
    'Other Medically Important Condition'
  ];

  outcomeOptions = [
    'Recovered',
    'Recovering',
    'Not Recovered',
    'Recovered with Sequelae',
    'Fatal',
    'Unknown'
  ];

  routeOfAdministrationOptions = [
    'Oral',
    'Intravenous',
    'Intramuscular',
    'Subcutaneous',
    'Topical',
    'Inhalation',
    'Rectal',
    'Vaginal',
    'Ophthalmic',
    'Otic',
    'Other'
  ];

  reporterTypes = [
    'Physician',
    'Pharmacist',
    'Nurse',
    'Dentist',
    'Consumer/Patient',
    'Other Healthcare Professional',
    'Lawyer',
    'Other'
  ];

  countries = [
    'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
    'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
    'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
    'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
    'United Kingdom', 'Other'
  ];

  constructor(
    private fb: FormBuilder,
    private terminologyService: TerminologyService
  ) {
    this.adverseReactionForm = this.createForm();
  }

  ngOnInit(): void {
    this.populatePatientData();
    this.generateReportId();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      // Case Identification & Administrative
      reportId: [''],
      dateOfReceipt: [new Date()],
      senderInformation: this.fb.group({
        name: [''],
        address: [''],
        country: [''],
        qualification: ['']
      }),
      reportType: ['Spontaneous'],
      
      // Patient Details
      patientId: [''],
      patientInitials: [''],
      age: [null],
      dateOfBirth: [null],
      gender: [''],
      medicalHistory: [''],
      
      // Adverse Reaction
      adverseReaction: this.fb.group({
        description: [''],
        dateOfOnset: [null],
        duration: [''],
        dateOfRecovery: [null],
        seriousness: [[]],
        outcome: ['']
      }),
      
      // Suspected Product
      suspectedProduct: this.fb.group({
        name: [''],
        activeSubstance: [''],
        dose: [''],
        frequency: [''],
        duration: [''],
        routeOfAdministration: [''],
        startDate: [null],
        stopDate: [null],
        batchNumber: ['']
      }),
      
      // Concomitant Products
      concomitantProducts: this.fb.array([]),
      
      // Follow-up Information
      therapeuticMeasures: [''],
      laboratoryData: [''],
      caseNarrative: [''],
      
      // Additional Information
      countryOfReaction: [''],
      countryOfReporter: [''],
      reporterType: [''],
      literatureReference: ['']
    });
  }

  private populatePatientData(): void {
    if (this.patient) {
      const form = this.adverseReactionForm;
      
      // Populate patient details
      form.patchValue({
        patientId: this.patient.id || '',
        patientInitials: this.generatePatientInitials(),
        age: this.calculateAge(),
        dateOfBirth: this.patient.birthDate ? new Date(this.patient.birthDate) : null,
        gender: this.patient.gender || '',
        medicalHistory: this.generateMedicalHistory()
      });
    }
  }

  private generatePatientInitials(): string {
    if (!this.patient?.name?.[0]) return '';
    
    const given = this.patient.name[0].given?.[0] || '';
    const family = this.patient.name[0].family || '';
    
    return `${given.charAt(0)}${family.charAt(0)}`.toUpperCase();
  }

  private calculateAge(): number | null {
    if (!this.patient?.birthDate) return null;
    
    const birthDate = new Date(this.patient.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private generateMedicalHistory(): string {
    if (!this.conditions || this.conditions.length === 0) return 'No known medical history';
    
    return this.conditions
      .map(condition => condition.code?.text || condition.id)
      .join(', ');
  }

  private generateReportId(): void {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    const reportId = `ADR-${timestamp}-${random}`;
    
    this.adverseReactionForm.patchValue({
      reportId: reportId
    });
  }

  get concomitantProductsArray(): FormArray {
    return this.adverseReactionForm.get('concomitantProducts') as FormArray;
  }

  addConcomitantProduct(): void {
    const concomitantProductGroup = this.fb.group({
      name: [''],
      activeSubstance: [''],
      dose: [''],
      frequency: [''],
      startDate: [null],
      stopDate: [null]
    });

    this.concomitantProductsArray.push(concomitantProductGroup);
  }

  removeConcomitantProduct(index: number): void {
    this.concomitantProductsArray.removeAt(index);
  }

  onConditionSelected(condition: Condition): void {
    this.selectedCondition = condition;
    this.adverseReactionForm.patchValue({
      adverseReaction: {
        description: condition.code?.text || condition.id
      }
    });

    // Get MedDRA mappings for the selected condition
    this.getMedraMappings(condition);
  }

  private getMedraMappings(condition: Condition): void {
    // Extract SNOMED CT code from condition
    const snomedCode = condition.code?.coding?.find(coding => 
      coding.system?.includes('snomed.info') || 
      coding.system?.includes('snomed.org')
    )?.code;

    if (!snomedCode) {
      console.warn('No SNOMED CT code found for condition:', condition);
      this.medraMappings = [];
      return;
    }

    this.isLoadingMedra = true;
    this.medraMappings = [];

    this.terminologyService.getMedraMapTargets(snomedCode).subscribe({
      next: (response) => {
        this.isLoadingMedra = false;
        // The service transforms Snowstorm API response to FHIR-like format
        if (response && response.parameter && Array.isArray(response.parameter)) {
          // Extract MedDRA mappings from the transformed response
          this.medraMappings = response.parameter
            .filter((param: any) => param.name === 'concept' && param.valueCoding?.system?.includes('meddra.org'))
            .map((param: any) => ({
              code: param.valueCoding?.code,
              display: param.valueCoding?.display,
              system: param.valueCoding?.system
            }))
            .filter((mapping: any) => mapping.code && mapping.display); // Only include valid mappings
          
        } else {
          console.warn('No valid response parameters found');
          this.medraMappings = [];
        }
      },
      error: (error) => {
        this.isLoadingMedra = false;
        console.error('Error fetching MedDRA mappings from Snowstorm API:', error);
        this.medraMappings = [];
      }
    });
  }

  onMedicationSelected(medication: MedicationStatement): void {
    this.selectedMedication = medication;
    const medicationName = medication.medicationCodeableConcept?.text || 'Unknown medication';
    
    // Get the SNOMED CT concept ID for the medication
    const snomedCode = this.getMedicationConceptId(medication);
    
    // Fetch active ingredients using ECL
    this.getActiveIngredients(snomedCode);
    
    this.adverseReactionForm.patchValue({
      suspectedProduct: {
        name: medicationName,
        activeSubstance: '', // Will be populated after ingredients are fetched
        dose: this.extractDose(medication),
        frequency: this.extractFrequency(medication),
        startDate: medication.effectivePeriod?.start ? new Date(medication.effectivePeriod.start) : null,
        stopDate: medication.effectivePeriod?.end ? new Date(medication.effectivePeriod.end) : null
      }
    });
  }

  getMedicationConceptId(medication: MedicationStatement): string {
    // Extract SNOMED CT concept ID from medication
    const snomedCode = medication.medicationCodeableConcept?.coding?.find(coding => 
      coding.system?.includes('snomed.info') || 
      coding.system?.includes('snomed.org')
    )?.code;

    return snomedCode || 'No SNOMED ID';
  }

  private getActiveIngredients(medicationConceptId: string): void {
    if (!medicationConceptId || medicationConceptId === 'No SNOMED ID') {
      this.activeIngredients = [];
      this.updateActiveSubstanceField();
      return;
    }

    this.isLoadingIngredients = true;
    this.activeIngredients = [];

    // Use ECL to find active ingredients: {conceptId}.<<127489000 |Has active ingredient|
    const ecl = `${medicationConceptId}.<<127489000 |Has active ingredient|`;
    
    this.terminologyService.expandValueSet(ecl, '', 0, 50).subscribe({
      next: (response) => {
        this.isLoadingIngredients = false;
        if (response && response.expansion && response.expansion.contains && Array.isArray(response.expansion.contains)) {
          this.activeIngredients = response.expansion.contains.map((item: any) => ({
            code: item.code,
            display: item.display,
            system: 'http://snomed.info/sct'
          }));
        } else {
          console.warn('No active ingredients found');
          this.activeIngredients = [];
        }
        
        this.updateActiveSubstanceField();
      },
      error: (error) => {
        this.isLoadingIngredients = false;
        console.error('Error fetching active ingredients:', error);
        this.activeIngredients = [];
        this.updateActiveSubstanceField();
      }
    });
  }

  private updateActiveSubstanceField(): void {
    if (this.activeIngredients.length > 0) {
      const ingredientNames = this.activeIngredients.map(ingredient => ingredient.display).join(', ');
      this.adverseReactionForm.patchValue({
        suspectedProduct: {
          activeSubstance: ingredientNames
        }
      });
    } else {
      this.adverseReactionForm.patchValue({
        suspectedProduct: {
          activeSubstance: 'No active ingredients found'
        }
      });
    }
  }

  private extractDose(medication: MedicationStatement): string {
    if (medication.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity) {
      const dose = medication.dosage[0].doseAndRate[0].doseQuantity;
      return `${dose.value} ${dose.unit || ''}`.trim();
    }
    return '';
  }

  private extractFrequency(medication: MedicationStatement): string {
    if (medication.dosage?.[0]?.timing?.repeat?.frequency) {
      return `${medication.dosage[0].timing.repeat.frequency} times per ${medication.dosage[0].timing.repeat.period || 'day'}`;
    }
    return '';
  }

  onSubmit(): void {
    const formData = this.adverseReactionForm.value as AdverseReactionReport;
    this.formSubmitted.emit(formData);
  }

  onCancel(): void {
    this.formCancelled.emit();
  }

  updateSeriousness(event: any): void {
    const currentSeriousness = this.adverseReactionForm.get('adverseReaction.seriousness')?.value || [];
    const value = event.source.value;
    
    if (event.checked) {
      if (!currentSeriousness.includes(value)) {
        currentSeriousness.push(value);
      }
    } else {
      const index = currentSeriousness.indexOf(value);
      if (index > -1) {
        currentSeriousness.splice(index, 1);
      }
    }
    
    this.adverseReactionForm.patchValue({
      adverseReaction: {
        seriousness: currentSeriousness
      }
    });
  }

}
