import { Injectable } from '@angular/core';
import { PatientService } from './patient.service';
import { Condition, FhirObservation, Patient, QuestionnaireResponse } from '../model';

const EXT_OBSERVATION_LINK_PERIOD =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationLinkPeriod';
const EXT_LAUNCH_CONTEXT =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext';
const EXT_INITIAL_EXPRESSION =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression';

interface ScannedItem {
  linkId: string;
  /** Codes from the questionnaire item's own `code` array (used for Observation lookup). */
  codes: { system: string; code: string }[];
  /** Codings from `answerOption[].valueCoding` (used for Condition lookup on choice items). */
  answerOptionCodings: { system: string; code: string; display?: string }[];
  linkPeriodCutoff: Date | null;
  initialExpression: string | null;
  type: string;
}

@Injectable({ providedIn: 'root' })
export class SdcPopulationService {

  constructor(private patientService: PatientService) {}

  /**
   * Builds a partial QuestionnaireResponse pre-populated from existing patient data.
   * Reads from whichever storage backend is active (localStorage or FHIR).
   * Returns null when no data was found so the caller can skip the options arg to addFormToPage.
   */
  populate(questionnaire: any, patientId: string): any | null {
    if (!questionnaire?.item?.length) {
      return null;
    }

    const scanned = this.scanItems(questionnaire.item);
    const answerMap = new Map<string, any[]>();

    // Strategy 3 first (lowest priority — overridden by fresher data below)
    const qUrl = questionnaire.url as string | undefined;
    if (qUrl) {
      const prevQR = this.findPreviousQR(qUrl, patientId);
      if (prevQR?.item) {
        this.flattenQRItems(prevQR.item, answerMap);
      }
    }

    // Strategy 2: Patient demographics via initialExpression
    const hasPatientContext = this.hasPatientLaunchContext(questionnaire);
    const expressionItems = scanned.filter(i => i.initialExpression);
    if (hasPatientContext && expressionItems.length) {
      const patient = this.patientService.getPatientById(patientId);
      if (patient) {
        this.fillPatientAnswers(expressionItems, patient, answerMap);
      }
    }

    // Strategy 1: observationLinkPeriod items (highest priority)
    const linkPeriodItems = scanned.filter(i => i.linkPeriodCutoff !== null);
    if (linkPeriodItems.length) {
      const choiceItems = linkPeriodItems.filter(
        i => i.type === 'choice' && i.answerOptionCodings.length > 0
      );
      const quantityItems = linkPeriodItems.filter(
        i => i.type !== 'choice' && i.codes.length > 0
      );

      if (choiceItems.length) {
        this.fillConditionAnswers(choiceItems, patientId, answerMap);
      }
      if (quantityItems.length) {
        this.fillObservationAnswers(quantityItems, patientId, answerMap);
      }
    }

    if (answerMap.size === 0) {
      return null;
    }

    const qrItems = this.buildQRItems(questionnaire.item, answerMap);
    if (!qrItems.length) {
      return null;
    }

    return {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      questionnaire: qUrl,
      subject: { reference: `Patient/${patientId}` },
      item: qrItems
    };
  }

  // ─── Item scanning ──────────────────────────────────────────────────────────

  private scanItems(items: any[]): ScannedItem[] {
    const result: ScannedItem[] = [];
    for (const item of items) {
      result.push({
        linkId: item.linkId,
        codes: this.extractItemCodes(item),
        answerOptionCodings: this.extractAnswerOptionCodings(item),
        linkPeriodCutoff: this.extractLinkPeriodCutoff(item),
        initialExpression: this.extractInitialExpression(item),
        type: item.type || 'string'
      });
      if (item.item?.length) {
        result.push(...this.scanItems(item.item));
      }
    }
    return result;
  }

  private extractItemCodes(item: any): { system: string; code: string }[] {
    const codes: { system: string; code: string }[] = [];
    if (Array.isArray(item.code)) {
      for (const c of item.code) {
        if (c.system && c.code) {
          codes.push({ system: c.system, code: c.code });
        }
      }
    }
    if (Array.isArray(item.codeList)) {
      for (const c of item.codeList) {
        if (c.code) {
          codes.push({ system: item.questionCodeSystem || 'http://loinc.org', code: c.code });
        }
      }
    }
    return codes;
  }

  private extractAnswerOptionCodings(item: any): { system: string; code: string; display?: string }[] {
    const result: { system: string; code: string; display?: string }[] = [];
    if (!Array.isArray(item.answerOption)) {
      return result;
    }
    for (const opt of item.answerOption) {
      const c = opt.valueCoding;
      if (c?.system && c?.code) {
        result.push({ system: c.system, code: c.code, display: c.display });
      }
    }
    return result;
  }

  private extractLinkPeriodCutoff(item: any): Date | null {
    const ext = this.findExtension(item, EXT_OBSERVATION_LINK_PERIOD);
    if (!ext?.valueDuration) {
      return null;
    }
    return this.durationToCutoff(ext.valueDuration);
  }

  private extractInitialExpression(item: any): string | null {
    const ext = this.findExtension(item, EXT_INITIAL_EXPRESSION);
    if (ext?.valueExpression?.language === 'text/fhirpath') {
      return ext.valueExpression.expression as string;
    }
    return null;
  }

  private findExtension(item: any, url: string): any | null {
    return (item.extension as any[] | undefined)?.find((e: any) => e.url === url) ?? null;
  }

  private hasPatientLaunchContext(questionnaire: any): boolean {
    return (questionnaire.extension as any[] | undefined)?.some(
      (e: any) =>
        e.url === EXT_LAUNCH_CONTEXT &&
        e.extension?.some((sub: any) => sub.url === 'type' && sub.valueCode === 'Patient')
    ) ?? false;
  }

  // ─── Strategy 1a: Observation-based (numeric/quantity items) ───────────────

  private fillObservationAnswers(
    items: ScannedItem[],
    patientId: string,
    answerMap: Map<string, any[]>
  ): void {
    const observations = this.patientService.getPatientObservations(patientId);

    for (const item of items) {
      // Find the most recent observation matching any of the item's codes within the period
      const matching = observations
        .filter(obs => this.obsMatchesCodes(obs, item.codes) && this.isWithinCutoff(obs, item.linkPeriodCutoff!))
        .sort((a, b) => this.obsDate(b) - this.obsDate(a));

      const obs = matching[0];
      if (!obs) {
        continue;
      }
      const answer = this.obsValueToAnswer(obs);
      if (answer) {
        answerMap.set(item.linkId, [answer]);
      }
    }
  }

  private obsMatchesCodes(obs: FhirObservation, codes: { system: string; code: string }[]): boolean {
    const obsCodes = obs.code?.coding ?? [];
    return codes.some(wanted =>
      obsCodes.some(c => c.system === wanted.system && c.code === wanted.code)
    );
  }

  private isWithinCutoff(obs: FhirObservation, cutoff: Date): boolean {
    const dateStr = obs.effectiveDateTime ?? obs.issued;
    if (!dateStr) {
      return true;
    }
    return new Date(dateStr) >= cutoff;
  }

  private obsDate(obs: FhirObservation): number {
    const dateStr = obs.effectiveDateTime ?? obs.issued;
    return dateStr ? new Date(dateStr).getTime() : 0;
  }

  private obsValueToAnswer(obs: FhirObservation): any | null {
    if (obs.valueQuantity) {
      return { valueQuantity: obs.valueQuantity };
    }
    if (obs.valueCodeableConcept?.coding?.[0]) {
      return { valueCoding: obs.valueCodeableConcept.coding[0] };
    }
    if (typeof (obs as any).valueString === 'string') {
      return { valueString: (obs as any).valueString };
    }
    if (typeof (obs as any).valueBoolean === 'boolean') {
      return { valueBoolean: (obs as any).valueBoolean };
    }
    if (typeof (obs as any).valueInteger === 'number') {
      return { valueInteger: (obs as any).valueInteger };
    }
    if (typeof (obs as any).valueDecimal === 'number') {
      return { valueDecimal: (obs as any).valueDecimal };
    }
    return null;
  }

  // ─── Strategy 1b: Condition-based (choice items) ───────────────────────────

  private fillConditionAnswers(
    items: ScannedItem[],
    patientId: string,
    answerMap: Map<string, any[]>
  ): void {
    const conditions = this.patientService.getPatientConditions(patientId);

    for (const item of items) {
      const answers: any[] = [];

      for (const cond of conditions) {
        if (!this.isConditionWithinCutoff(cond, item.linkPeriodCutoff!)) {
          continue;
        }
        const coding = cond.code?.coding?.[0];
        if (!coding?.code || !coding?.system) {
          continue;
        }
        const match = item.answerOptionCodings.find(
          ao => ao.code === coding.code && ao.system === coding.system
        );
        if (match) {
          answers.push({
            valueCoding: { system: match.system, code: match.code, display: match.display }
          });
        }
      }

      if (answers.length > 0) {
        answerMap.set(item.linkId, answers);
      }
    }
  }

  private isConditionWithinCutoff(cond: Condition, cutoff: Date): boolean {
    const dateStr = cond.onsetDateTime ?? cond.recordedDate;
    if (!dateStr) {
      return true;
    }
    return new Date(dateStr) >= cutoff;
  }

  // ─── Strategy 2: Patient demographics via initialExpression ────────────────

  private fillPatientAnswers(
    items: ScannedItem[],
    patient: Patient,
    answerMap: Map<string, any[]>
  ): void {
    for (const item of items) {
      if (!item.initialExpression) {
        continue;
      }
      const value = this.evaluatePatientExpression(item.initialExpression, patient);
      if (value !== null && value !== undefined) {
        answerMap.set(item.linkId, [this.primitiveToAnswer(value, item.type)]);
      }
    }
  }

  private evaluatePatientExpression(expr: string, patient: Patient): any {
    const e = expr.trim();
    if (e === '%patient.birthDate') {
      return patient.birthDate ?? null;
    }
    if (e === '%patient.gender') {
      return patient.gender ?? null;
    }
    const officialName = patient.name?.find(n => n.use === 'official') ?? patient.name?.[0];
    if (e === "%patient.name.where(use='official').family" || e === '%patient.name[0].family') {
      return officialName?.family ?? null;
    }
    if (
      e === "%patient.name.where(use='official').given.first()" ||
      e === '%patient.name[0].given[0]' ||
      e === "%patient.name.where(use='official').given[0]"
    ) {
      return officialName?.given?.[0] ?? null;
    }
    const idMatch = e.match(/^%patient\.identifier\.where\(system='([^']+)'\)\.value$/);
    if (idMatch) {
      const sys = idMatch[1];
      return patient.identifier?.find(i => i.system === sys)?.value ?? null;
    }
    return null;
  }

  private primitiveToAnswer(value: any, itemType: string): any {
    if (itemType === 'date') {
      return { valueDate: String(value) };
    }
    if (itemType === 'integer') {
      return { valueInteger: parseInt(String(value), 10) };
    }
    if (itemType === 'decimal') {
      return { valueDecimal: parseFloat(String(value)) };
    }
    if (itemType === 'boolean') {
      return { valueBoolean: Boolean(value) };
    }
    return { valueString: String(value) };
  }

  // ─── Strategy 3: Previous QuestionnaireResponse ─────────────────────────────

  private findPreviousQR(questionnaireUrl: string, patientId: string): QuestionnaireResponse | null {
    const responses = this.patientService.getPatientQuestionnaireResponses(patientId);
    const matching = responses
      .filter(qr => qr.questionnaire === questionnaireUrl)
      .sort((a, b) => {
        const dateA = a.authored ? new Date(a.authored).getTime() : 0;
        const dateB = b.authored ? new Date(b.authored).getTime() : 0;
        return dateB - dateA;
      });
    return matching[0] ?? null;
  }

  private flattenQRItems(items: any[], map: Map<string, any[]>): void {
    for (const item of items) {
      if (item.answer?.length) {
        map.set(item.linkId, item.answer);
      }
      if (item.item?.length) {
        this.flattenQRItems(item.item, map);
      }
    }
  }

  // ─── QR assembly ────────────────────────────────────────────────────────────

  private buildQRItems(questionnaireItems: any[], answerMap: Map<string, any[]>): any[] {
    const result: any[] = [];
    for (const item of questionnaireItems) {
      const qrItem: any = { linkId: item.linkId };
      if (item.item?.length) {
        const childItems = this.buildQRItems(item.item, answerMap);
        if (childItems.length) {
          qrItem.item = childItems;
          result.push(qrItem);
        }
      } else {
        const answers = answerMap.get(item.linkId);
        if (answers?.length) {
          qrItem.answer = answers;
          result.push(qrItem);
        }
      }
    }
    return result;
  }

  // ─── Shared helpers ─────────────────────────────────────────────────────────

  private durationToCutoff(duration: any): Date {
    const value = Number(duration.value ?? 0);
    const code: string = duration.code ?? duration.unit ?? 'd';
    const msPerUnit: Record<string, number> = {
      a: 365.25 * 24 * 60 * 60 * 1000,
      mo: 30 * 24 * 60 * 60 * 1000,
      wk: 7 * 24 * 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      min: 60 * 1000,
      s: 1000
    };
    const ms = (msPerUnit[code] ?? msPerUnit['d']) * value;
    return new Date(Date.now() - ms);
  }
}
