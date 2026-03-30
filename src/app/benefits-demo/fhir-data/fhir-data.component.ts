import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PatientService } from '../../services/patient.service';
import { saveAs } from 'file-saver';
import { FhirService } from '../../services/fhir.service';
import { IpsService } from '../../services/ips.service';
import { FLAT_PATIENT_RESOURCE_CATALOG, FlatPatientResourceType } from '../../services/patient-resource-catalog';
import { Subscription, firstValueFrom } from 'rxjs';
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
  Provenance,
  Procedure,
  QuestionnaireResponse,
  ServiceRequest
} from '../../model';

type SupportedResourceType =
  | 'Patient'
  | FlatPatientResourceType
  | 'Bundle';

type FhirBundleResource = LaboratoryOrderGroup['fhirBundle'] | DeathRecord;

type SupportedResource =
  | Patient
  | BodyStructure
  | Condition
  | Procedure
  | MedicationStatement
  | AllergyIntolerance
  | Provenance
  | FhirObservation
  | Encounter
  | QuestionnaireResponse
  | ServiceRequest
  | FhirBundleResource;

interface ResourceListItem {
  resourceType: SupportedResourceType;
  id: string;
  label: string;
  subtitle: string;
  resource: SupportedResource;
}

interface ResourceGroup {
  resourceType: SupportedResourceType;
  title: string;
  icon: string;
  iconFontSet?: string;
  items: ResourceListItem[];
}

@Component({
  selector: 'app-fhir-data',
  templateUrl: './fhir-data.component.html',
  styleUrls: ['./fhir-data.component.css'],
  standalone: false
})
export class FhirDataComponent implements OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() dataVersion = 0;
  @Input() isDeletingEvents = false;
  @Output() deleteAllEventsRequested = new EventEmitter<void>();

  resourceGroups: ResourceGroup[] = [];
  selectedItem: ResourceListItem | null = null;
  selectedResourceJson = '';
  isGeneratingLocalIps = false;
  isLoadingServerSummary = false;
  isExportingBundle = false;
  isCheckingIpsSupport = false;
  ipsSummarySupported: boolean | null = null;
  private localIpsItem: ResourceListItem | null = null;
  private serverSummaryItem: ResourceListItem | null = null;
  private currentFhirBaseUrl = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private patientService: PatientService,
    private fhirService: FhirService,
    private ipsService: IpsService,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {
    this.currentFhirBaseUrl = this.fhirService.getBaseUrl();
    this.subscriptions.push(
      this.fhirService.baseUrl$.subscribe((url) => {
        this.currentFhirBaseUrl = url;
        this.updateIpsSupportState();
      })
    );
    this.updateIpsSupportState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] || changes['dataVersion']) {
      if (changes['patient']) {
        const previousPatientId = changes['patient'].previousValue?.id;
        const currentPatientId = changes['patient'].currentValue?.id;
        if (previousPatientId !== currentPatientId) {
          this.localIpsItem = null;
          this.serverSummaryItem = null;
        }
      }
      this.refreshResources();
      if (changes['patient']) {
        this.updateIpsSupportState();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  selectItem(item: ResourceListItem): void {
    this.selectedItem = item;
    this.selectedResourceJson = JSON.stringify(item.resource, null, 2);
  }

  isSelected(item: ResourceListItem): boolean {
    return !!this.selectedItem
      && this.selectedItem.resourceType === item.resourceType
      && this.selectedItem.id === item.id;
  }

  isIpsSummaryItem(item: ResourceListItem): boolean {
    return this.isLocalIpsItem(item) || this.isServerSummaryItem(item);
  }

  isLocalIpsItem(item: ResourceListItem): boolean {
    return !!this.patient && item.id === `${this.patient.id}-local-ips`;
  }

  isServerSummaryItem(item: ResourceListItem): boolean {
    return !!this.patient && item.id === `${this.patient.id}-$summary`;
  }

  hasAnyResources(): boolean {
    return this.resourceGroups.some(group => group.items.length > 0);
  }

  copySelectedResource(): void {
    if (!this.selectedResourceJson) {
      return;
    }
    this.clipboard.copy(this.selectedResourceJson);
    this.snackBar.open('FHIR JSON copied to clipboard', 'Close', { duration: 2000 });
  }

  downloadSelectedResource(): void {
    if (!this.selectedResourceJson || !this.selectedItem) {
      return;
    }

    const fileName = `${this.selectedItem.resourceType}-${this.selectedItem.id}.json`;
    const blob = new Blob([this.selectedResourceJson], { type: 'application/fhir+json;charset=utf-8' });
    saveAs(blob, fileName);
  }

  requestDeleteAllEvents(): void {
    this.deleteAllEventsRequested.emit();
  }

  exportAllAsBundle(): void {
    if (!this.patient || this.isExportingBundle) {
      return;
    }

    this.isExportingBundle = true;

    try {
      const exportBundle = this.buildTransactionExportBundle(this.patient.id);
      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], {
        type: 'application/fhir+json;charset=utf-8'
      });
      saveAs(blob, `patient-${this.patient.id}-transaction-bundle.json`);
      this.snackBar.open('Patient record exported as a transaction bundle.', 'Close', { duration: 2500 });
    } finally {
      this.isExportingBundle = false;
    }
  }

  async requestLocalIps(): Promise<void> {
    if (!this.patient || this.isGeneratingLocalIps) {
      return;
    }

    this.isGeneratingLocalIps = true;

    try {
      const patientId = this.patient.id;
      const ipsBundle = this.ipsService.generateIpsBundle({
        patient: this.patientService.getPatientById(patientId) || this.patient,
        conditions: this.patientService.getPatientConditions(patientId),
        procedures: this.patientService.getPatientProcedures(patientId),
        medications: this.patientService.getPatientMedications(patientId),
        allergies: this.patientService.getPatientAllergies(patientId),
        observations: this.patientService.getPatientObservations(patientId),
        encounters: this.patientService.getPatientEncounters(patientId),
        serviceRequests: this.patientService.getPatientServiceRequests(patientId),
      });

      this.localIpsItem = {
        resourceType: 'Bundle',
        id: `${this.patient.id}-local-ips`,
        label: 'Local IPS',
        subtitle: 'Locally generated IPS document',
        resource: ipsBundle as SupportedResource
      };
      this.refreshResources();
      if (this.localIpsItem) {
        this.selectItem(this.localIpsItem);
      }

      this.snackBar.open('IPS document generated from local clinical data.', 'Close', { duration: 2500 });
    } finally {
      this.isGeneratingLocalIps = false;
    }
  }

  async requestServerIpsSummary(): Promise<void> {
    if (!this.patient || this.isLoadingServerSummary || !this.isFhirMode() || this.ipsSummarySupported === false) {
      return;
    }

    this.isLoadingServerSummary = true;

    try {

      const summaryResponse = await firstValueFrom(
        this.fhirService.operation('Patient', this.patient.id, '$summary')
      );

      this.serverSummaryItem = {
        resourceType: 'Bundle',
        id: `${this.patient.id}-$summary`,
        label: '$summary',
        subtitle: 'Server-generated IPS document',
        resource: summaryResponse as SupportedResource
      };
      this.refreshResources();
      if (this.serverSummaryItem) {
        this.selectItem(this.serverSummaryItem);
      }

      this.snackBar.open('Patient summary loaded from FHIR server.', 'Close', { duration: 2500 });
    } catch (error: any) {
      console.error('Error loading patient summary from FHIR server:', error);
      const diagnostics = error?.error?.issue?.[0]?.diagnostics || '';
      const isNotSupported = error?.error?.issue?.[0]?.code === 'not-supported'
        || diagnostics.includes('does not know how to handle')
        || diagnostics.includes('$summary');

      this.snackBar.open(
        isNotSupported
          ? 'This FHIR server does not support Patient/$summary.'
          : 'Unable to load patient summary from the FHIR server.',
        'Close',
        { duration: 3500 }
      );
    } finally {
      this.isLoadingServerSummary = false;
    }
  }

  isFhirMode(): boolean {
    return this.patientService.getCurrentPersistenceMode() === 'fhir';
  }

  isLocalIpsActionDisabled(): boolean {
    return this.isDeletingEvents || this.isGeneratingLocalIps || this.isLoadingServerSummary || this.isExportingBundle;
  }

  isServerIpsActionDisabled(): boolean {
    return this.isDeletingEvents
      || this.isGeneratingLocalIps
      || this.isLoadingServerSummary
      || this.isExportingBundle
      || !this.isFhirMode()
      || this.isCheckingIpsSupport
      || this.ipsSummarySupported === false;
  }

  getLocalIpsButtonTooltip(): string {
    return 'Generate a local IPS document from the current clinical data';
  }

  getServerIpsButtonTooltip(): string {
    if (!this.isFhirMode()) {
      return '$summary is only available in FHIR mode';
    }

    if (this.isCheckingIpsSupport) {
      return 'Checking FHIR server capabilities...';
    }

    if (this.ipsSummarySupported === false) {
      return 'IPS generation not supported in server';
    }

    return 'Request IPS generation to server using Patient/$summary';
  }

  getSelectedResourceServerUrl(): string | null {
    if (!this.isFhirMode() || !this.selectedItem) {
      return null;
    }

    const normalizedBaseUrl = this.currentFhirBaseUrl.replace(/\/$/, '');
    if (this.isServerSummaryItem(this.selectedItem) && this.patient?.id) {
      return `${normalizedBaseUrl}/Patient/${this.patient.id}/$summary`;
    }
    return `${normalizedBaseUrl}/${this.selectedItem.resourceType}/${this.selectedItem.id}`;
  }

  private refreshResources(): void {
    if (!this.patient) {
      this.resourceGroups = [];
      this.selectedItem = null;
      this.selectedResourceJson = '';
      return;
    }

    const patientId = this.patient.id;
    const freshPatient = this.patientService.getPatientById(patientId) || this.patient;
    const deathRecordBundle = this.patientService.getPatientDeathRecord(patientId);
    const groups: ResourceGroup[] = [
      {
        resourceType: 'Patient',
        title: 'Patient',
        icon: 'person',
        items: [this.toPatientItem(freshPatient)]
      },
      ...FLAT_PATIENT_RESOURCE_CATALOG.map((entry) => ({
        resourceType: entry.resourceType,
        title: entry.title,
        icon: entry.icon,
        iconFontSet: entry.iconFontSet,
        items: this.getFlatResources(patientId, entry.patientServiceGetter)
          .map((resource) => this.toResourceListItem(entry.resourceType, resource))
      })),
      {
        resourceType: 'Bundle',
        title: 'Bundle',
        icon: 'folder_zip',
        items: [
          ...this.patientService.getPatientLabOrders(patientId).map(resource => this.toBundleItem(resource)),
          ...(deathRecordBundle ? [this.toDeathCertificateBundleItem(deathRecordBundle)] : []),
          ...(this.localIpsItem && this.localIpsItem.id === `${patientId}-local-ips` ? [this.localIpsItem] : []),
          ...(this.serverSummaryItem && this.serverSummaryItem.id === `${patientId}-$summary` ? [this.serverSummaryItem] : [])
        ]
      }
    ];

    this.resourceGroups = groups;
    this.syncSelection();
  }

  private updateIpsSupportState(): void {
    if (!this.isFhirMode()) {
      this.ipsSummarySupported = true;
      this.isCheckingIpsSupport = false;
      return;
    }

    if (!this.patient) {
      this.ipsSummarySupported = null;
      this.isCheckingIpsSupport = true;
      return;
    }

    this.isCheckingIpsSupport = true;
    this.ipsSummarySupported = null;

    const supportSubscription = this.fhirService.supportsPatientSummary().subscribe((supported) => {
      this.ipsSummarySupported = supported;
      this.isCheckingIpsSupport = false;
    });

    this.subscriptions.push(supportSubscription);
  }

  private syncSelection(): void {
    if (!this.hasAnyResources()) {
      this.selectedItem = null;
      this.selectedResourceJson = '';
      return;
    }

    if (this.selectedItem) {
      const existing = this.findItem(this.selectedItem.resourceType, this.selectedItem.id);
      if (existing) {
        this.selectItem(existing);
        return;
      }
    }

    for (const group of this.resourceGroups) {
      if (group.items.length > 0) {
        this.selectItem(group.items[0]);
        return;
      }
    }
  }

  private findItem(resourceType: SupportedResourceType, id: string): ResourceListItem | null {
    for (const group of this.resourceGroups) {
      if (group.resourceType !== resourceType) {
        continue;
      }
      const found = group.items.find(item => item.id === id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private toPatientItem(resource: Patient): ResourceListItem {
    const label = this.getPatientLabel(resource);
    const subtitle = resource.id ? `id: ${resource.id}` : 'Patient resource';
    return {
      resourceType: 'Patient',
      id: resource.id,
      label,
      subtitle,
      resource
    };
  }

  private getFlatResources(patientId: string, getterName: string): any[] {
    const getter = (this.patientService as any)[getterName];
    return typeof getter === 'function' ? getter.call(this.patientService, patientId) : [];
  }

  private toResourceListItem(resourceType: FlatPatientResourceType, resource: any): ResourceListItem {
    switch (resourceType) {
      case 'BodyStructure':
        return this.toBodyStructureItem(resource as BodyStructure);
      case 'Condition':
        return this.toConditionItem(resource as Condition);
      case 'Procedure':
        return this.toProcedureItem(resource as Procedure);
      case 'MedicationStatement':
        return this.toMedicationItem(resource as MedicationStatement);
      case 'AllergyIntolerance':
        return this.toAllergyItem(resource as AllergyIntolerance);
      case 'Provenance':
        return this.toProvenanceItem(resource as Provenance);
      case 'Observation':
        return this.toObservationItem(resource as FhirObservation);
      case 'Encounter':
        return this.toEncounterItem(resource as Encounter);
      case 'QuestionnaireResponse':
        return this.toQuestionnaireItem(resource as QuestionnaireResponse);
      case 'ServiceRequest':
        return this.toServiceRequestItem(resource as ServiceRequest);
    }
  }

  private toBodyStructureItem(resource: BodyStructure): ResourceListItem {
    const label = resource.includedStructure?.[0]?.structure?.text
      || resource.includedStructure?.[0]?.structure?.coding?.[0]?.display
      || resource.note?.[0]?.text
      || resource.id;
    return {
      resourceType: 'BodyStructure',
      id: resource.id,
      label,
      subtitle: 'Body structure resource',
      resource
    };
  }

  private toConditionItem(resource: Condition): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    return {
      resourceType: 'Condition',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.recordedDate || resource.onsetDateTime),
      resource
    };
  }

  private toProcedureItem(resource: Procedure): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    const dateValue = resource.performedDateTime || resource.performedPeriod?.start;
    return {
      resourceType: 'Procedure',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(dateValue),
      resource
    };
  }

  private toMedicationItem(resource: MedicationStatement): ResourceListItem {
    const label = resource.medicationCodeableConcept?.text
      || resource.medicationCodeableConcept?.coding?.[0]?.display
      || resource.id;
    return {
      resourceType: 'MedicationStatement',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.effectiveDateTime),
      resource
    };
  }

  private toAllergyItem(resource: AllergyIntolerance): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    return {
      resourceType: 'AllergyIntolerance',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.recordedDate),
      resource
    };
  }

  private toObservationItem(resource: FhirObservation): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    const dateValue = resource.effectiveDateTime || resource.issued;
    return {
      resourceType: 'Observation',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(dateValue),
      resource
    };
  }

  private toProvenanceItem(resource: Provenance): ResourceListItem {
    const targetLabel = resource.target?.find(target => !target.reference.startsWith('Patient/'))?.display
      || resource.target?.find(target => !target.reference.startsWith('Patient/'))?.reference
      || resource.id;
    const sourceLabel = resource.entity?.[0]?.what?.display
      || resource.entity?.[0]?.what?.identifier?.value
      || 'IPS import';

    return {
      resourceType: 'Provenance',
      id: resource.id,
      label: `Import provenance for ${targetLabel}`,
      subtitle: `${sourceLabel} • ${this.buildDateSubtitle(resource.recorded)}`,
      resource
    };
  }

  private toEncounterItem(resource: Encounter): ResourceListItem {
    const label = resource.type?.[0]?.text || resource.type?.[0]?.coding?.[0]?.display || resource.id;
    const dateValue = resource.period?.start;
    return {
      resourceType: 'Encounter',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(dateValue),
      resource
    };
  }

  private toQuestionnaireItem(resource: QuestionnaireResponse): ResourceListItem {
    const label = resource.questionnaireTitle || resource.questionnaireName || resource.id;
    return {
      resourceType: 'QuestionnaireResponse',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.authored),
      resource
    };
  }

  private toBundleItem(labOrder: LaboratoryOrderGroup): ResourceListItem {
    const determinationCount = labOrder.serviceRequests.length;
    const label = determinationCount === 1
      ? 'Laboratory order bundle - 1 determination'
      : `Laboratory order bundle - ${determinationCount} determinations`;

    return {
      resourceType: 'Bundle',
      id: labOrder.id,
      label,
      subtitle: this.buildDateSubtitle(labOrder.createdAt),
      resource: labOrder.fhirBundle
    };
  }

  private toDeathCertificateBundleItem(resource: DeathRecord): ResourceListItem {
    const entryCount = resource.entry?.length || 0;
    const label = entryCount === 1
      ? 'Death certificate document bundle - 1 entry'
      : `Death certificate document bundle - ${entryCount} entries`;

    return {
      resourceType: 'Bundle',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.authored || resource.timestamp),
      resource
    };
  }

  private toServiceRequestItem(resource: ServiceRequest): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    return {
      resourceType: 'ServiceRequest',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.authoredOn || resource.occurrenceDateTime),
      resource
    };
  }

  private getPatientLabel(resource: Patient): string {
    const nameEntry = resource.name?.[0];
    if (!nameEntry) {
      return resource.id;
    }
    if (nameEntry.text) {
      return nameEntry.text;
    }
    const given = nameEntry.given?.join(' ') || '';
    const family = nameEntry.family || '';
    const fullName = `${given} ${family}`.trim();
    return fullName || resource.id;
  }

  private buildDateSubtitle(value?: string): string {
    if (!value) {
      return 'No recorded date';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }

  private buildTransactionExportBundle(patientId: string): any {
    const patient = this.patientService.getPatientById(patientId) || this.patient;
    if (!patient) {
      throw new Error('No patient selected');
    }

    const flatResourceCollections = FLAT_PATIENT_RESOURCE_CATALOG.map((entry) => ({
      entry,
      resources: this.getFlatResources(patientId, entry.patientServiceGetter)
    }));
    const bundles = [
      ...this.patientService.getPatientLabOrders(patientId).map((labOrder) => labOrder.fhirBundle),
      ...(this.patientService.getPatientDeathRecord(patientId) ? [this.patientService.getPatientDeathRecord(patientId)] : [])
    ].filter(Boolean);

    const patientFullUrl = this.createTransactionFullUrl('patient');
    const referenceMap = new Map<string, string>([
      [`Patient/${patient.id}`, patientFullUrl]
    ]);

    flatResourceCollections.forEach(({ entry, resources }) => {
      resources.forEach((resource: any) => {
        referenceMap.set(
          `${entry.resourceType}/${resource.id}`,
          this.createTransactionFullUrl(`${entry.exportFullUrlPrefix}-${resource.id}`)
        );
      });
    });

    const entries = [
      this.createExportTransactionEntry(patient, 'Patient', patientFullUrl, referenceMap),
      ...flatResourceCollections.flatMap(({ entry, resources }) =>
        resources.map((resource: any) =>
          this.createExportTransactionEntry(
            resource,
            entry.resourceType,
            referenceMap.get(`${entry.resourceType}/${resource.id}`)!,
            referenceMap
          )
        )
      ),
      ...bundles.map((resource: any, index: number) => this.createExportTransactionEntry(resource, 'Bundle', this.createTransactionFullUrl(`bundle-${index + 1}`), referenceMap))
    ];

    return {
      resourceType: 'Bundle',
      type: 'transaction',
      timestamp: new Date().toISOString(),
      entry: entries
    };
  }

  private createExportTransactionEntry(resource: any, resourceType: SupportedResourceType | 'Bundle', fullUrl: string, referenceMap: Map<string, string>): any {
    return {
      fullUrl,
      resource: this.prepareResourceForBundleExport(resource, referenceMap),
      request: {
        method: 'POST',
        url: resourceType
      }
    };
  }

  private prepareResourceForBundleExport(resource: any, referenceMap: Map<string, string>): any {
    const clone = JSON.parse(JSON.stringify(resource));
    delete clone.id;
    delete clone.linkedProcedures;
    delete clone.fhirBundleStr;
    return this.remapReferences(clone, referenceMap);
  }

  private remapReferences(value: any, referenceMap: Map<string, string>): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.remapReferences(item, referenceMap));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const remappedObject: any = {};
    Object.entries(value).forEach(([key, childValue]) => {
      if (key === 'reference' && typeof childValue === 'string' && referenceMap.has(childValue)) {
        remappedObject[key] = referenceMap.get(childValue);
        return;
      }

      remappedObject[key] = this.remapReferences(childValue, referenceMap);
    });

    return remappedObject;
  }

  private createTransactionFullUrl(seed: string): string {
    const safeSeed = seed.replace(/[^a-zA-Z0-9-]/g, '-');
    return `urn:uuid:${safeSeed}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
