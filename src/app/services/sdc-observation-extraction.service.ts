import { Injectable } from '@angular/core';
import type { FhirObservation } from '../model';

const EXT_OBSERVATION_EXTRACT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract';

export interface ObservationExtractionContext {
  patientId: string;
  patientDisplay?: string;
  /** Encounter the answers were recorded in. Extracted Observations reference it. */
  encounterId?: string;
  /** Defaults to now. */
  effectiveDateTime?: string;
}

/**
 * SDC observation-based extraction: every answer of a Questionnaire item flagged with
 * `sdc-questionnaire-observationExtract` and carrying an `item.code` becomes one
 * Observation, coded with the item's code. A repeating item gives one Observation per
 * answer. It works on a FHIR Questionnaire and a FHIR QuestionnaireResponse and knows
 * nothing about any particular form.
 */
@Injectable({ providedIn: 'root' })
export class SdcObservationExtractionService {

  extract(questionnaire: any, response: any, context: ObservationExtractionContext): FhirObservation[] {
    const answersByLinkId = new Map<string, any[]>();
    this.collectAnswers(response?.item || [], answersByLinkId);

    const effectiveDateTime = context.effectiveDateTime || new Date().toISOString();
    const observations: FhirObservation[] = [];

    for (const item of this.extractableItems(questionnaire?.item || [])) {
      for (const answer of answersByLinkId.get(item.linkId) || []) {
        const value = this.toObservationValue(answer);
        if (!value) {
          continue;
        }
        observations.push({
          resourceType: 'Observation',
          id: `observation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          status: 'final',
          code: {
            coding: item.code.map((coding: any) => ({ system: coding.system, code: coding.code, display: coding.display })),
            text: item.text
          },
          subject: {
            reference: `Patient/${context.patientId}`,
            ...(context.patientDisplay ? { display: context.patientDisplay } : {})
          },
          ...(context.encounterId ? { encounter: { reference: `Encounter/${context.encounterId}` } } : {}),
          effectiveDateTime,
          issued: effectiveDateTime,
          ...value
        });
      }
    }

    return observations;
  }

  /** `system|code` keys of every item the questionnaire extracts into Observations. */
  extractableCodeKeys(questionnaire: any): Set<string> {
    const keys = new Set<string>();
    for (const item of this.extractableItems(questionnaire?.item || [])) {
      for (const coding of item.code) {
        keys.add(`${coding.system}|${coding.code}`);
      }
    }
    return keys;
  }

  private extractableItems(items: any[]): any[] {
    const result: any[] = [];
    for (const item of items) {
      const flagged = (item.extension || []).some((extension: any) =>
        extension.url === EXT_OBSERVATION_EXTRACT &&
        (extension.valueBoolean === true || (typeof extension.valueCode === 'string' && extension.valueCode.trim().length > 0))
      );
      if (flagged && Array.isArray(item.code) && item.code.length > 0) {
        result.push(item);
      }
      if (Array.isArray(item.item)) {
        result.push(...this.extractableItems(item.item));
      }
    }
    return result;
  }

  private collectAnswers(responseItems: any[], answersByLinkId: Map<string, any[]>): void {
    for (const responseItem of responseItems) {
      if (Array.isArray(responseItem.answer) && responseItem.answer.length) {
        answersByLinkId.set(responseItem.linkId, [...(answersByLinkId.get(responseItem.linkId) || []), ...responseItem.answer]);
        for (const answer of responseItem.answer) {
          if (Array.isArray(answer.item)) {
            this.collectAnswers(answer.item, answersByLinkId);
          }
        }
      }
      if (Array.isArray(responseItem.item)) {
        this.collectAnswers(responseItem.item, answersByLinkId);
      }
    }
  }

  private toObservationValue(answer: any): Partial<FhirObservation> | null {
    if (answer.valueCoding) {
      const { system, code, display } = answer.valueCoding;
      return { valueCodeableConcept: { coding: [{ system, code, display }], text: display } };
    }
    if (answer.valueQuantity) {
      return { valueQuantity: answer.valueQuantity };
    }
    if (typeof answer.valueBoolean === 'boolean') {
      return { valueBoolean: answer.valueBoolean };
    }
    if (typeof answer.valueInteger === 'number') {
      return { valueInteger: answer.valueInteger };
    }
    if (typeof answer.valueDecimal === 'number') {
      return { valueQuantity: { value: answer.valueDecimal } };
    }
    if (answer.valueDateTime || answer.valueDate) {
      return { valueDateTime: answer.valueDateTime || answer.valueDate };
    }
    if (typeof answer.valueString === 'string' && answer.valueString.trim()) {
      return { valueString: answer.valueString };
    }
    return null;
  }
}
