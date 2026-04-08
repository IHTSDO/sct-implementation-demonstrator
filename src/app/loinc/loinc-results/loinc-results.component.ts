import { Clipboard } from '@angular/cdk/clipboard';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import saveAs from 'file-saver';
import { v3 as uuidv3 } from 'uuid';
import type { ServiceRequest } from 'src/app/model';
import { LoincGrouperCacheService } from '../loinc-grouper-cache.service';
import { LoincResultLoaderDialogComponent } from '../loinc-result-loader-dialog/loinc-result-loader-dialog.component';

type ResultTemplate = {
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
};

type ResultEntry = {
  id: string;
  serviceRequest: ServiceRequest;
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
  isGrouper: boolean;
  isLoaded: boolean;
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

  isFlipped = false;
  fhirBundle: any = {};
  fhirBundleStr = '';
  selectedResultId: string | null = null;

  readonly uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
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

  results: ResultEntry[] = [];

  constructor(
    private clipboard: Clipboard,
    private loincGrouperCacheService: LoincGrouperCacheService,
    private dialog: MatDialog
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['serviceRequests'] || changes['patient']) {
      this.syncResultsFromServiceRequests();
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

  getDisplayText(serviceRequest: ServiceRequest): string {
    return serviceRequest.code?.text || serviceRequest.code?.coding?.[0]?.display || 'Unnamed test';
  }

  getLoincCode(serviceRequest: ServiceRequest): string {
    return serviceRequest.code.coding?.find((coding) => coding.system === 'http://loinc.org')?.code || 'n/a';
  }

  getSnomedCode(serviceRequest: ServiceRequest): string {
    return serviceRequest.code.coding?.find((coding) => coding.system === 'http://snomed.info/sct')?.code || 'n/a';
  }

  isCompleted(entry: ResultEntry): boolean {
    return !!entry.value && !!entry.unitDisplay && !!entry.referenceLow && !!entry.referenceHigh;
  }

  isClickable(entry: ResultEntry): boolean {
    return !entry.isGrouper;
  }

  selectResult(entry: ResultEntry) {
    if (!this.isClickable(entry)) {
      return;
    }

    this.selectedResultId = entry.id;
    if (!entry.isLoaded) {
      this.loadTemplate(entry);
    }
    const dialogRef = this.dialog.open(LoincResultLoaderDialogComponent, {
      width: '760px',
      maxWidth: '92vw',
      data: {
        result: entry,
        displayText: this.getDisplayText(entry.serviceRequest)
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      entry.isLoaded = !!entry.value || !!entry.unitDisplay || !!entry.referenceLow || !!entry.referenceHigh;
      this.createFhirDiagnosticReportBundle();
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

  private syncResultsFromServiceRequests() {
    const previousResults = new Map(this.results.map((entry) => [entry.id, entry]));
    this.results = this.serviceRequests.map((serviceRequest) => {
      const previous = previousResults.get(serviceRequest.id);
      const entry = {
        id: serviceRequest.id,
        serviceRequest,
        value: previous?.value || '',
        unitDisplay: previous?.unitDisplay || '',
        unitCode: previous?.unitCode || '',
        unitSystem: previous?.unitSystem || 'http://unitsofmeasure.org',
        referenceLow: previous?.referenceLow || '',
        referenceHigh: previous?.referenceHigh || '',
        isGrouper: false,
        isLoaded: previous?.isLoaded || false
      };

      this.markGrouper(entry);
      return entry;
    });

    const selectedStillExists = this.results.some((entry) => entry.id === this.selectedResultId);
    this.selectedResultId = selectedStillExists ? this.selectedResultId : this.results.find((entry) => !entry.isGrouper)?.id || null;
    this.createFhirDiagnosticReportBundle();
  }

  private markGrouper(entry: ResultEntry) {
    const snomedCoding = entry.serviceRequest.code?.coding?.find((coding) => coding.system === 'http://snomed.info/sct');
    const version = snomedCoding?.version || '';
    const code = snomedCoding?.code || '';

    if (!version || !code) {
      entry.isGrouper = false;
      return;
    }

    this.loincGrouperCacheService.warmGroupers('https://browser.loincsnomed.org/fhir', version).subscribe({
      next: () => {
        entry.isGrouper = this.loincGrouperCacheService.isGrouper(version, code);
      }
    });
  }

  private loadTemplate(entry: ResultEntry) {
    const loincCoding = entry.serviceRequest.code?.coding?.find((coding) => coding.system === 'http://loinc.org');
    const template = loincCoding?.code ? this.resultTemplatesByLoincCode[loincCoding.code] : null;

    if (template) {
      entry.value = template.value;
      entry.unitDisplay = template.unitDisplay;
      entry.unitCode = template.unitCode;
      entry.unitSystem = template.unitSystem;
      entry.referenceLow = template.referenceLow;
      entry.referenceHigh = template.referenceHigh;
      entry.isLoaded = true;
    } else if (!entry.isLoaded) {
      entry.value = '';
      entry.unitDisplay = '';
      entry.unitCode = '';
      entry.unitSystem = 'http://unitsofmeasure.org';
      entry.referenceLow = '';
      entry.referenceHigh = '';
    }

    this.createFhirDiagnosticReportBundle();
  }

  private createFhirDiagnosticReportBundle() {
    const completedResults = this.results.filter((entry) => this.isCompleted(entry));

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
        }
      ]
    };

    if (completedResults.length) {
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
          result: completedResults.map((entry) => ({
            reference: `urn:uuid:${uuidv3('ob' + entry.id, this.uuidNamespace)}`
          }))
        }
      });
    }

    completedResults.forEach((entry, index) => {
      this.fhirBundle.entry.push({
        fullUrl: `urn:uuid:${uuidv3('ob' + entry.id, this.uuidNamespace)}`,
        resource: {
          resourceType: 'Observation',
          id: `ob-${index}`,
          status: 'final',
          subject: {
            reference: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8'
          },
          code: {
            coding: entry.serviceRequest.code?.coding || [],
            text: this.getDisplayText(entry.serviceRequest)
          },
          valueQuantity: {
            value: parseFloat(entry.value),
            unit: entry.unitDisplay,
            system: entry.unitSystem || 'http://unitsofmeasure.org',
            code: entry.unitCode || entry.unitDisplay
          },
          referenceRange: [
            {
              low: {
                value: parseFloat(entry.referenceLow),
                unit: entry.unitDisplay,
                system: entry.unitSystem || 'http://unitsofmeasure.org',
                code: entry.unitCode || entry.unitDisplay
              },
              high: {
                value: parseFloat(entry.referenceHigh),
                unit: entry.unitDisplay,
                system: entry.unitSystem || 'http://unitsofmeasure.org',
                code: entry.unitCode || entry.unitDisplay
              }
            }
          ],
          basedOn: [
            {
              reference: entry.serviceRequest.id
            }
          ]
        }
      });
    });

    this.fhirBundleStr = JSON.stringify(this.fhirBundle, null, 2);
  }
}
