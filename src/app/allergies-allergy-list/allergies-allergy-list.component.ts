import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { HighlightJsDirective } from 'ngx-highlight-js';
import { TerminologyService } from '../services/terminology.service';
import { lastValueFrom, map } from 'rxjs';
import { FormControl } from '@angular/forms';
import { saveAs } from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
@Component({
  selector: 'app-allergies-allergy-list',
  templateUrl: './allergies-allergy-list.component.html',
  styleUrls: ['./allergies-allergy-list.component.css']
})
export class AllergiesAllergyListComponent  implements OnInit {

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

  codeEcl = '<<418038007 |Propensity to adverse reactions to substance|';
  codeLabel = 'Allergy/Intolerance by propensity';
  selectedCode: any = null;
  selectedCodeTerm = "";
  recordPropensity = false;

  substanceEcl = '<<105590001 | Substance (substance) | OR <<373873005 | Pharmaceutical / biologic product (product) |';
  refinedSubstanceEcl = '<<105590001 | Substance (substance) |';
  substanceLabel = 'Allergy/Intolerance substance or product';
  refinedSubstanceLabel = 'Allergy/Intolerance substance based on propensity';
  selectedSubstanceTerm = "";

  reactionManifestationEcl = '<<404684003 |Clinical finding|';
  reactionManifestationLabel = 'Reaction Manifestation';
  selectedReactionManifestation: any = null;
  selectedReactionManifestationTerm = "";
  routeEcl = '<<284009009 |Route of administration value|';
  routeLabel = 'Exposure Route';
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
        "concept" : {
          "coding" : []
        }
      }],
      "manifestation" : [{
        "concept" : {
          "coding" : []
        }
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

  constructor(private terminologyService: TerminologyService, private clipboard: Clipboard) { }

  ngOnInit(): void {
    this.updateAllergyStr();
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
    this.outputAllergy = JSON.parse(JSON.stringify(this.outputAllergyBase));
    this.updateAllergyStr();
    setTimeout(() => {
      this.selectedReactionManifestationTerm = "";
      this.selectedRouteTerm = "";
    }
    , 100);
    console.log('selectedReactionManifestationTerm',this.selectedReactionManifestationTerm);
  }

  updateAllergyStr() {
    this.outputAllergy.clinicalStatus.coding = [this.selectedClinicalStatus];
    this.outputAllergy.verificationStatus.coding = [this.selectedVerificationStatus];
    this.outputAllergy.type = (this.selectedIntoleranceType) ? this.selectedIntoleranceType.fhirCode : '';
    this.outputAllergy.category = (this.selectedIntoleranceCategories.length) ? this.selectedIntoleranceCategories.map((option: any) => option.display) : [];
    this.outputAllergy.criticality = (this.selectedCriticality?.code) ? [this.selectedCriticality.code] : {};
    this.outputAllergy.reaction[0].severity = (this.selectedSeverity?.code) ? [this.selectedSeverity.code] : "";
    setTimeout(() => {
        this.outputAllergyStr = JSON.stringify(this.outputAllergy, null, 2);
      }
      , 100);
  }

  async substanceSelected(substance: any, clear?: boolean) {
    if (clear) {
      this.selectedCodeTerm = '';
    }
    this.selectedIntoleranceCategories = [];
    substance = Object.assign({ system: 'http://snomed.info/sct' }, substance);
    if (!this.recordPropensity) {
      this.outputAllergy.code.coding = [substance];
    }
    this.outputAllergy.reaction[0].substance[0].concept.coding = [substance];
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

  reactionManifestationSelected(reactionManifestation: any) {
    reactionManifestation = Object.assign({ system: 'http://snomed.info/sct' }, reactionManifestation);
    this.outputAllergy.reaction[0].manifestation[0].concept.coding = [reactionManifestation];
    this.updateAllergyStr();
  }

  propensityRecordChanged() {
    this.outputAllergy.code.coding = [];
    if (this.selectedCode) {
      this.codeSelected(this.selectedCode);
    }
  }

  async codeSelected(code: any) {
    code.system = 'http://snomed.info/sct';
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
        this.refinedSubstanceEcl =`<<${substance.code} | ${substance.display} |`;
        this.substanceSelected(substance);
        this.selectedSubstanceTerm = substance.display;
      } else {
        this.refinedSubstanceEcl = '<<105590001 | Substance (substance) |';
      }
    }
  }

  async getIntoleranceSubstance(allergy: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`${allergy.code} |${allergy.display}| . 47429007 |Associated with (attribute)|`, '');
    return lastValueFrom(response.pipe(map(res => res)));
  }

  async getAllergySubstance(allergy: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`${allergy.code} |${allergy.display}| . 246075003 |Causative agent (attribute)|`, '');
    return lastValueFrom(response.pipe(map(res => res)));
  }

  async getSubstanceCategories(substance: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`> ${substance.code} |${substance.display}| AND (762766007 |Edible substance| OR 115668003 |Biological substance (substance)| OR 410942007 |Drug or medicament (substance)| OR 57795002 |Chemical element|)`, '');
    return lastValueFrom(response.pipe(map(res => res)));
  }

  async getTypes(propensity: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`> ${propensity.code} |${propensity.display}| AND (609433001 |Hypersensitivity disposition| OR 782197009 |Intolerance to substance|)`, '');
    return lastValueFrom(response.pipe(map(res => res)));
  }

  routeSelected(route: any) {
    route = Object.assign({ system: 'http://snomed.info/sct' }, route);
    this.outputAllergy.reaction[0].exposureRoute.coding = [route];
    this.updateAllergyStr();
  }

  saveFhirResource() {
    var blob = new Blob([this.outputAllergyStr], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "AllergyIntolerance.json");
  }

  copyToClipboard(text: string) {
    this.clipboard.copy(text);
  }

}
