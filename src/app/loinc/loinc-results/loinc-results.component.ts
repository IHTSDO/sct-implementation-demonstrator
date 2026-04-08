import { Clipboard } from '@angular/cdk/clipboard';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import saveAs from 'file-saver';
import { v3 as uuidv3 } from 'uuid';
import type { ServiceRequest } from 'src/app/model';
import { LoincGrouperCacheService } from '../loinc-grouper-cache.service';
import {
  GrouperResolutionDialogResult,
  LoincGrouperResolutionDialogComponent
} from '../loinc-grouper-resolution-dialog/loinc-grouper-resolution-dialog.component';
import { LoincResultLoaderDialogComponent } from '../loinc-result-loader-dialog/loinc-result-loader-dialog.component';

type ResultTemplate = {
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
};

type ReportRow = {
  id: string;
  rowKind: 'service-request' | 'resolved-child';
  serviceRequest: ServiceRequest;
  parentServiceRequestId?: string;
  observationCoding: Array<{ system?: string; version?: string; code?: string; display?: string }>;
  observationText: string;
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
  isGrouper: boolean;
  isLoaded: boolean;
  level: number;
};

@Component({
  selector: 'app-loinc-results',
  templateUrl: './loinc-results.component.html',
  styleUrl: './loinc-results.component.css',
  standalone: false
})
export class LoincResultsComponent implements OnChanges {
  @Input() patient: any = null;
  @Input() serviceRequests: ServiceRequest[] = [];
  @Output() pendingCountChanged = new EventEmitter<number>();

  isFlipped = false;
  fhirBundle: any = {};
  fhirBundleStr = '';
  selectedResultId: string | null = null;

  readonly uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  readonly grouperRequestExtensionUrl = 'http://snomedians.org/fhir/StructureDefinition/original-grouper-request';
  readonly samplePatient = {
    resourceType: 'Patient',
    id: 'example-patient',
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient Jane Doe</div>'
    },
    identifier: [
      {
        system: 'http://hospital.org/mrn',
        value: '1234567890'
      }
    ],
    name: [
      {
        use: 'official',
        family: 'Doe',
        given: ['Jane']
      }
    ],
    telecom: [
      {
        system: 'phone',
        value: '123-456-7890',
        use: 'home'
      },
      {
        system: 'email',
        value: 'jane@email.com',
        use: 'home'
      }
    ],
    birthDate: '1970-01-01',
    address: [
      {
        use: 'home',
        line: ['123 Main St'],
        city: 'Anytown',
        country: 'USA'
      }
    ]
  };

  readonly resultTemplatesByLoincCode: Record<string, ResultTemplate> = {
    '14771-0': {
      value: '87',
      unitDisplay: 'mg/dL',
      unitCode: '258797006',
      unitSystem: 'http://snomed.info/sct',
      referenceLow: '65',
      referenceHigh: '125'
    },
    '39791-9': {
      value: '140.0',
      unitDisplay: 'mmol/L',
      unitCode: '258813002',
      unitSystem: 'http://snomed.info/sct',
      referenceLow: '135.0',
      referenceHigh: '144.0'
    },
    '39789-3': {
      value: '4.6',
      unitDisplay: 'mmol/L',
      unitCode: '258813002',
      unitSystem: 'http://snomed.info/sct',
      referenceLow: '3.6',
      referenceHigh: '5.1'
    },
    '41649-5': {
      value: '106.0',
      unitDisplay: 'mmol/L',
      unitCode: '258813002',
      unitSystem: 'http://snomed.info/sct',
      referenceLow: '99.0',
      referenceHigh: '108.0'
    }
  };

  rows: ReportRow[] = [];
  private resolvedChildRows: ReportRow[] = [];

  constructor(
    private clipboard: Clipboard,
    private loincGrouperCacheService: LoincGrouperCacheService,
    private dialog: MatDialog
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['serviceRequests'] || changes['patient']) {
      this.syncRowsFromServiceRequests();
    }
  }

  get activePatient() {
    return this.patient || this.samplePatient;
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  getPatientDisplayName(): string {
    const name = this.activePatient?.name?.[0];
    if (name?.text) {
      return name.text;
    }
    const parts = [...(name?.given || []), name?.family].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Jane Doe';
  }

  getPatientIdentifier(): string {
    return this.activePatient?.identifier?.[0]?.value || '1234567890';
  }

  getPatientBirthDate(): string {
    return this.activePatient?.birthDate || '1970-01-01';
  }

  getPatientAddressLine(): string {
    return this.activePatient?.address?.[0]?.line?.[0] || '123 Main St';
  }

  getPatientAddressCity(): string {
    const address = this.activePatient?.address?.[0];
    return [address?.city, address?.country].filter(Boolean).join(', ') || 'Anytown, USA';
  }

  getPatientPhone(): string {
    return this.activePatient?.telecom?.find((item: any) => item.system === 'phone')?.value || '123-456-7890';
  }

  getPatientEmail(): string {
    return this.activePatient?.telecom?.find((item: any) => item.system === 'email')?.value || 'jane@email.com';
  }

  getDisplayText(row: ReportRow): string {
    return row.observationText;
  }

  getResolutionSourceText(row: ReportRow): string {
    if (!row.parentServiceRequestId) {
      return '';
    }

    const parentRequest = this.serviceRequests.find((candidate) => candidate.id === row.parentServiceRequestId);
    return parentRequest?.code?.text || parentRequest?.code?.coding?.[0]?.display || 'original grouper';
  }

  getLoincCode(row: ReportRow): string {
    return row.observationCoding.find((coding) => coding.system === 'http://loinc.org')?.code || 'n/a';
  }

  getSnomedCode(row: ReportRow): string {
    return row.observationCoding.find((coding) => coding.system === 'http://snomed.info/sct')?.code || 'n/a';
  }

  isCompleted(row: ReportRow): boolean {
    return !!row.value && !!row.unitDisplay && !!row.referenceLow && !!row.referenceHigh;
  }

  isChildRow(row: ReportRow): boolean {
    return row.rowKind === 'resolved-child';
  }

  selectResult(row: ReportRow) {
    this.selectedResultId = row.id;

    if (row.isGrouper) {
      this.openGrouperResolutionDialog(row);
      return;
    }

    if (!row.isLoaded) {
      this.applyTemplate(row);
    }

    const dialogRef = this.dialog.open(LoincResultLoaderDialogComponent, {
      width: '760px',
      maxWidth: '92vw',
      data: {
        result: row,
        displayText: this.getDisplayText(row)
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      row.isLoaded = this.isCompleted(row);
      this.createFhirDiagnosticReportBundle();
      this.emitPendingCount();
      this.selectedResultId = null;
    });
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
  }

  saveFhirResource() {
    const blob = new Blob([this.fhirBundleStr], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'diagnostic-report-bundle.json');
  }

  copyToClipboard(text: string) {
    this.clipboard.copy(text);
  }

  private syncRowsFromServiceRequests() {
    const previousRootRows = new Map(
      this.rows
        .filter((row) => row.rowKind === 'service-request')
        .map((row) => [row.serviceRequest.id, row])
    );
    const validParentIds = new Set(this.serviceRequests.map((serviceRequest) => serviceRequest.id));
    this.resolvedChildRows = this.resolvedChildRows.filter((row) => !!row.parentServiceRequestId && validParentIds.has(row.parentServiceRequestId));

    const rootRows = this.serviceRequests.map((serviceRequest) => {
      const previousRow = previousRootRows.get(serviceRequest.id);
      return {
        id: serviceRequest.id,
        rowKind: 'service-request' as const,
        serviceRequest,
        observationCoding: previousRow?.observationCoding || [...(serviceRequest.code?.coding || [])],
        observationText: previousRow?.observationText || (serviceRequest.code?.text || serviceRequest.code?.coding?.[0]?.display || 'Unnamed test'),
        value: previousRow?.value || '',
        unitDisplay: previousRow?.unitDisplay || '',
        unitCode: previousRow?.unitCode || '',
        unitSystem: previousRow?.unitSystem || 'http://unitsofmeasure.org',
        referenceLow: previousRow?.referenceLow || '',
        referenceHigh: previousRow?.referenceHigh || '',
        isGrouper: previousRow?.isGrouper || false,
        isLoaded: previousRow?.isLoaded || false,
        level: 0
      };
    });

    rootRows.forEach((row) => this.markGrouper(row));
    this.rebuildRows(rootRows);
    this.createFhirDiagnosticReportBundle();
  }

  private rebuildRows(rootRows?: ReportRow[]) {
    const roots = rootRows || this.rows.filter((row) => row.rowKind === 'service-request');
    const nextRows: ReportRow[] = [];

    roots.forEach((row) => {
      const children = this.resolvedChildRows
        .filter((child) => child.parentServiceRequestId === row.serviceRequest.id)
        .map((child) => ({ ...child, level: row.isGrouper ? 0 : 1 }));

      if (row.isGrouper && children.length > 0) {
        nextRows.push(...children);
        return;
      }

      nextRows.push({ ...row, level: 0 });
      nextRows.push(...children);
    });

    this.rows = nextRows;
    this.emitPendingCount();
  }

  private markGrouper(row: ReportRow) {
    const snomedCoding = row.serviceRequest.code?.coding?.find((coding) => coding.system === 'http://snomed.info/sct');
    const version = snomedCoding?.version || '';
    const code = snomedCoding?.code || '';

    if (!version || !code) {
      row.isGrouper = false;
      return;
    }

    this.loincGrouperCacheService.warmGroupers('https://browser.loincsnomed.org/fhir', version).subscribe({
      next: () => {
        row.isGrouper = this.loincGrouperCacheService.isGrouper(version, code);
        this.rebuildRows();
      }
    });
  }

  private applyTemplate(row: ReportRow) {
    const loincCode = this.getLoincCode(row);
    const template = this.resultTemplatesByLoincCode[loincCode];

    if (!template) {
      return;
    }

    row.value = template.value;
    row.unitDisplay = template.unitDisplay;
    row.unitCode = template.unitCode;
    row.unitSystem = template.unitSystem;
    row.referenceLow = template.referenceLow;
    row.referenceHigh = template.referenceHigh;
    row.isLoaded = true;
  }

  private openGrouperResolutionDialog(row: ReportRow) {
    const snomedCoding = row.serviceRequest.code?.coding?.find((coding) => coding.system === 'http://snomed.info/sct');
    if (!snomedCoding?.code || !snomedCoding.version) {
      return;
    }

    const dialogRef = this.dialog.open(LoincGrouperResolutionDialogComponent, {
      width: '920px',
      maxWidth: '94vw',
      data: {
        grouperCode: snomedCoding.code,
        grouperDisplay: this.getDisplayText(row),
        activeEditionVersion: snomedCoding.version,
        resultTemplatesByLoincCode: this.resultTemplatesByLoincCode
      }
    });

    dialogRef.afterClosed().subscribe((result: GrouperResolutionDialogResult | null) => {
      if (!result) {
        this.selectedResultId = null;
        return;
      }

      const childRow: ReportRow = {
        id: `resolved-${row.serviceRequest.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rowKind: 'resolved-child',
        serviceRequest: row.serviceRequest,
        parentServiceRequestId: row.serviceRequest.id,
        observationCoding: result.coding,
        observationText: result.text,
        value: result.value,
        unitDisplay: result.unitDisplay,
        unitCode: result.unitCode,
        unitSystem: result.unitSystem,
        referenceLow: result.referenceLow,
        referenceHigh: result.referenceHigh,
        isGrouper: false,
        isLoaded: !!result.value || !!result.unitDisplay || !!result.referenceLow || !!result.referenceHigh,
        level: 1
      };

      this.resolvedChildRows = [...this.resolvedChildRows, childRow];
      this.rebuildRows();
      this.createFhirDiagnosticReportBundle();
      this.selectedResultId = null;
    });
  }

  private createFhirDiagnosticReportBundle() {
    const resultBearingRows = this.rows.filter((row) => !row.isGrouper && this.isCompleted(row));
    const serviceRequestEntries = this.serviceRequests.map((serviceRequest) => ({
      fullUrl: this.getServiceRequestFullUrl(serviceRequest),
      resource: serviceRequest
    }));

    this.fhirBundle = {
      resourceType: 'Bundle',
      id: 'example-bundle',
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      },
      type: 'collection',
      entry: [
        {
          fullUrl: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          resource: this.activePatient
        },
        ...serviceRequestEntries
      ]
    };

    if (resultBearingRows.length) {
      this.fhirBundle.entry.push({
        fullUrl: `urn:uuid:${uuidv3('diagnostic-report', this.uuidNamespace)}`,
        resource: {
          resourceType: 'DiagnosticReport',
          id: 'diagnostic-report-loinc-demo',
          status: 'final',
          code: {
            text: 'Laboratory report'
          },
          subject: {
            reference: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            display: this.getPatientDisplayName()
          },
          effectiveDateTime: this.getCurrentDate(),
          result: resultBearingRows.map((row) => ({
            reference: this.getObservationFullUrl(row)
          }))
        }
      });
    }

    resultBearingRows.forEach((row, index) => {
      const basedOnReference = this.getServiceRequestFullUrl(row.serviceRequest);
      const resource: any = {
        resourceType: 'Observation',
        id: `ob-${index}`,
        status: 'final',
        subject: {
          reference: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        },
        code: {
          coding: row.observationCoding,
          text: row.observationText
        },
        valueQuantity: {
          value: parseFloat(row.value),
          unit: row.unitDisplay,
          system: row.unitSystem || 'http://unitsofmeasure.org',
          code: row.unitCode || row.unitDisplay
        },
        referenceRange: [
          {
            low: {
              value: parseFloat(row.referenceLow),
              unit: row.unitDisplay,
              system: row.unitSystem || 'http://unitsofmeasure.org',
              code: row.unitCode || row.unitDisplay
            },
            high: {
              value: parseFloat(row.referenceHigh),
              unit: row.unitDisplay,
              system: row.unitSystem || 'http://unitsofmeasure.org',
              code: row.unitCode || row.unitDisplay
            }
          }
        ],
        basedOn: [
          {
            reference: basedOnReference
          }
        ]
      };

      if (row.rowKind === 'resolved-child') {
        resource.extension = [
          {
            url: this.grouperRequestExtensionUrl,
            valueReference: {
              reference: basedOnReference
            }
          }
        ];
      }

      this.fhirBundle.entry.push({
        fullUrl: this.getObservationFullUrl(row),
        resource
      });
    });

    this.fhirBundleStr = JSON.stringify(this.fhirBundle, null, 2);
  }

  private emitPendingCount() {
    const pendingCount = this.rows.filter((row) => {
      if (row.isGrouper) {
        return true;
      }

      return !this.isCompleted(row);
    }).length;

    this.pendingCountChanged.emit(pendingCount);
  }

  private getServiceRequestFullUrl(serviceRequest: ServiceRequest): string {
    return `urn:uuid:${uuidv3(serviceRequest.id, this.uuidNamespace)}`;
  }

  private getObservationFullUrl(row: ReportRow): string {
    return `urn:uuid:${uuidv3('ob' + row.id, this.uuidNamespace)}`;
  }
}
