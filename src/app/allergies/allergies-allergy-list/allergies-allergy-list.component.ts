import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { HighlightJsDirective } from 'ngx-highlight-js';
import { TerminologyService } from '../../services/terminology.service';
import { lastValueFrom, map } from 'rxjs';
import { FormControl } from '@angular/forms';
import { saveAs } from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
@Component({
    selector: 'app-allergies-allergy-list',
    templateUrl: './allergies-allergy-list.component.html',
    styleUrls: ['./allergies-allergy-list.component.css'],
    standalone: false
})
export class AllergiesAllergyListComponent  implements OnInit {

  @Input() embeddedMode: boolean = false;
  @Output() newProblem = new EventEmitter<any>();
  @Output() allergySaved = new EventEmitter<any>();

  clinicalStatusOptions = [
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: 'active', display: 'Active' },
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: 'inactive', display: 'Inactive' },
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: 'resolved', display: 'Resolved' }
  ];
  selectedClinicalStatus = this.clinicalStatusOptions[0];

  verificationStatusOptions = [
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: 'unconfirmed', display: 'Unconfirmed' },
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: 'presumed', display: 'Presumed' },
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: 'confirmed', display: 'Confirmed' },
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: 'refuted', display: 'Refuted' },
    { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: 'entered-in-error', display: 'Entered in Error' }
  ];
  selectedVerificationStatus = this.verificationStatusOptions[0];

  intoleranceTypeOptions = [
    { system: "http://hl7.org/fhir/allergy-intolerance-type", code: '609433001', display: 'Hypersensitivity disposition (finding)', fhirCode: 'allergy', fhirDisplay: 'Allergy' },
    { system: "http://hl7.org/fhir/allergy-intolerance-type", code: '782197009', display: 'Intolerance to substance (finding)', fhirCode: 'intolerance', fhirDisplay: 'Intolerance' }
  ];
  selectedIntoleranceType: any = null;

  intoleranceCategoryOptions: any = [
    { code: 'food', display: 'Food' },
    { code: 'medication', display: 'Medication' },
    { code: 'environment', display: 'Environment' },
    { code: 'biologic', display: 'Biologic' }
  ];
  selectedIntoleranceCategories: any = [];
  public selectedIntoleranceCategoriesControl = new FormControl(this.selectedIntoleranceCategories);

  criticalityOptions = [
    { code: 'low', display: 'Low Risk' },
    { code: 'high', display: 'High Risk' },
    { code: 'unable-to-assess', display: 'Unable to Assess Risk' }
  ];
  selectedCriticality: any = null;

  severityOptions = [
    { code: 'mild', display: 'Mild', sctCode: '255604002', sctDisplay: 'Mild (qualifier value)' },
    { code: 'moderate', display: 'Moderate', sctCode: '6736007', sctDisplay: 'Moderate (qualifier value)' },
    { code: 'severe', display: 'Severe', sctCode: '24484000', sctDisplay: 'Severe (qualifier value)' }
  ];
  selectedSeverity: any = {};

  codeBinding = { ecl: '<<418038007 |Propensity to adverse reactions to substance| OR <<420134006 |Propensity to adverse reaction (finding)|', title: 'Allergy/Intolerance by propensity' };
  selectedCode: any = null;
  selectedCodeTerm = "";
  recordPropensity = false;

  substanceBinding = { ecl: '<<105590001 | Substance (substance) | OR <<373873005 | Pharmaceutical / biologic product (product) |', title: 'Allergy/Intolerance substance or product' };
  refinedSubstanceBinding = { ecl: '<<105590001 | Substance (substance) |', title: 'Allergy/Intolerance substance based on propensity' };
  selectedSubstanceTerm = "";
  selectedSubstance: any = null;

  selectedReactions: any[] = [
    {
      suibstance: {},
      manifestation: {},
      severity: {},
      route: {}
    }
  ];

  reactionManifestationBinding = { ecl: '<<404684003 |Clinical finding|', title: 'Reaction Manifestation' };
  selectedReactionManifestation: any = null;
  selectedReactionManifestationTerm = "";
  routeBinding = { ecl: '<<284009009 |Route of administration value|', title: 'Exposure Route' };
  selectedRoute: any = null;
  selectedRouteTerm = "";

  outputAllergyBase: any = {
    "resourceType" : "AllergyIntolerance",
    "id" : "medication",
    "text" : {},
    "clinicalStatus" : {
      "coding" : []
    },
    "verificationStatus" : {
      "coding" : []
    },
    "type" : "",
    "category" : [],
    "criticality" : "high",
    "code" : {
      "coding" : []
    },
    "reaction" : [{
      "substance": [{
        "coding" : []
      }],
      "manifestation" : [{
        "coding" : []
      }],
      "exposureRoute" : {
        "coding" : []
      },
      "severity" : ""
    }],
    "patient" : {
      "reference" : "Patient/example"
    },
    "recordedDate" : "2010-03-01",
    "participant" : [{
      "function" : {
        "coding" : [{
          "system" : "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
          "code" : "author",
          "display" : "Author"
        }]
      },
      "actor" : {
        "reference" : "Practitioner/example"
      }
    }]
  }
  outputAllergy: any = JSON.parse(JSON.stringify(this.outputAllergyBase));

  outputAllergyStr = '';

  constructor(private terminologyService: TerminologyService, private clipboard: Clipboard, private _snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.updateAllergyStr();
  }

  onReactionsChange(updatedReactions: any[]) {
    // this.selectedReactions = updatedReactions;
    // Perform any additional logic required when reactions change
    this.updateAllergyStr(); // or any other relevant method
  }

  clear() {
    this.selectedClinicalStatus = this.clinicalStatusOptions[0];
    this.selectedVerificationStatus = this.verificationStatusOptions[0];
    this.selectedIntoleranceType = null;
    this.selectedIntoleranceCategories = [];
    this.selectedIntoleranceCategoriesControl = new FormControl(this.selectedIntoleranceCategories);
    this.selectedCriticality = null;
    this.selectedSeverity = {};
    this.selectedCode = null;
    this.selectedCodeTerm = "";
    this.recordPropensity = false;
    this.selectedSubstanceTerm = "";
    this.selectedReactionManifestation = null;
    this.selectedReactionManifestationTerm = " ";
    this.selectedRoute = null;
    this.selectedRouteTerm = " ";
    this.selectedReactions = [
      {
        suibstance: {},
        manifestation: {},
        severity: {},
        route: {}
      }
    ];
    this.outputAllergy = JSON.parse(JSON.stringify(this.outputAllergyBase));
    this.updateAllergyStr();
    setTimeout(() => {
      this.selectedReactionManifestationTerm = "";
      this.selectedRouteTerm = "";
    }
    , 100);
  }

  updateAllergyStr() {
    this.outputAllergy.clinicalStatus.coding = [this.selectedClinicalStatus];
    this.outputAllergy.verificationStatus.coding = [this.selectedVerificationStatus];
    this.outputAllergy.type = (this.selectedIntoleranceType) ? this.selectedIntoleranceType.fhirCode : '';
    this.outputAllergy.category = (this.selectedIntoleranceCategories.length) ? this.selectedIntoleranceCategories.map((option: any) => option.display) : [];
    this.outputAllergy.criticality = (this.selectedCriticality?.code) ? [this.selectedCriticality.code] : {};
    this.outputAllergy.reaction = [];
    this.selectedReactions.forEach((reaction: any) => {
      if (reaction.manifestation.code) { reaction.manifestation.system = 'http://snomed.info/sct'; }
      if (reaction.route.code) { reaction.route.system = 'http://snomed.info/sct'; }
      const newReaction = {
        substance: [{
          coding: [this.selectedSubstance]
        }],
        manifestation: [{
          coding: (reaction.manifestation)? [reaction.manifestation] : [{}]
        }],
        exposureRoute: {
          coding: (reaction.route)? [reaction.route] : [{}]
        },
        severity: (reaction.severity) ? reaction.severity.code : ''
      };
      this.outputAllergy.reaction.push(newReaction);
    });
    setTimeout(() => {
        this.outputAllergyStr = JSON.stringify(this.outputAllergy, null, 2);
      }
      , 100);
  }

  async substanceSelected(substance: any, clear?: boolean) {
    if (clear) {
      this.selectedCodeTerm = '';
    }
    this.selectedSubstance = substance;
    this.selectedIntoleranceCategories = [];
    substance = Object.assign({ system: 'http://snomed.info/sct' }, substance);
    if (!this.recordPropensity) {
      this.outputAllergy.code.coding = [substance];
    }
    this.outputAllergy.reaction[0].substance[0].coding = [substance];
    const categories = await this.getSubstanceCategories(substance);
    // Note: (255620007 |Food (substance)| OR 115668003 |Biological substance (substance)| OR 410942007 |Drug or medicament (substance)|)
    categories?.expansion?.contains?.forEach( (element: any) => {
      if (element.code == '762766007') {
        this.selectedIntoleranceCategories.push(this.intoleranceCategoryOptions[0]);
      } else if (element.code == '115668003') {
        this.selectedIntoleranceCategories.push(this.intoleranceCategoryOptions[3]);
      } else if (element.code == '410942007') {
        this.selectedIntoleranceCategories.push(this.intoleranceCategoryOptions[1]);
      } else if (element.code == '57795002') {
        this.selectedIntoleranceCategories.push(this.intoleranceCategoryOptions[2]);
      }
    });
    this.selectedIntoleranceCategoriesControl.setValue(this.selectedIntoleranceCategories);
    this.updateAllergyStr();
  }

  propensityRecordChanged() {
    this.outputAllergy.code.coding = [];
    if (this.selectedCode) {
      this.codeSelected(this.selectedCode);
    }
  }

  async codeSelected(code: any) {
    code = Object.assign({ system: 'http://snomed.info/sct' }, code);
    if (code) {
      this.selectedCodeTerm = code.display;
      this.selectedCode = code;
      if (this.recordPropensity) {
        this.outputAllergy.code.coding = [code];
      }
      let resType: any = await this.getTypes(code);
      if (resType.expansion?.contains) {
        // set selectedIntoleranceType to the value from intoleranceTypeOptions that matches code
        const type = resType.expansion?.contains[0];
        this.selectedIntoleranceType = this.intoleranceTypeOptions.find((option: any) => option.code === type.code);
      }
  
      let res: any = await this.getAllergySubstance(code);
      if (!res.expansion.contains) {
        res = await this.getIntoleranceSubstance(code);
      }
      if (res.expansion?.contains) {
        const substance = res.expansion?.contains[0];
        this.refinedSubstanceBinding.ecl =`<<${substance.code} | ${substance.display} |`;
        this.substanceSelected(substance);
        this.selectedSubstanceTerm = substance.display;
      } else {
        this.refinedSubstanceBinding.ecl = '<<105590001 | Substance (substance) |';
      }
    }
  }

  async getIntoleranceSubstance(allergy: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`${allergy.code} |${allergy.display}| . 47429007 |Associated with (attribute)|`, '');
    return lastValueFrom(response.pipe(map((res: any) => res)));
  }

  async getAllergySubstance(allergy: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`${allergy.code} |${allergy.display}| . 246075003 |Causative agent (attribute)|`, '');
    return lastValueFrom(response.pipe(map((res: any) => res)));
  }

  async getSubstanceCategories(substance: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`> ${substance.code} |${substance.display}| AND (762766007 |Edible substance| OR 115668003 |Biological substance (substance)| OR 410942007 |Drug or medicament (substance)| OR 57795002 |Chemical element|)`, '');
    return lastValueFrom(response.pipe(map((res: any) => res)));
  }

  async getTypes(propensity: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`> ${propensity.code} |${propensity.display}| AND (609433001 |Hypersensitivity disposition| OR 782197009 |Intolerance to substance|)`, '');
    return lastValueFrom(response.pipe(map((res: any) => res)));
  }

  saveFhirResource() {
    var blob = new Blob([this.outputAllergyStr], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "AllergyIntolerance.json");
  }

  copyToClipboard(text: string) {
    this.clipboard.copy(text);
  }

  addToProblemsList() {
    if (this.selectedCode) {
      this.newProblem.emit(this.selectedCode);
    } else if (this.selectedSubstance && this.selectedIntoleranceType) {
      let pcAllerTerm = '';
      if (this.selectedIntoleranceType.code === '609433001') {
        pcAllerTerm = 'Allergy to ';
      } else if (this.selectedIntoleranceType.code === '782197009') {
        pcAllerTerm = 'Intolerance to ';
      }
      pcAllerTerm += this.selectedSubstance.display;
      let newPostcoodinatedProblem = {
        code: `${this.selectedIntoleranceType.code}:246075003=${this.selectedSubstance.code}`,
        display: pcAllerTerm,
        substance: this.selectedSubstance
      }
      this.newProblem.emit(newPostcoodinatedProblem);
    } else {
      // Nothing to add
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 1 * 1000,
        data: "Nothing to add to problem list",
        panelClass: ['yellow-snackbar']
      });
    }
    this.clear();
  }

  saveAllergy() {
    // Emit only the FHIR resource when in embedded mode
    this.allergySaved.emit(this.outputAllergy);
    
    // Show success message
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 2 * 1000,
      data: "Allergy saved successfully",
      panelClass: ['success-snackbar']
    });

    // Clear the form
    this.clear();
  }

}
