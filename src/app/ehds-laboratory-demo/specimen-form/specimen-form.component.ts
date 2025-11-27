import { Component, OnInit, AfterViewInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ValuesetDialogComponent } from '../valueset-dialog/valueset-dialog.component';

export interface SpecimenData {
  status: string;
  type: {
    code: string;
    system: string;
    display: string;
  } | null;
  receivedTime: Date | null;
  collectionBodySite: {
    code: string;
    display: string;
  } | null;
  collectionMethod: {
    code: string;
    system: string;
    display: string;
  } | null;
  collectionFastingStatus: {
    code: string;
    system: string;
    display: string;
  } | null;
  processingProcedure: {
    code: string;
    system: string;
    display: string;
  } | null;
  containerType: {
    code: string;
    system: string;
    display: string;
  } | null;
  condition: {
    code: string;
    system: string;
    display: string;
  } | null;
}

@Component({
  selector: 'app-specimen-form',
  templateUrl: './specimen-form.component.html',
  styleUrls: ['./specimen-form.component.css'],
  standalone: false
})
export class SpecimenFormComponent implements OnInit, AfterViewInit {
  specimenForm: FormGroup;
  isViewOnly: boolean = false;

  // Binding for Collection Body Site autocomplete
  // ECL: << 442083009 |Anatomical or acquired body structure (body structure)|
  collectionBodySiteBinding = {
    ecl: '<< 442083009 |Anatomical or acquired body structure (body structure)|',
    title: 'Collection Body Site',
    note: 'Search for anatomical body structures'
  };

  // Specimen Status options from FHIR ValueSet
  // https://hl7.org/fhir/R4/valueset-specimen-status.html
  statusOptions = [
    { code: 'available', display: 'Available', definition: 'The physical specimen is present and in good condition.' },
    { code: 'unavailable', display: 'Unavailable', definition: 'There is no physical specimen because it is either lost, destroyed or consumed.' },
    { code: 'unsatisfactory', display: 'Unsatisfactory', definition: 'The specimen cannot be used because of a quality issue such as a broken container, contamination, or too old.' },
    { code: 'entered-in-error', display: 'Entered in Error', definition: 'The specimen was entered in error and therefore nullified.' }
  ];

  // Collection Method options from FHIR Specimen Collection Method ValueSet
  // https://hl7.org/fhir/R4/valueset-specimen-collection-method.html
  // System: http://snomed.info/sct
  collectionMethodOptions = [
    { code: '129316008', system: 'http://snomed.info/sct', display: 'Aspiration - action' },
    { code: '129314006', system: 'http://snomed.info/sct', display: 'Biopsy - action' },
    { code: '129300006', system: 'http://snomed.info/sct', display: 'Puncture - action' },
    { code: '129304002', system: 'http://snomed.info/sct', display: 'Excision - action' },
    { code: '129323009', system: 'http://snomed.info/sct', display: 'Scraping - action' },
    { code: '73416001', system: 'http://snomed.info/sct', display: 'Urine specimen collection, clean catch' },
    { code: '225113003', system: 'http://snomed.info/sct', display: 'Timed urine collection' },
    { code: '70777001', system: 'http://snomed.info/sct', display: 'Urine specimen collection, catheterized' },
    { code: '386089008', system: 'http://snomed.info/sct', display: 'Collection of coughed sputum' },
    { code: '278450005', system: 'http://snomed.info/sct', display: 'Finger-prick sampling' }
  ];

  // Collection Fasting Status options from HL7 v2-0916 ValueSet
  // https://terminology.hl7.org/5.3.0/ValueSet-v2-0916.html
  // System: http://terminology.hl7.org/CodeSystem/v2-0916
  collectionFastingStatusOptions = [
    { code: 'F', system: 'http://terminology.hl7.org/CodeSystem/v2-0916', display: 'Patient was fasting prior to the procedure.' },
    { code: 'NF', system: 'http://terminology.hl7.org/CodeSystem/v2-0916', display: 'The patient indicated they did not fast prior to the procedure.' },
    { code: 'NG', system: 'http://terminology.hl7.org/CodeSystem/v2-0916', display: 'Not Given - Patient was not asked at the time of the procedure.' },
    { code: 'FNA', system: 'http://terminology.hl7.org/CodeSystem/v2-0916', display: 'Fasting not asked of the patient at time of procedure.' }
  ];

  // Processing Procedure options from FHIR Specimen Processing Procedure ValueSet
  // https://hl7.org/fhir/R4/valueset-specimen-processing-procedure.html
  // System: http://terminology.hl7.org/CodeSystem/v2-0373
  processingProcedureOptions = [
    { code: 'ACID', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Acidification' },
    { code: 'ALK', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Alkalization' },
    { code: 'DEFB', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Defibrination' },
    { code: 'FILT', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Filtration' },
    { code: 'LDLP', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'LDL Precipitation' },
    { code: 'NEUT', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Neutralization' },
    { code: 'RECA', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Recalification' },
    { code: 'UFIL', system: 'http://terminology.hl7.org/CodeSystem/v2-0373', display: 'Ultrafiltration' }
  ];

  // Container Type options from HL7 Europe Laboratory Specimen Container ValueSet
  // https://hl7.eu/fhir/laboratory/0.1.1/ValueSet-lab-specimenContainer-eu-lab.html
  // System: http://snomed.info/sct
  containerTypeOptions = [
    { code: '702290003', system: 'http://snomed.info/sct', display: 'Cervical cytology microscopy slide' },
    { code: '706057008', system: 'http://snomed.info/sct', display: 'Cytology specimen container' },
    { code: '706052002', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube' },
    { code: '702292006', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube, K3EDTA/sodium fluoride' },
    { code: '767387006', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube with citrate and theophylline and adenosine and dipyramidole' },
    { code: '767384004', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube with clot activator' },
    { code: '767390000', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube with heparin lithium and gel separator' },
    { code: '767382000', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube with heparin sodium' },
    { code: '767660003', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube with sodium fluoride' },
    { code: '767389009', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube with tripotassium and ethylene diamine tetraacetic acid and aprotinin' },
    { code: '702279008', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube, gel separator' },
    { code: '702293001', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube, K2EDTA/aprotinin' },
    { code: '702278000', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube, no additive/metal-free' },
    { code: '702280006', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube, RNA stabiliser' },
    { code: '702281005', system: 'http://snomed.info/sct', display: 'Evacuated blood collection tube, thrombin/clot activator/gel separator' },
    { code: '702310001', system: 'http://snomed.info/sct', display: 'Evacuated saliva specimen container, sodium azide' },
    { code: '706056004', system: 'http://snomed.info/sct', display: 'Evacuated urine specimen container' },
    { code: '702302002', system: 'http://snomed.info/sct', display: 'Evacuated urine specimen container, boric acid (H3BO3)' },
    { code: '702288004', system: 'http://snomed.info/sct', display: 'Evacuated urine specimen container, boric acid (H3BO3)/sodium formate' },
    { code: '702289007', system: 'http://snomed.info/sct', display: 'Evacuated urine specimen container, ethyl paraben/sodium propionate/chlorhexidine' },
    { code: '702303007', system: 'http://snomed.info/sct', display: 'Evacuated urine specimen container, multiple preservative' },
    { code: '702308003', system: 'http://snomed.info/sct', display: 'Evacuated urine specimen container, no additive' },
    { code: '706047007', system: 'http://snomed.info/sct', display: 'Fecal specimen container' },
    { code: '706053007', system: 'http://snomed.info/sct', display: 'General specimen container' },
    { code: '702268003', system: 'http://snomed.info/sct', display: 'General specimen container, no additive, non-sterile' },
    { code: '702269006', system: 'http://snomed.info/sct', display: 'General specimen container, no additive, sterile' },
    { code: '874799005', system: 'http://snomed.info/sct', display: 'Microbial cryotube' },
    { code: '706050005', system: 'http://snomed.info/sct', display: 'Microcapillary blood collection tube' },
    { code: '702275002', system: 'http://snomed.info/sct', display: 'Microcapillary blood collection tube, ammonium heparin' },
    { code: '702276001', system: 'http://snomed.info/sct', display: 'Microcapillary blood collection tube, K2EDTA' },
    { code: '702277005', system: 'http://snomed.info/sct', display: 'Microcapillary blood collection tube, no additive' },
    { code: '702304001', system: 'http://snomed.info/sct', display: 'Microcapillary blood transfer tube, clot activator' },
    { code: '702306004', system: 'http://snomed.info/sct', display: 'Microcapillary blood transfer tube, EDTA' },
    { code: '702307008', system: 'http://snomed.info/sct', display: 'Microcapillary blood transfer tube, heparin' },
    { code: '702305000', system: 'http://snomed.info/sct', display: 'Microcapillary sodium fluoride blood transfer tube' },
    { code: '702224000', system: 'http://snomed.info/sct', display: 'Midstream urine specimen container' },
    { code: '706051009', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube' },
    { code: '702283008', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube with gel separator' },
    { code: '702297000', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, clot activator' },
    { code: '702295008', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, clot activator/gel separator' },
    { code: '702282003', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, EDTA' },
    { code: '702299002', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, K2EDTA' },
    { code: '702298005', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, K3EDTA' },
    { code: '702284002', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, lithium heparin' },
    { code: '702300005', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, lithium heparin/gel separator, non-sterile' },
    { code: '702285001', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, lithium heparin/gel separator, sterile' },
    { code: '702286000', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, NaEDTA/sodium fluoride' },
    { code: '702256007', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, no additive' },
    { code: '702287009', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, potassium oxalate/sodium fluoride' },
    { code: '702296009', system: 'http://snomed.info/sct', display: 'Non-evacuated blood collection tube, sodium citrate' },
    { code: '702264001', system: 'http://snomed.info/sct', display: 'Non-sterile urine specimen container IVD' },
    { code: '702309006', system: 'http://snomed.info/sct', display: 'Saliva specimen container IVD, no additive' },
    { code: '706058003', system: 'http://snomed.info/sct', display: 'Secretory specimen container' },
    { code: '706046003', system: 'http://snomed.info/sct', display: 'Specimen receptacle' },
    { code: '702223006', system: 'http://snomed.info/sct', display: 'Sputum specimen container' },
    { code: '702244006', system: 'http://snomed.info/sct', display: 'Sterile urine specimen container' },
    { code: '702232008', system: 'http://snomed.info/sct', display: 'Sweat specimen container IVD' },
    { code: '702294007', system: 'http://snomed.info/sct', display: 'Syringe-blood collection tube transfer' },
    { code: '706054001', system: 'http://snomed.info/sct', display: 'Urine specimen container' },
    { code: '767385003', system: 'http://snomed.info/sct', display: 'Aerobic blood culture bottle' },
    { code: '767383005', system: 'http://snomed.info/sct', display: 'Anaerobic blood culture bottle (physical object)' }
  ];

  // Specimen Condition options from HL7 v2-0493 ValueSet
  // https://terminology.hl7.org/5.3.0/ValueSet-v2-0493.html
  // System: http://terminology.hl7.org/CodeSystem/v2-0493
  conditionOptions = [
    { code: 'AUT', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Autolyzed' },
    { code: 'CLOT', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Clotted' },
    { code: 'CON', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Contaminated' },
    { code: 'COOL', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Cool' },
    { code: 'FROZ', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Frozen' },
    { code: 'HEM', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Hemolyzed' },
    { code: 'LIVE', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Live' },
    { code: 'ROOM', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Room temperature' },
    { code: 'SNR', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Sample not received' },
    { code: 'CFU', system: 'http://terminology.hl7.org/CodeSystem/v2-0493', display: 'Centrifuged' }
  ];

  // Specimen Type options from eHDSI Laboratory Specimen Type ValueSet
  // https://fhir.ehdsi.eu/laboratory/ValueSet-eHDSILabSpecimenType.html
  // System: http://snomed.info/sct
  typeOptions = [
    { code: '119376003', system: 'http://snomed.info/sct', display: 'Tissue specimen' },
    { code: '122571007', system: 'http://snomed.info/sct', display: 'Pericardial fluid specimen' },
    { code: '119297000', system: 'http://snomed.info/sct', display: 'Blood specimen' },
    { code: '418564007', system: 'http://snomed.info/sct', display: 'Pleural fluid specimen' },
    { code: '122554006', system: 'http://snomed.info/sct', display: 'Capillary blood specimen' },
    { code: '258450006', system: 'http://snomed.info/sct', display: 'Cerebrospinal fluid specimen' },
    { code: '119327009', system: 'http://snomed.info/sct', display: 'Nail specimen' },
    { code: '119361006', system: 'http://snomed.info/sct', display: 'Plasma specimen' },
    { code: '119334006', system: 'http://snomed.info/sct', display: 'Sputum specimen' },
    { code: '119339001', system: 'http://snomed.info/sct', display: 'Stool specimen' },
    { code: '122552005', system: 'http://snomed.info/sct', display: 'Arterial blood specimen' },
    { code: '119341000', system: 'http://snomed.info/sct', display: 'Bile specimen' },
    { code: '122555007', system: 'http://snomed.info/sct', display: 'Venous blood specimen' },
    { code: '119342007', system: 'http://snomed.info/sct', display: 'Saliva specimen' },
    { code: '122575003', system: 'http://snomed.info/sct', display: 'Urine specimen' },
    { code: '309051001', system: 'http://snomed.info/sct', display: 'Body fluid specimen' },
    { code: '119351004', system: 'http://snomed.info/sct', display: 'Erythrocyte specimen' },
    { code: '119364003', system: 'http://snomed.info/sct', display: 'Serum specimen' },
    { code: '119312009', system: 'http://snomed.info/sct', display: 'Catheter tip submitted as specimen' },
    { code: '258529004', system: 'http://snomed.info/sct', display: 'Throat swab' },
    { code: '119323008', system: 'http://snomed.info/sct', display: 'Pus specimen' },
    { code: '258607008', system: 'http://snomed.info/sct', display: 'Bronchoalveolar lavage fluid specimen' },
    { code: '122556008', system: 'http://snomed.info/sct', display: 'Cord blood specimen' },
    { code: '258530009', system: 'http://snomed.info/sct', display: 'Urethral swab' },
    { code: '440500007', system: 'http://snomed.info/sct', display: 'Dried blood spot specimen' },
    { code: '258574006', system: 'http://snomed.info/sct', display: 'Mid-stream urine specimen' },
    { code: '119332005', system: 'http://snomed.info/sct', display: 'Synovial fluid specimen' },
    { code: '258455001', system: 'http://snomed.info/sct', display: 'Drainage fluid specimen' },
    { code: '119371008', system: 'http://snomed.info/sct', display: 'Specimen from abscess' },
    { code: '168139001', system: 'http://snomed.info/sct', display: 'Peritoneal fluid specimen' },
    { code: '258528007', system: 'http://snomed.info/sct', display: 'Rectal swab' },
    { code: '258591005', system: 'http://snomed.info/sct', display: 'White blood cell specimen' },
    { code: '432825001', system: 'http://snomed.info/sct', display: 'Body secretion specimen' },
    { code: '258503004', system: 'http://snomed.info/sct', display: 'Skin swab' },
    { code: '119318008', system: 'http://snomed.info/sct', display: 'Water specimen' },
    { code: '122565001', system: 'http://snomed.info/sct', display: 'Urinary catheter specimen' },
    { code: '309210009', system: 'http://snomed.info/sct', display: 'Esophageal brushings specimen' },
    { code: '708049000', system: 'http://snomed.info/sct', display: 'Plasma specimen with ethylenediamine tetraacetic acid' },
    { code: '440473005', system: 'http://snomed.info/sct', display: 'Contact lens submitted as specimen' },
    { code: '446846006', system: 'http://snomed.info/sct', display: 'Urine specimen obtained via indwelling urinary catheter' },
    { code: '258441009', system: 'http://snomed.info/sct', display: 'Exudate specimen' },
    { code: '119350003', system: 'http://snomed.info/sct', display: 'Calculus specimen' },
    { code: '119329007', system: 'http://snomed.info/sct', display: 'Colostrum specimen' },
    { code: '258459007', system: 'http://snomed.info/sct', display: 'Gastric fluid specimen' },
    { code: '258603007', system: 'http://snomed.info/sct', display: 'Respiratory sample' },
    { code: '309176002', system: 'http://snomed.info/sct', display: 'Bronchial brushings specimen' },
    { code: '119300005', system: 'http://snomed.info/sct', display: 'Specimen from blood product' },
    { code: '439961009', system: 'http://snomed.info/sct', display: 'Implant submitted as specimen' },
    { code: '119336008', system: 'http://snomed.info/sct', display: 'Exhaled air specimen' },
    { code: '258482009', system: 'http://snomed.info/sct', display: 'Vesicle fluid specimen' },
    { code: '258498002', system: 'http://snomed.info/sct', display: 'Conjunctival swab' },
    { code: '122572000', system: 'http://snomed.info/sct', display: 'Vomitus specimen' },
    { code: '258500001', system: 'http://snomed.info/sct', display: 'Nasopharyngeal swab' },
    { code: '168141000', system: 'http://snomed.info/sct', display: 'Nasal fluid specimen' },
    { code: '257261003', system: 'http://snomed.info/sct', display: 'Swab' },
    { code: '258411007', system: 'http://snomed.info/sct', display: 'Nasopharyngeal aspirate' },
    { code: '708048008', system: 'http://snomed.info/sct', display: 'Plasma specimen with citrate' },
    { code: '258415003', system: 'http://snomed.info/sct', display: 'Biopsy sample' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<SpecimenFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog
  ) {
    this.specimenForm = this.createForm();
    // Check if data contains viewOnly flag
    if (this.data && typeof this.data === 'object') {
      if ('viewOnly' in this.data) {
        this.isViewOnly = this.data.viewOnly === true;
      }
      if (this.isViewOnly) {
        this.specimenForm.disable();
      }
    }
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    // Load data after view is initialized to ensure all form controls are ready
    if (this.data) {
      const dataToLoad = (this.data && typeof this.data === 'object' && 'specimen' in this.data) ? this.data.specimen : this.data;
      this.loadFormData(dataToLoad);
      // Disable form if viewOnly mode
      if (this.isViewOnly) {
        this.specimenForm.disable();
      }
    }
  }

  private loadFormData(data: SpecimenData): void {
    // Use setTimeout to ensure form controls are fully initialized, especially for autocomplete-binding
    setTimeout(() => {
      // Find matching objects from options arrays for mat-select components
      // mat-select compares objects by reference, so we need to find the exact object from the options array
      const matchedType = data.type && data.type.code ? this.typeOptions.find(opt => opt.code === data.type!.code) : null;
      const matchedCollectionMethod = data.collectionMethod && data.collectionMethod.code ? this.collectionMethodOptions.find(opt => opt.code === data.collectionMethod!.code) : null;
      const matchedFastingStatus = data.collectionFastingStatus && data.collectionFastingStatus.code ? this.collectionFastingStatusOptions.find(opt => opt.code === data.collectionFastingStatus!.code) : null;
      const matchedProcessingProcedure = data.processingProcedure && data.processingProcedure.code ? this.processingProcedureOptions.find(opt => opt.code === data.processingProcedure!.code) : null;
      const matchedContainerType = data.containerType && data.containerType.code ? this.containerTypeOptions.find(opt => opt.code === data.containerType!.code) : null;
      const matchedCondition = data.condition && data.condition.code ? this.conditionOptions.find(opt => opt.code === data.condition!.code) : null;

      this.specimenForm.patchValue({
        status: data.status || '',
        type: matchedType || null,
        receivedTime: data.receivedTime ? new Date(data.receivedTime) : null,
        collectionBodySite: data.collectionBodySite || null,
        collectionMethod: matchedCollectionMethod || null,
        collectionFastingStatus: matchedFastingStatus || null,
        processingProcedure: matchedProcessingProcedure || null,
        containerType: matchedContainerType || null,
        condition: matchedCondition || null
      }, { emitEvent: false });
      
      // Explicitly set value for autocomplete-binding (collectionBodySite)
      // The autocomplete-binding component needs the full object with code and display
      if (data.collectionBodySite) {
        const bodySiteControl = this.specimenForm.get('collectionBodySite');
        if (bodySiteControl) {
          bodySiteControl.setValue(data.collectionBodySite, { emitEvent: false });
        }
      }
    }, 100);
  }

  private createForm(): FormGroup {
    return this.fb.group({
      status: ['', Validators.required],
      type: [null, Validators.required],
      receivedTime: [null],
      collectionBodySite: [null],
      collectionMethod: [null],
      collectionFastingStatus: [null],
      processingProcedure: [null],
      containerType: [null],
      condition: [null]
    });
  }

  onCollectionBodySiteSelected(concept: any): void {
    // The autocomplete-binding component implements ControlValueAccessor
    // so it will automatically update the form control value
    // This handler is just for any additional logic if needed
  }

  onSubmit(): void {
    if (this.specimenForm.valid) {
      const formData = this.specimenForm.value as SpecimenData;
      this.dialogRef.close(formData);
    } else {
      Object.keys(this.specimenForm.controls).forEach(key => {
        this.specimenForm.get(key)?.markAsTouched();
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getStatusDefinition(code: string): string {
    const status = this.statusOptions.find(opt => opt.code === code);
    return status ? status.definition : '';
  }

  openValuesetDialog(valuesetUrl: string, fieldName: string, dialogTitle?: string): void {
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      autoFocus: false,
      restoreFocus: true,
      data: { url: valuesetUrl, fieldName: fieldName, dialogTitle: dialogTitle },
      panelClass: 'valueset-dialog-container'
    });
  }
}
