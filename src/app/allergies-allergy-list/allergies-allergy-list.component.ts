import { Component, OnInit } from '@angular/core';
import { HighlightJsDirective } from 'ngx-highlight-js';

@Component({
  selector: 'app-allergies-allergy-list',
  templateUrl: './allergies-allergy-list.component.html',
  styleUrls: ['./allergies-allergy-list.component.css']
})
export class AllergiesAllergyListComponent  implements OnInit{

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
  selectedIntoleranceType = this.intoleranceTypeOptions[0];

  intoleranceCategoryOptions: any = [
    { code: 'food', display: 'Food' },
    { code: 'medication', display: 'Medication' },
    { code: 'environment', display: 'Environment' },
    { code: 'biologic', display: 'Biologic' }
  ];
  selectedIntoleranceCategory: any = null;

  criticalityOptions = [
    { code: 'low', display: 'Low' },
    { code: 'high', display: 'High' },
    { code: 'unable-to-assess', display: 'Unable to Assess' }
  ];
  severityOptions = [
    { code: 'mild', display: 'Mild', sctCode: '255604002', sctDisplay: 'Mild (qualifier value)' },
    { code: 'moderate', display: 'Moderate', sctCode: '6736007', sctDisplay: 'Moderate (qualifier value)' },
    { code: 'severe', display: 'Severe', sctCode: '24484000', sctDisplay: 'Severe (qualifier value)' }
  ];
  codeEcl = '<<418038007 |Propensity to adverse reactions to substance|';
  codeLabel = 'Allergy/Intolerance';
  substanceEcl = '<<105590001 | Substance (substance) | OR <<373873005 | Pharmaceutical / biologic product (product) |';
  substanceLabel = 'Substance';
  reactionManifestationEcl = '<<404684003 |Clinical finding|';
  reactionManifestationLabel = 'Reaction Manifestation';
  routeEcl = '<<284009009 |Route of administration value|';
  routeLabel = 'Exposure Route';

  outputAllergy: any = {
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
      "coding" : [{
        "system" : "http://www.nlm.nih.gov/research/umls/rxnorm",
        "code" : "7980",
        "display" : "Penicillin G"
      }]
    },
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
    }],
    "reaction" : [{
      "manifestation" : [{
        "concept" : {
          "coding" : [{
            "system" : "http://snomed.info/sct",
            "code" : "247472004",
            "display" : "Hives"
          }]
        }
      }]
    }]
  }

  outputAllergyStr = '';

  updateAllergyStr() {
    this.outputAllergy.clinicalStatus.coding = [this.selectedClinicalStatus];
    this.outputAllergy.verificationStatus.coding = [this.selectedVerificationStatus];
    this.outputAllergy.type = this.selectedIntoleranceType.fhirCode;
    this.outputAllergy.category = (this.selectedIntoleranceCategory) ? [this.selectedIntoleranceCategory.code] : [];
    setTimeout(() => {
      this.outputAllergyStr = JSON.stringify(this.outputAllergy, null, 2);
    }
    , 100);
  }

  ngOnInit(): void {
    this.updateAllergyStr();
  }

}
