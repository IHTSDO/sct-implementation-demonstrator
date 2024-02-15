import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';
import { saveAs } from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
  selector: 'app-situation-map',
  templateUrl: './situation-map.component.html',
  styleUrls: ['./situation-map.component.css']
})
export class SituationMapComponent implements OnInit {

  selectedSituation: any;
  fhirRepresentation: any;
  fhirRepresentationString: string = '{}';
  resourceType: 'Condition' | 'Observation' | 'FamilyMemberHistory' | undefined;


  situationsBinding: any = {
    title: 'Finding with explicit context',
    type: 'Autocomplete',
    ecl: `<< 413350009 |Finding with explicit context (situation)|`,
    value: '',
    note: 'Select a finding with explicit context'
  };

  SituationConstants: any = {
    KnownPresent: { code: '410515003', display: 'Known present', selfAndDescendants: [] },
    KnownAbsent: { code: '410516002', display: 'Known absent', selfAndDescendants: [] },
    SubjectOfRecord: { code: '410604004', display: 'Subject of record', selfAndDescendants: [] },
    PersonInTheFamily: { code: '303071001', display: 'Person in the family', selfAndDescendants: [] },
    InThePast: { code: '410513005', display: 'In the past', selfAndDescendants: [] },
    CurrentOrSpecifiedTime: { code: '410512000', display: 'Current or specified time', selfAndDescendants: [] },
    KnownPossible: { code: '410590009', display: 'Known possible', selfAndDescendants: [] },
  };

  examples: any[] = [
    { "code": "160377001", "display": "Family history of asthma" },
    { "code": "12147341000119108", "display": "History of burn" },
    { "code": "428942009", "display": "History of fall" },
    { "code": "300890009", "display": "Swelling absent" },
    { "code": "162057007", "display": "Nausea present" },
    { "code": "401204006", "display": "Suspected autism" }
  ];

  displayedColumns: string[] = ['type', 'targetCode', 'targetDisplay'];
  dataSource: any[] = [];

  constructor( private terminologyService: TerminologyService, private clipboard: Clipboard) { }

  ngOnInit(): void {
    this.loadOrUpdateConstants();
  }

  async loadOrUpdateConstants() {
    let cachedConstants = localStorage.getItem('SituationConstants');
    if (cachedConstants) {
      this.SituationConstants = JSON.parse(cachedConstants);
      console.log('Loaded constants from cache.');
    } else {
      await this.updateConstantDescendants();
      localStorage.setItem('SituationConstants', JSON.stringify(this.SituationConstants));
      console.log('Updated constants and cached them.');
    }
  }

  async updateConstantDescendants() {
    for (const key in this.SituationConstants) {
      if (Object.prototype.hasOwnProperty.call(this.SituationConstants, key)) {
        const constant = this.SituationConstants[key];
        let descendants = await lastValueFrom(this.terminologyService.expandValueSet('<< ' + constant.code, '', 0, 1000));
        constant.selfAndDescendants = descendants.expansion.contains.map((concept: any) => concept.code);
      }
    }
  }

  async convertSituationToFhir(situation: any) {
    this.selectedSituation = situation;
    this.fhirRepresentation = null;
    this.fhirRepresentationString = 'Loading...';
    this.dataSource = [];
    this.resourceType = undefined;

    let concept = await lastValueFrom(this.terminologyService.lookupConcept(situation.code));
    let normalForm = this.terminologyService.getNormalForm(concept);
    let normalFormFhir = this.terminologyService.parseNormmalForm(normalForm);

    let findingContextValue: any;
    let subjectRelationshipContextValue: any;
    let temporalContextValue: any;
    let associatedFinding: any;

    normalFormFhir.groups.forEach((group: any[]) => {
      const subjectRelationshipContext = group.find((relationship) => relationship.type.code === "408732007");
      if (subjectRelationshipContext) {
        this.dataSource = [...this.dataSource, subjectRelationshipContext];
        subjectRelationshipContextValue = subjectRelationshipContext.target;
      }
      const findingContext = group.find((relationship) => relationship.type.code === "408729009");
      if (findingContext) {
        this.dataSource = [...this.dataSource, findingContext];
        findingContextValue = findingContext.target;
      }
      const temporalContext = group.find((relationship) => relationship.type.code === "408731000");
      if (temporalContext) {
        this.dataSource = [...this.dataSource, temporalContext];
        temporalContextValue = temporalContext.target;
      }
      const associatedFindingRelationship = group.find((relationship) => relationship.type.code === "246090004");
      if (associatedFindingRelationship) {
        this.dataSource = [...this.dataSource, associatedFindingRelationship];
        associatedFinding = associatedFindingRelationship.target;
      }
    });

    if (associatedFinding) {
      const isKnownPresent = this.SituationConstants.KnownPresent.selfAndDescendants.includes(findingContextValue?.code);
      const isSubjectOfRecord = this.SituationConstants.SubjectOfRecord.selfAndDescendants.includes(subjectRelationshipContextValue?.code);
      const isInThePast = this.SituationConstants.InThePast.selfAndDescendants.includes(temporalContextValue?.code);
      const isKnownAbsent = this.SituationConstants.KnownAbsent.selfAndDescendants.includes(findingContextValue?.code);
      const isKnownPossible = this.SituationConstants.KnownPossible.selfAndDescendants.includes(findingContextValue?.code);
      const isCurrentOrSpecifiedTime = this.SituationConstants.CurrentOrSpecifiedTime.selfAndDescendants.includes(temporalContextValue?.code);
      const isPersonInTheFamily = this.SituationConstants.PersonInTheFamily.selfAndDescendants.includes(subjectRelationshipContextValue?.code);
    
      if (isKnownPresent && isSubjectOfRecord && isInThePast) {
        this.updateFhirRepresentation(this.createFhirCondition(associatedFinding, 'inactive'));
      } else if (isKnownPresent && isSubjectOfRecord && isCurrentOrSpecifiedTime) {
        this.updateFhirRepresentation(this.createFhirCondition(associatedFinding, 'active'));
      } else if (isKnownPossible && isSubjectOfRecord && isCurrentOrSpecifiedTime) {
        this.updateFhirRepresentation(this.createFhirCondition(associatedFinding, 'unconfirmed'));
      } else if (isKnownPresent && isPersonInTheFamily) {  // Should be a mmember of the family
        this.updateFhirRepresentation(this.createFamilyMemberHistoryForFinding(associatedFinding, subjectRelationshipContextValue));
      } else if (isKnownAbsent && isSubjectOfRecord && isCurrentOrSpecifiedTime) {
        this.updateFhirRepresentation(this.createFhirObservationForAbsentFinding(associatedFinding));
      } else {
        this.fhirRepresentationString = 'No FHIR representation for this situation';
      }
    } else {
      this.fhirRepresentationString = 'No FHIR representation for this situation';
    }
  }

  updateFhirRepresentation(fhirResource: any) {
    this.fhirRepresentation = fhirResource;
    this.fhirRepresentationString = JSON.stringify(fhirResource, null, 2);
  }

  findingWithExplicitContextSelected(situation: any) {
    if (situation && situation.code) {
      // console.log('Selected situation:', situation);
      this.convertSituationToFhir(situation);
    }
  }

  createFhirCondition( finding: any, status: string) {
    this.resourceType = 'Condition';
    let fhirCondition = {
      resourceType: 'Condition',
      subject: {
        reference: `Patient/1234`
      },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: status
          }
        ]
      },
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: finding.code,
            display: finding.display
          }
        ]
      }
    };
    return fhirCondition;
  }

  createFhirObservationForAbsentFinding( finding: any ) {
    this.resourceType = 'Observation';
    let fhirObservation = {
      resourceType: 'Observation',
      subject: {
        reference: `Patient/1234`
      },
      status: 'registered',
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: finding.code,
            display: finding.display
          }
        ]
      },
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '410516002',
            display: 'Known absent'
          }
        ]
      }
    };
    return fhirObservation;
  }

  createFamilyMemberHistoryForFinding( finding: any, subjet: any ) {
    this.resourceType = 'FamilyMemberHistory';
    let familyMemberHistory = {
      resourceType: 'FamilyMemberHistory',
      status: 'completed',
      patient: {
        reference: `Patient/1234`
      },
      relationship: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: subjet.code,
            display: subjet.display
          }
        ]
      },
      condition: [
        {
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: finding.code,
                display: finding.display
              }
            ]
          }
        }
      ]
    };
    return familyMemberHistory;
  }

  saveOutput(text: string) {
    var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${this.selectedSituation.display}-fhir.json`);
  }

  copyOutputToClipboard(text: string) {
    this.clipboard.copy(text);
  }

}
