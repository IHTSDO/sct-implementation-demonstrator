import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FhirService } from './fhir.service';
import type {
  AllergyIntolerance,
  BodyStructure,
  Condition,
  DeathRecord,
  Encounter,
  FhirObservation,
  LaboratoryOrderGroup,
  MedicationStatement,
  Patient,
  Procedure,
  QuestionnaireResponse,
  ServiceRequest,
} from '../model';
import {
  AiAssistedEntryTransactionPayload,
  AiAssistedEntryTransactionResult,
  PatientClinicalRecordData,
  PatientClinicalPackagePayload,
  PatientClinicalPackageResult,
  PatientConditionPackageResult,
  PatientPage,
  PatientStorageBackend
} from './patient-storage.types';

@Injectable({
  providedIn: 'root'
})
export class PatientFhirStorageService implements PatientStorageBackend {
  private readonly patientPageSize = 20;
  private static readonly BUNDLE_PATIENT_REFERENCE_EXTENSION_URL = 'http://snomed.org/fhir/StructureDefinition/patient-reference';
  private static readonly EHR_LAB_LOCATION_SYSTEM = 'http://ehr-lab.demo/location';
  private static readonly EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL = 'http://ehr-lab.demo/fhir/StructureDefinition/computed-location';

  constructor(private fhirService: FhirService) {}

  async listPatientsPage(url?: string): Promise<PatientPage> {
    const bundle = url
      ? await firstValueFrom(this.fhirService.searchByUrl(url))
      : await firstValueFrom(this.fhirService.search('Patient', {
        _count: this.patientPageSize,
        _sort: '-_lastUpdated'
      }));

    return {
      patients: this.extractBundleResources<Patient>(bundle, 'Patient'),
      nextUrl: this.getBundleLink(bundle, 'next'),
      previousUrl: this.getBundleLink(bundle, 'previous'),
      total: typeof bundle?.total === 'number' ? bundle.total : null,
    };
  }

  async searchPatients(term: string): Promise<PatientPage> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return this.listPatientsPage();
    }

    const searchParams = {
      'name:contains': normalizedTerm,
      _count: this.patientPageSize,
      _sort: '-_lastUpdated'
    };

    let bundle: any;

    try {
      bundle = await firstValueFrom(this.fhirService.search('Patient', searchParams));
    } catch {
      bundle = await firstValueFrom(this.fhirService.search('Patient', {
        name: normalizedTerm,
        _count: this.patientPageSize,
        _sort: '-_lastUpdated'
      }));
    }

    let patients = this.extractBundleResources<Patient>(bundle, 'Patient');

    if (patients.length === 0 && !normalizedTerm.includes(' ')) {
      const identifierBundle = await firstValueFrom(this.fhirService.search('Patient', {
        identifier: normalizedTerm,
        _count: this.patientPageSize,
        _sort: '-_lastUpdated'
      }));
      patients = this.extractBundleResources<Patient>(identifierBundle, 'Patient');
      bundle = identifierBundle;
    }

    return {
      patients,
      nextUrl: this.getBundleLink(bundle, 'next'),
      previousUrl: this.getBundleLink(bundle, 'previous'),
      total: typeof bundle?.total === 'number' ? bundle.total : patients.length
    };
  }

  async readPatient(patientId: string): Promise<Patient | null> {
    try {
      return await firstValueFrom(this.fhirService.read('Patient', patientId));
    } catch {
      return null;
    }
  }

  async createPatient(patient: Patient): Promise<Patient> {
    return await firstValueFrom(this.fhirService.create('Patient', this.preparePatientForFhirCreate(patient)));
  }

  async savePatientWithConditions(patient: Patient, conditions: Condition[]): Promise<PatientConditionPackageResult> {
    const patientFullUrl = this.createTransactionFullUrl('patient');
    const patientDisplay = this.getPatientDisplayName(patient);

    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        this.createTransactionEntry(
          this.preparePatientForFhirCreate(patient),
          'Patient',
          patientFullUrl
        ),
        ...conditions.map((condition) =>
          this.createTransactionEntry(
            this.removeTemporaryId(
              this.prepareConditionForFhir({
                ...condition,
                subject: {
                  ...condition.subject,
                  reference: patientFullUrl,
                  display: condition.subject?.display || patientDisplay
                }
              }),
              'condition-'
            ),
            'Condition',
            this.createTransactionFullUrl('condition')
          )
        )
      ]
    };

    const responseBundle = await firstValueFrom(this.fhirService.executeTransaction(bundle));
    const responseEntries = Array.isArray(responseBundle?.entry) ? responseBundle.entry : [];
    const resources = await Promise.all(responseEntries.map((entry: any) => this.resolveTransactionResponseResource(entry)));

    const savedPatient = resources.find((resource: any) => resource?.resourceType === 'Patient') as Patient | undefined;
    const savedConditions = resources
      .filter((resource: any) => resource?.resourceType === 'Condition');

    if (!savedPatient) {
      throw new Error('FHIR transaction did not return the created patient resource.');
    }

    return {
      patient: savedPatient,
      conditions: savedConditions
    };
  }

  async savePatientClinicalPackage(
    patient: Patient,
    payload: PatientClinicalPackagePayload
  ): Promise<PatientClinicalPackageResult> {
    const patientFullUrl = this.createTransactionFullUrl('patient');
    const patientDisplay = this.getPatientDisplayName(patient);

    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        this.createTransactionEntry(
          this.preparePatientForFhirCreate(patient),
          'Patient',
          patientFullUrl
        ),
        ...payload.conditions.map((condition) =>
          this.createTransactionEntry(
            this.removeTemporaryId(
              this.prepareConditionForFhir({
                ...condition,
                subject: {
                  ...condition.subject,
                  reference: patientFullUrl,
                  display: condition.subject?.display || patientDisplay
                }
              }),
              'condition-'
            ),
            'Condition',
            this.createTransactionFullUrl('condition')
          )
        ),
        ...payload.procedures.map((procedure) =>
          this.createTransactionEntry(
            this.removeTemporaryId(
              this.prepareProcedureForFhir({
                ...procedure,
                subject: {
                  ...procedure.subject,
                  reference: patientFullUrl,
                  display: procedure.subject?.display || patientDisplay
                }
              }),
              'procedure-'
            ),
            'Procedure',
            this.createTransactionFullUrl('procedure')
          )
        ),
        ...payload.medications.map((medication) =>
          this.createTransactionEntry(
            this.removeTemporaryId(
              this.prepareMedicationForFhir({
                ...medication,
                subject: {
                  ...medication.subject,
                  reference: patientFullUrl,
                  display: medication.subject?.display || patientDisplay
                }
              }),
              'medication-'
            ),
            'MedicationStatement',
            this.createTransactionFullUrl('medication')
          )
        ),
        ...payload.allergies.map((allergy) =>
          this.createTransactionEntry(
            this.removeTemporaryId(
              {
                ...allergy,
                patient: {
                  ...allergy.patient,
                  reference: patientFullUrl,
                  display: allergy.patient?.display || patientDisplay
                }
              },
              'allergy-'
            ),
            'AllergyIntolerance',
            this.createTransactionFullUrl('allergy')
          )
        )
      ]
    };

    const responseBundle = await firstValueFrom(this.fhirService.executeTransaction(bundle));
    const responseEntries = Array.isArray(responseBundle?.entry) ? responseBundle.entry : [];
    const resources = await Promise.all(responseEntries.map((entry: any) => this.resolveTransactionResponseResource(entry)));

    const savedPatient = resources.find((resource: any) => resource?.resourceType === 'Patient') as Patient | undefined;
    if (!savedPatient) {
      throw new Error('FHIR transaction did not return the created patient resource.');
    }

    return {
      patient: savedPatient,
      conditions: resources
        .filter((resource: any) => resource?.resourceType === 'Condition'),
      procedures: resources
        .filter((resource: any) => resource?.resourceType === 'Procedure'),
      medications: resources
        .filter((resource: any) => resource?.resourceType === 'MedicationStatement')
        .map((medication: any) => this.hydrateMedicationComputedLocation(medication)),
      allergies: resources
        .filter((resource: any) => resource?.resourceType === 'AllergyIntolerance')
    };
  }

  async updatePatient(patient: Patient): Promise<Patient> {
    return await firstValueFrom(this.fhirService.update('Patient', patient.id, patient));
  }

  async deletePatient(patientId: string): Promise<void> {
    await firstValueFrom(this.fhirService.delete('Patient', patientId));
  }

  async deleteAllPatients(patients: Patient[]): Promise<void> {
    await Promise.all(patients.map((patient) => this.deletePatient(patient.id)));
  }

  async getConditions(patientId: string): Promise<Condition[]> {
    return this.fetchPatientResources<Condition>('Condition', { subject: this.getPatientReference(patientId), _count: '200' });
  }
  async createCondition(patientId: string, condition: Condition): Promise<Condition> {
    return await firstValueFrom(this.fhirService.create('Condition', this.prepareConditionForFhir(condition)));
  }
  async updateCondition(patientId: string, conditionId: string, condition: Condition): Promise<Condition> {
    return await firstValueFrom(this.fhirService.update('Condition', conditionId, this.prepareConditionForFhir(condition)));
  }
  async deleteCondition(patientId: string, conditionId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('Condition', conditionId)); }

  async getBodyStructures(patientId: string): Promise<BodyStructure[]> { return this.fetchPatientResources('BodyStructure', { patient: this.getPatientReference(patientId), _count: '200' }); }
  async createBodyStructure(patientId: string, bodyStructure: BodyStructure): Promise<BodyStructure> { return await firstValueFrom(this.fhirService.create('BodyStructure', bodyStructure)); }
  async updateBodyStructure(patientId: string, bodyStructureId: string, bodyStructure: BodyStructure): Promise<BodyStructure> { return await firstValueFrom(this.fhirService.update('BodyStructure', bodyStructureId, bodyStructure)); }
  async deleteBodyStructure(patientId: string, bodyStructureId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('BodyStructure', bodyStructureId)); }

  async getProcedures(patientId: string): Promise<Procedure[]> {
    return this.fetchPatientResources<Procedure>('Procedure', { subject: this.getPatientReference(patientId), _count: '200' });
  }
  async createProcedure(patientId: string, procedure: Procedure): Promise<Procedure> {
    return await firstValueFrom(this.fhirService.create('Procedure', this.prepareProcedureForFhir(procedure)));
  }
  async updateProcedure(patientId: string, procedureId: string, procedure: Procedure): Promise<Procedure> {
    return await firstValueFrom(this.fhirService.update('Procedure', procedureId, this.prepareProcedureForFhir(procedure)));
  }
  async deleteProcedure(patientId: string, procedureId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('Procedure', procedureId)); }

  async getMedications(patientId: string): Promise<MedicationStatement[]> {
    const medications = await this.fetchPatientResources<MedicationStatement>('MedicationStatement', { subject: this.getPatientReference(patientId), _count: '200' });
    return medications.map((medication) => this.hydrateMedicationComputedLocation(medication));
  }
  async createMedication(patientId: string, medication: MedicationStatement): Promise<MedicationStatement> {
    const savedMedication = await firstValueFrom(this.fhirService.create('MedicationStatement', this.prepareMedicationForFhir(medication)));
    return this.hydrateMedicationComputedLocation(savedMedication);
  }
  async updateMedication(patientId: string, medicationId: string, medication: MedicationStatement): Promise<MedicationStatement> {
    const savedMedication = await firstValueFrom(this.fhirService.update('MedicationStatement', medicationId, this.prepareMedicationForFhir(medication)));
    return this.hydrateMedicationComputedLocation(savedMedication);
  }
  async deleteMedication(patientId: string, medicationId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('MedicationStatement', medicationId)); }

  async getServiceRequests(patientId: string): Promise<ServiceRequest[]> { return this.fetchPatientResources('ServiceRequest', { subject: this.getPatientReference(patientId), _count: '200' }); }
  async createServiceRequest(patientId: string, serviceRequest: ServiceRequest): Promise<ServiceRequest> { return await firstValueFrom(this.fhirService.create('ServiceRequest', serviceRequest)); }
  async updateServiceRequest(patientId: string, requestId: string, serviceRequest: ServiceRequest): Promise<ServiceRequest> { return await firstValueFrom(this.fhirService.update('ServiceRequest', requestId, serviceRequest)); }
  async deleteServiceRequest(patientId: string, requestId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('ServiceRequest', requestId)); }

  async getLabOrders(patientId: string): Promise<LaboratoryOrderGroup[]> {
    const bundles = await this.fetchPatientBundles(patientId, 'collection');
    return bundles.map((bundle: any) => ({
      id: bundle.id,
      patientId,
      patientDisplay: this.getPatientDisplay(bundle, patientId),
      createdAt: bundle.timestamp || new Date().toISOString(),
      serviceRequests: (bundle.entry || [])
        .map((entry: any) => entry?.resource)
        .filter((resource: any) => resource?.resourceType === 'ServiceRequest'),
      fhirBundle: bundle,
      fhirBundleStr: JSON.stringify(bundle, null, 2)
    }));
  }

  async createLabOrder(patientId: string, labOrder: LaboratoryOrderGroup): Promise<LaboratoryOrderGroup> {
    const bundleToSave = this.withBundlePatientReference(labOrder.fhirBundle, patientId);
    const savedBundle = await firstValueFrom(this.fhirService.create('Bundle', bundleToSave));
    return {
      ...labOrder,
      id: savedBundle.id || labOrder.id,
      fhirBundle: savedBundle,
      fhirBundleStr: JSON.stringify(savedBundle, null, 2)
    };
  }

  async deleteLabOrder(patientId: string, labOrderId: string): Promise<void> {
    await firstValueFrom(this.fhirService.delete('Bundle', labOrderId));
  }

  async getObservations(patientId: string): Promise<FhirObservation[]> { return this.fetchPatientResources('Observation', { subject: this.getPatientReference(patientId), _count: '200' }); }
  async createObservation(patientId: string, observation: FhirObservation): Promise<FhirObservation> { return await firstValueFrom(this.fhirService.create('Observation', observation)); }
  async updateObservation(patientId: string, observationId: string, observation: FhirObservation): Promise<FhirObservation> { return await firstValueFrom(this.fhirService.update('Observation', observationId, observation)); }
  async deleteObservation(patientId: string, observationId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('Observation', observationId)); }

  async getAllergies(patientId: string): Promise<AllergyIntolerance[]> { return this.fetchPatientResources('AllergyIntolerance', { patient: patientId, _count: '200' }); }
  async createAllergy(patientId: string, allergy: AllergyIntolerance): Promise<AllergyIntolerance> { return await firstValueFrom(this.fhirService.create('AllergyIntolerance', allergy)); }
  async updateAllergy(patientId: string, allergyId: string, allergy: AllergyIntolerance): Promise<AllergyIntolerance> { return await firstValueFrom(this.fhirService.update('AllergyIntolerance', allergyId, allergy)); }
  async deleteAllergy(patientId: string, allergyId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('AllergyIntolerance', allergyId)); }

  async getQuestionnaireResponses(patientId: string): Promise<QuestionnaireResponse[]> { return this.fetchPatientResources('QuestionnaireResponse', { subject: this.getPatientReference(patientId), _count: '200' }); }
  async createQuestionnaireResponse(patientId: string, response: QuestionnaireResponse): Promise<QuestionnaireResponse> { return await firstValueFrom(this.fhirService.create('QuestionnaireResponse', response)); }
  async updateQuestionnaireResponse(patientId: string, responseId: string, response: QuestionnaireResponse): Promise<QuestionnaireResponse> { return await firstValueFrom(this.fhirService.update('QuestionnaireResponse', responseId, response)); }
  async deleteQuestionnaireResponse(patientId: string, responseId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('QuestionnaireResponse', responseId)); }

  async getDeathRecord(patientId: string): Promise<DeathRecord | null> {
    const bundles = await this.fetchPatientBundles(patientId, 'document');
    return (bundles[0] as DeathRecord) || null;
  }

  async saveDeathRecord(patientId: string, record: DeathRecord): Promise<DeathRecord> {
    const bundleToSave = this.withBundlePatientReference(record, patientId);
    if (bundleToSave.id) {
      return await firstValueFrom(this.fhirService.update('Bundle', bundleToSave.id, bundleToSave));
    }
    return await firstValueFrom(this.fhirService.create('Bundle', bundleToSave));
  }

  async deleteDeathRecord(patientId: string): Promise<void> {
    const deathRecord = await this.getDeathRecord(patientId);
    if (!deathRecord?.id) {
      return;
    }
    await firstValueFrom(this.fhirService.delete('Bundle', deathRecord.id));
  }

  async getEncounters(patientId: string): Promise<Encounter[]> { return this.fetchPatientResources('Encounter', { subject: this.getPatientReference(patientId), _count: '200' }); }
  async createEncounter(patientId: string, encounter: Encounter): Promise<Encounter> { return await firstValueFrom(this.fhirService.create('Encounter', encounter)); }
  async deleteEncounter(patientId: string, encounterId: string): Promise<void> { await firstValueFrom(this.fhirService.delete('Encounter', encounterId)); }

  async getClinicalRecordData(patientId: string): Promise<PatientClinicalRecordData> {
    const everythingBundle = await this.fetchPatientEverythingBundle(patientId);
    const resources = this.extractBundleResources<any>(everythingBundle);

    const conditions = resources
      .filter((resource: any) => resource?.resourceType === 'Condition') as Condition[];
    const bodyStructures = resources.filter((resource: any) => resource?.resourceType === 'BodyStructure') as BodyStructure[];
    const procedures = resources
      .filter((resource: any) => resource?.resourceType === 'Procedure') as Procedure[];
    const medications = resources
      .filter((resource: any) => resource?.resourceType === 'MedicationStatement')
      .map((medication: MedicationStatement) => this.hydrateMedicationComputedLocation(medication));
    const serviceRequests = resources.filter((resource: any) => resource?.resourceType === 'ServiceRequest') as ServiceRequest[];
    const observations = resources.filter((resource: any) => resource?.resourceType === 'Observation') as FhirObservation[];
    const allergies = resources.filter((resource: any) => resource?.resourceType === 'AllergyIntolerance') as AllergyIntolerance[];
    const questionnaireResponses = resources.filter((resource: any) => resource?.resourceType === 'QuestionnaireResponse') as QuestionnaireResponse[];
    const encounters = resources.filter((resource: any) => resource?.resourceType === 'Encounter') as Encounter[];

    const [labOrders, deathRecord] = await Promise.all([
      this.getLabOrders(patientId),
      this.getDeathRecord(patientId)
    ]);

    return {
      conditions,
      bodyStructures,
      procedures,
      medications,
      serviceRequests,
      labOrders,
      observations,
      allergies,
      questionnaireResponses,
      encounters,
      deathRecord
    };
  }

  async saveAiAssistedEntryTransaction(
    patientId: string,
    payload: AiAssistedEntryTransactionPayload
  ): Promise<AiAssistedEntryTransactionResult> {
    const encounterFullUrl = payload.encounter ? this.createTransactionFullUrl('encounter') : null;
    const conditionReferenceMap = new Map<string, string>();
    const conditionEntries = payload.conditions.map((condition) => {
      const fullUrl = this.createTransactionFullUrl('condition');
      if (condition.id) {
        conditionReferenceMap.set(`Condition/${condition.id}`, fullUrl);
      }

      return this.createTransactionEntry(
        this.removeTemporaryId(this.prepareConditionForFhir(condition), 'condition-'),
        'Condition',
        fullUrl
      );
    });

    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        ...(payload.encounter ? [this.createTransactionEntry(
          this.prepareEncounterForTransaction(payload.encounter, conditionReferenceMap),
          'Encounter',
          encounterFullUrl || undefined
        )] : []),
        ...conditionEntries,
        ...payload.procedures.map((procedure) =>
          this.createTransactionEntry(
            this.prepareProcedureForTransaction(procedure, encounterFullUrl),
            'Procedure'
          )
        ),
        ...payload.medications.map((medication) =>
          this.createTransactionEntry(
            this.removeTemporaryId(this.prepareMedicationForFhir(medication), 'medication-'),
            'MedicationStatement'
          )
        ),
        ...payload.allergies.map((allergy) =>
          this.createTransactionEntry(
            this.removeTemporaryId(allergy, 'allergy-'),
            'AllergyIntolerance'
          )
        )
      ]
    };

    const responseBundle = await firstValueFrom(this.fhirService.executeTransaction(bundle));
    const responseEntries = Array.isArray(responseBundle?.entry) ? responseBundle.entry : [];

    const resources = await Promise.all(responseEntries.map((entry: any) => this.resolveTransactionResponseResource(entry)));
    const encounter = resources.find((resource: any) => resource?.resourceType === 'Encounter') || null;
    const conditions = resources
      .filter((resource: any) => resource?.resourceType === 'Condition');
    const procedures = resources
      .filter((resource: any) => resource?.resourceType === 'Procedure');
    const medications = resources
      .filter((resource: any) => resource?.resourceType === 'MedicationStatement')
      .map((medication: any) => this.hydrateMedicationComputedLocation(medication));
    const allergies = resources
      .filter((resource: any) => resource?.resourceType === 'AllergyIntolerance');

    return {
      encounter,
      conditions,
      procedures,
      medications,
      allergies
    };
  }

  async clearAllPatientEvents(patientId: string): Promise<void> {
    const [conditions, bodyStructures, procedures, medications, serviceRequests, observations, allergies, questionnaireResponses, encounters, labOrders, deathRecord] = await Promise.all([
      this.getConditions(patientId),
      this.getBodyStructures(patientId),
      this.getProcedures(patientId),
      this.getMedications(patientId),
      this.getServiceRequests(patientId),
      this.getObservations(patientId),
      this.getAllergies(patientId),
      this.getQuestionnaireResponses(patientId),
      this.getEncounters(patientId),
      this.getLabOrders(patientId),
      this.getDeathRecord(patientId),
    ]);

    const deletions: Promise<void>[] = [
      ...conditions.map((item) => this.deleteCondition(patientId, item.id)),
      ...bodyStructures.map((item) => this.deleteBodyStructure(patientId, item.id)),
      ...procedures.map((item) => this.deleteProcedure(patientId, item.id)),
      ...medications.map((item) => this.deleteMedication(patientId, item.id)),
      ...serviceRequests.map((item) => this.deleteServiceRequest(patientId, item.id)),
      ...observations.map((item) => this.deleteObservation(patientId, item.id)),
      ...allergies.map((item) => this.deleteAllergy(patientId, item.id)),
      ...questionnaireResponses.map((item) => this.deleteQuestionnaireResponse(patientId, item.id)),
      ...encounters.map((item) => this.deleteEncounter(patientId, item.id)),
      ...labOrders.map((item) => this.deleteLabOrder(patientId, item.id)),
    ];

    if (deathRecord?.id) {
      deletions.push(this.deleteDeathRecord(patientId));
    }

    await Promise.all(deletions);
  }

  getPatientPageSize(): number {
    return this.patientPageSize;
  }

  private getPatientReference(patientId: string): string {
    return `Patient/${patientId}`;
  }

  private async fetchPatientResources<T>(resourceType: string, params: Record<string, string>): Promise<T[]> {
    const bundle = await firstValueFrom(this.fhirService.search(resourceType, params));
    return this.extractBundleResources<T>(bundle, resourceType);
  }

  private async fetchPatientEverythingBundle(patientId: string): Promise<any> {
    const initialBundle = await firstValueFrom(this.fhirService.patientEverything(patientId, {
      _count: 200
    }));

    return await this.collectPagedBundle(initialBundle);
  }

  private async collectPagedBundle(initialBundle: any, maxPages: number = 10): Promise<any> {
    const combinedEntries = Array.isArray(initialBundle?.entry) ? [...initialBundle.entry] : [];
    let currentBundle = initialBundle;
    let pageCount = 1;

    while (pageCount < maxPages) {
      const nextUrl = this.getBundleLink(currentBundle, 'next');
      if (!nextUrl) {
        break;
      }

      currentBundle = await firstValueFrom(this.fhirService.searchByUrl(nextUrl));
      if (Array.isArray(currentBundle?.entry)) {
        combinedEntries.push(...currentBundle.entry);
      }
      pageCount += 1;
    }

    return {
      ...initialBundle,
      entry: combinedEntries
    };
  }

  private async fetchPatientBundles(patientId: string, bundleType?: string): Promise<any[]> {
    const bundle = await firstValueFrom(this.fhirService.search('Bundle', {
      type: bundleType,
      _count: 200
    }));
    return this.extractBundleResources<any>(bundle, 'Bundle')
      .filter((resource: any) => this.getBundlePatientReference(resource) === this.getPatientReference(patientId));
  }

  private extractBundleResources<T>(bundle: any, resourceType?: string): T[] {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
    return entries
      .map((entry: any) => entry?.resource)
      .filter((resource: any) => resource && (!resourceType || resource.resourceType === resourceType));
  }

  private getBundleLink(bundle: any, relation: 'next' | 'previous'): string | null {
    return bundle?.link?.find((link: any) => link.relation === relation)?.url || null;
  }

  private getBundlePatientReference(resource: any): string | null {
    const extensions = Array.isArray(resource?.extension) ? resource.extension : [];
    return extensions.find((extension: any) => extension.url === PatientFhirStorageService.BUNDLE_PATIENT_REFERENCE_EXTENSION_URL)?.valueReference?.reference || null;
  }

  private createTransactionFullUrl(prefix: string): string {
    return `urn:uuid:${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private createTransactionEntry(resource: any, resourceType: string, fullUrl?: string): any {
    return {
      ...(fullUrl ? { fullUrl } : {}),
      resource,
      request: {
        method: 'POST',
        url: resourceType
      }
    };
  }

  private prepareEncounterForTransaction(
    encounter: Encounter,
    conditionReferenceMap: Map<string, string>
  ): Encounter {
    const encounterWithoutId = this.removeTemporaryId(encounter, 'encounter-');
    const diagnosis = Array.isArray(encounterWithoutId.diagnosis)
      ? encounterWithoutId.diagnosis.map((diagnosisItem: any) => {
          const reference = diagnosisItem?.condition?.reference;
          const mappedReference = reference ? conditionReferenceMap.get(reference) : null;

          if (!mappedReference) {
            return diagnosisItem;
          }

          return {
            ...diagnosisItem,
            condition: {
              ...diagnosisItem.condition,
              reference: mappedReference
            }
          };
        })
      : encounterWithoutId.diagnosis;

    return {
      ...encounterWithoutId,
      diagnosis
    };
  }

  private prepareProcedureForTransaction(procedure: Procedure, encounterFullUrl: string | null): Procedure {
    const preparedProcedure = this.prepareProcedureForFhir(procedure);
    const procedureWithoutId = this.removeTemporaryId(preparedProcedure, 'procedure-');

    if (!encounterFullUrl) {
      return procedureWithoutId;
    }

    return {
      ...procedureWithoutId,
      encounter: {
        reference: encounterFullUrl
      }
    };
  }

  private removeTemporaryId<T extends { id?: string }>(resource: T, tempPrefix: string): T {
    if (!resource.id?.startsWith(tempPrefix)) {
      return resource;
    }

    const { id, ...resourceWithoutId } = resource;
    return resourceWithoutId as T;
  }

  private async resolveTransactionResponseResource(entry: any): Promise<any | null> {
    if (entry?.resource) {
      return entry.resource;
    }

    const location = entry?.response?.location;
    if (!location || typeof location !== 'string') {
      return null;
    }

    const match = location.match(/([^/]+)\/([^/]+)(?:\/_history\/.+)?$/);
    if (!match) {
      return null;
    }

    const [, resourceType, resourceId] = match;
    try {
      return await firstValueFrom(this.fhirService.read(resourceType, resourceId));
    } catch {
      return null;
    }
  }

  private withBundlePatientReference<T extends Record<string, any>>(resource: T, patientId: string): T & { extension: any[] } {
    const extensions = Array.isArray(resource['extension']) ? [...resource['extension']] : [];
    const otherExtensions = extensions.filter((extension: any) => extension.url !== PatientFhirStorageService.BUNDLE_PATIENT_REFERENCE_EXTENSION_URL);

    return {
      ...resource,
      extension: [
        ...otherExtensions,
        {
          url: PatientFhirStorageService.BUNDLE_PATIENT_REFERENCE_EXTENSION_URL,
          valueReference: {
            reference: this.getPatientReference(patientId)
          }
        }
      ]
    };
  }

  private getPatientDisplay(bundle: any, patientId: string): string {
    const patient = (bundle.entry || [])
      .map((entry: any) => entry?.resource)
      .find((resource: any) => resource?.resourceType === 'Patient' && resource?.id === patientId);

    if (!patient?.name?.length) {
      return `Patient ${patientId}`;
    }

    const name = patient.name[0];
    if (name.text) {
      return name.text;
    }

    return [...(name.given || []), name.family].filter(Boolean).join(' ') || `Patient ${patientId}`;
  }

  private prepareConditionForFhir(condition: Condition): Condition {
    const { computedLocation, ...conditionWithoutComputedLocation } = condition;
    const bodySite = Array.isArray(condition.bodySite) ? [...condition.bodySite] : [];
    const filteredBodySite = bodySite.filter((site: any) => {
      const codings = Array.isArray(site?.coding) ? site.coding : [];
      return !codings.some((coding: any) => coding?.system === PatientFhirStorageService.EHR_LAB_LOCATION_SYSTEM);
    });

    if (!condition.computedLocation) {
      return {
        ...conditionWithoutComputedLocation,
        bodySite: filteredBodySite.length > 0 ? filteredBodySite : undefined
      };
    }

    return {
      ...conditionWithoutComputedLocation,
      bodySite: [
        ...filteredBodySite,
        {
          coding: [
            {
              system: PatientFhirStorageService.EHR_LAB_LOCATION_SYSTEM,
              code: condition.computedLocation,
              display: this.toLocationDisplay(condition.computedLocation)
            }
          ],
          text: this.toLocationDisplay(condition.computedLocation)
        }
      ]
    };
  }

  private preparePatientForFhirCreate(patient: Patient): Omit<Patient, 'id'> & Partial<Pick<Patient, 'id'>> {
    const shouldDropId = patient.id?.startsWith('patient-');
    if (!shouldDropId) {
      return patient;
    }

    const { id, ...patientWithoutId } = patient;
    return patientWithoutId;
  }

  private hydrateConditionComputedLocation(condition: Condition): Condition {
    if (condition.computedLocation) {
      return condition;
    }

    const computedLocation = (condition.bodySite || [])
      .flatMap((site: any) => Array.isArray(site?.coding) ? site.coding : [])
      .find((coding: any) => coding?.system === PatientFhirStorageService.EHR_LAB_LOCATION_SYSTEM)
      ?.code;

    return computedLocation ? { ...condition, computedLocation } : condition;
  }

  private prepareProcedureForFhir(procedure: Procedure): Procedure {
    const { computedLocation, ...procedureWithoutComputedLocation } = procedure;
    const bodySite = Array.isArray(procedure.bodySite) ? [...procedure.bodySite] : [];
    const filteredBodySite = bodySite.filter((site: any) => {
      const codings = Array.isArray(site?.coding) ? site.coding : [];
      return !codings.some((coding: any) => coding?.system === PatientFhirStorageService.EHR_LAB_LOCATION_SYSTEM);
    });

    if (!procedure.computedLocation) {
      return {
        ...procedureWithoutComputedLocation,
        bodySite: filteredBodySite.length > 0 ? filteredBodySite : undefined
      };
    }

    return {
      ...procedureWithoutComputedLocation,
      bodySite: [
        ...filteredBodySite,
        {
          coding: [
            {
              system: PatientFhirStorageService.EHR_LAB_LOCATION_SYSTEM,
              code: procedure.computedLocation,
              display: this.toLocationDisplay(procedure.computedLocation)
            }
          ],
          text: this.toLocationDisplay(procedure.computedLocation)
        }
      ]
    };
  }

  private hydrateProcedureComputedLocation(procedure: Procedure): Procedure {
    if (procedure.computedLocation) {
      return procedure;
    }

    const computedLocation = (procedure.bodySite || [])
      .flatMap((site: any) => Array.isArray(site?.coding) ? site.coding : [])
      .find((coding: any) => coding?.system === PatientFhirStorageService.EHR_LAB_LOCATION_SYSTEM)
      ?.code;

    return computedLocation ? { ...procedure, computedLocation } : procedure;
  }

  private prepareMedicationForFhir(medication: MedicationStatement): MedicationStatement {
    const { computedLocation, ...medicationWithoutComputedLocation } = medication as MedicationStatement & { computedLocation?: string };
    const extensions = Array.isArray((medication as any).extension) ? [...(medication as any).extension] : [];
    const filteredExtensions = extensions.filter((extension: any) => extension?.url !== PatientFhirStorageService.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL);

    if (!medication.computedLocation) {
      return {
        ...medicationWithoutComputedLocation,
        extension: filteredExtensions.length > 0 ? filteredExtensions : undefined
      } as MedicationStatement;
    }

    return {
      ...medicationWithoutComputedLocation,
      extension: [
        ...filteredExtensions,
        {
          url: PatientFhirStorageService.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL,
          valueCode: medication.computedLocation
        }
      ]
    } as MedicationStatement;
  }

  private hydrateMedicationComputedLocation(medication: MedicationStatement): MedicationStatement {
    if (medication.computedLocation) {
      return medication;
    }

    const extensions = Array.isArray((medication as any).extension) ? (medication as any).extension : [];
    const computedLocation = extensions.find(
      (extension: any) => extension?.url === PatientFhirStorageService.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL
    )?.valueCode;

    return computedLocation ? { ...medication, computedLocation } : medication;
  }

  private toLocationDisplay(locationCode: string): string {
    return locationCode
      .split(/[-_]/g)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) {
        return name.text;
      }

      return [...(name.given || []), name.family].filter(Boolean).join(' ') || `Patient ${patient.id}`;
    }

    return `Patient ${patient.id}`;
  }
}
