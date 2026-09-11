import { Component } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';
import { saveAs } from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  CONTEXT_ATTRIBUTES,
  CONTEXT_CONCEPTS,
  ContextKey,
  SituationDomain,
  TRANSFORMATION_RULES,
  TransformationRule,
  buildFhirResource,
} from './context-transformation-rules';

@Component({
    selector: 'app-situation-map',
    templateUrl: './situation-map.component.html',
    styleUrls: ['./situation-map.component.css'],
    standalone: false
})
export class SituationMapComponent {

  selectedSituation: any;
  fhirRepresentation: any;
  fhirRepresentationString: string = '';
  resourceType: string | undefined;

  loading = false;
  noMappingFound = false;

  // The full decision table, exposed for the "transformation rules" view.
  readonly rules: TransformationRule[] = TRANSFORMATION_RULES;

  // Structured context axes extracted from the situation's normal form, used to
  // render the "detected context" step of the transformation pipeline.
  contextAxes: {
    domain?: SituationDomain;
    associated?: any;        // associated finding or procedure
    context?: any;           // finding context or procedure context value
    subjectRelationship?: any;
    temporalContext?: any;
  } = {};

  // Which row of the decision table fired for the current situation.
  matchedRule: TransformationRule | null = null;

  situationsBinding: any = {
    title: 'Situation with explicit context',
    type: 'Autocomplete',
    ecl: `<< 413350009 |Finding with explicit context (situation)| OR << 129125009 |Procedure with explicit context (situation)|`,
    value: '',
    note: 'Select a situation with explicit context'
  };

  examples: any[] = [
    { code: '160377001', display: 'Family history of asthma' },
    { code: '428942009', display: 'History of fall' },
    { code: '300890009', display: 'Swelling absent' },
    { code: '162057007', display: 'Nausea present' },
    { code: '401204006', display: 'Suspected autism' },
    { code: '428251008', display: 'History of appendectomy' },
    { code: '164853006', display: 'ECG not done' },
    { code: '703993001', display: 'Colonoscopy planned' },
    { code: '160274005', display: 'No family history of diabetes mellitus' },
  ];

  constructor( private terminologyService: TerminologyService, private clipboard: Clipboard) { }

  /**
   * True when `value` is subsumed by (self or descendant of) the given context
   * concept. Resolved per pair via the terminology server's subsumption check
   * (cached, with an exact-code fast path), so no bulk descendant expansion is
   * needed.
   */
  private isSubsumedBy(value: any, key: ContextKey | null): Promise<boolean> {
    if (!key) {
      return Promise.resolve(true); // axis not constrained
    }
    if (!value?.code) {
      return Promise.resolve(false);
    }
    return lastValueFrom(this.terminologyService.isSubsumed(CONTEXT_CONCEPTS[key].code, value.code));
  }

  async convertSituationToFhir(situation: any) {
    this.selectedSituation = situation;
    this.fhirRepresentation = null;
    this.fhirRepresentationString = '';
    this.contextAxes = {};
    this.matchedRule = null;
    this.resourceType = undefined;
    this.noMappingFound = false;
    this.loading = true;

    try {
      const concept = await lastValueFrom(this.terminologyService.lookupConcept(situation.code));
      const normalForm = this.terminologyService.getNormalForm(concept);
      const normalFormFhir = this.terminologyService.parseNormmalForm(normalForm);

      let findingContextValue: any;
      let procedureContextValue: any;
      let subjectRelationshipContextValue: any;
      let temporalContextValue: any;
      let associatedFinding: any;
      let associatedProcedure: any;

      normalFormFhir.groups.forEach((group: any[]) => {
        const byType = (code: string) => group.find((r) => r.type.code === code)?.target;
        subjectRelationshipContextValue = byType(CONTEXT_ATTRIBUTES.subjectRelationshipContext) ?? subjectRelationshipContextValue;
        temporalContextValue = byType(CONTEXT_ATTRIBUTES.temporalContext) ?? temporalContextValue;
        findingContextValue = byType(CONTEXT_ATTRIBUTES.findingContext) ?? findingContextValue;
        procedureContextValue = byType(CONTEXT_ATTRIBUTES.procedureContext) ?? procedureContextValue;
        associatedFinding = byType(CONTEXT_ATTRIBUTES.associatedFinding) ?? associatedFinding;
        associatedProcedure = byType(CONTEXT_ATTRIBUTES.associatedProcedure) ?? associatedProcedure;
      });

      // Determine the domain from which associated concept is present.
      const domain: SituationDomain | undefined = associatedProcedure
        ? 'procedure'
        : associatedFinding
          ? 'finding'
          : undefined;
      const associated = domain === 'procedure' ? associatedProcedure : associatedFinding;
      const contextValue = domain === 'procedure' ? procedureContextValue : findingContextValue;

      this.contextAxes = {
        domain,
        associated,
        context: contextValue,
        subjectRelationship: subjectRelationshipContextValue,
        temporalContext: temporalContextValue,
      };

      if (!domain || !associated) {
        this.noMappingFound = true;
        return;
      }

      let rule: TransformationRule | undefined;
      for (const candidate of this.rules) {
        if (candidate.domain !== domain) continue;
        if (!(await this.isSubsumedBy(contextValue, candidate.match.context))) continue;
        if (!(await this.isSubsumedBy(subjectRelationshipContextValue, candidate.match.subject))) continue;
        if (!(await this.isSubsumedBy(temporalContextValue, candidate.match.temporal))) continue;
        rule = candidate;
        break;
      }

      if (!rule) {
        this.noMappingFound = true;
        return;
      }

      this.matchedRule = rule;
      const fhirResource = buildFhirResource(rule, {
        associated,
        subject: subjectRelationshipContextValue,
      });

      if (fhirResource) {
        this.resourceType = rule.resource ?? undefined;
        this.updateFhirRepresentation(fhirResource);
      }
      // When rule.resource is null the guide deliberately maps to no resource;
      // matchedRule stays set so the UI can explain that outcome.
    } finally {
      this.loading = false;
    }
  }

  updateFhirRepresentation(fhirResource: any) {
    this.fhirRepresentation = fhirResource;
    this.fhirRepresentationString = JSON.stringify(fhirResource, null, 2);
  }

  findingWithExplicitContextSelected(situation: any) {
    if (situation && situation.code) {
      this.convertSituationToFhir(situation);
    }
  }

  /** Short summary of a rule's FHIR element presets, e.g. "clinicalStatus: inactive". */
  presetLabel(rule: TransformationRule): string {
    const p = rule.presets ?? {};
    const parts: string[] = [];
    if (p.clinicalStatus) parts.push(`clinicalStatus: ${p.clinicalStatus}`);
    if (p.verificationStatus) parts.push(`verificationStatus: ${p.verificationStatus}`);
    if (p.observationStatus) parts.push(`status: ${p.observationStatus}`);
    if (p.procedureStatus) parts.push(`status: ${p.procedureStatus}`);
    if (p.familyHistoryStatus) parts.push(`status: ${p.familyHistoryStatus}`);
    if (p.serviceRequestIntent) parts.push(`intent: ${p.serviceRequestIntent}`);
    if (p.serviceRequestStatus) parts.push(`status: ${p.serviceRequestStatus}`);
    return parts.join(' · ');
  }

  saveOutput(text: string) {
    var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${this.selectedSituation.display}-fhir.json`);
  }

  copyOutputToClipboard(text: string) {
    this.clipboard.copy(text);
  }

}
