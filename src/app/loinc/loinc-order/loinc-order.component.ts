import { Component, EventEmitter, Input, Output } from '@angular/core';
import saveAs from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
import { v3 as uuidv3 } from 'uuid';
import { LaboratoryOrderGroup, ServiceRequest } from 'src/app/services/patient.service';

@Component({
  selector: 'app-loinc-order',
  templateUrl: './loinc-order.component.html',
  styleUrl: './loinc-order.component.css',
  standalone: false
})
export class LoincOrderComponent {
  @Input() patient: any = null;
  @Input() showSaveAction = false;
  @Output() orderSaved = new EventEmitter<LaboratoryOrderGroup>();

  showLoincCodes = true;
  showFhirView = false;
  fhirBundle: any = {};
  fhirBundleStr = '';
  readonly uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  serviceRequests: ServiceRequest[] = [];

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

  constructor(private clipboard: Clipboard) {
    this.updateFHIRBundle();
  }

  get activePatient() {
    return this.patient || this.samplePatient;
  }

  handleServiceRequestCreated(serviceRequest: ServiceRequest) {
    const alreadySelected = this.serviceRequests.some((existing) => this.getSnomedCode(existing) === this.getSnomedCode(serviceRequest));
    if (alreadySelected) {
      return;
    }

    this.serviceRequests = [...this.serviceRequests, serviceRequest];
    this.updateFHIRBundle();
  }

  toggleLoincCodes() {
    this.showLoincCodes = !this.showLoincCodes;
  }

  removeFromOrder(index: number) {
    this.serviceRequests.splice(index, 1);
    this.serviceRequests = [...this.serviceRequests];
    this.updateFHIRBundle();
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  hasDraftOrder(): boolean {
    return this.serviceRequests.length > 0;
  }

  flipCard() {
    this.showFhirView = !this.showFhirView;
  }

  saveCurrentOrder() {
    if (!this.hasDraftOrder()) {
      return;
    }

    const now = new Date().toISOString();
    const labOrder: LaboratoryOrderGroup = {
      id: `lab-order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      patientId: this.activePatient.id,
      patientDisplay: this.getPatientDisplayName(),
      createdAt: now,
      serviceRequests: JSON.parse(JSON.stringify(this.serviceRequests)),
      fhirBundle: JSON.parse(JSON.stringify(this.fhirBundle)),
      fhirBundleStr: this.fhirBundleStr
    };

    this.orderSaved.emit(labOrder);
    this.serviceRequests = [];
    this.showFhirView = false;
    this.updateFHIRBundle();
  }

  saveFhirResource() {
    const blob = new Blob([this.fhirBundleStr], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'request-bundle.json');
  }

  copyToClipboard(text: string) {
    this.clipboard.copy(text);
  }

  getDisplayText(serviceRequest: ServiceRequest): string {
    return serviceRequest.code?.text || serviceRequest.code?.coding?.[0]?.display || 'Unnamed order';
  }

  getDisplayedCode(serviceRequest: ServiceRequest): string {
    if (this.showLoincCodes) {
      return this.getLoincCode(serviceRequest) || '-------';
    }

    return this.getSnomedCode(serviceRequest) || '-------';
  }

  getSpecimens(): Array<{ code: string; display: string; version?: string; reference?: string }> {
    const specimensMap = new Map<string, { code: string; display: string; version?: string; reference?: string }>();

    this.serviceRequests.forEach((request) => {
      request.specimen?.forEach((specimenRef) => {
        const code = specimenRef.identifier?.value;
        if (!code || specimensMap.has(code)) {
          return;
        }

        specimensMap.set(code, {
          code,
          display: specimenRef.display || code,
          version: this.getSnomedVersion(request),
          reference: specimenRef.reference
        });
      });
    });

    return Array.from(specimensMap.values());
  }

  private getSnomedCoding(serviceRequest: ServiceRequest) {
    return serviceRequest.code?.coding?.find((coding) => coding.system === 'http://snomed.info/sct');
  }

  private getLoincCoding(serviceRequest: ServiceRequest) {
    return serviceRequest.code?.coding?.find((coding) => coding.system === 'http://loinc.org');
  }

  private getSnomedCode(serviceRequest: ServiceRequest): string {
    return this.getSnomedCoding(serviceRequest)?.code || '';
  }

  private getLoincCode(serviceRequest: ServiceRequest): string {
    return this.getLoincCoding(serviceRequest)?.code || '';
  }

  private getSnomedVersion(serviceRequest: ServiceRequest): string {
    return this.getSnomedCoding(serviceRequest)?.version || 'http://snomed.info/sct';
  }

  updateFHIRBundle() {
    this.fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: []
    };

    this.serviceRequests.forEach((serviceRequest) => {
      this.fhirBundle.entry.push({
        fullUrl: `urn:uuid:${uuidv3(serviceRequest.id, this.uuidNamespace)}`,
        resource: serviceRequest
      });
    });

    this.getSpecimens().forEach((specimen) => {
      this.fhirBundle.entry.push({
        fullUrl: specimen.reference || `urn:uuid:${uuidv3(specimen.code, this.uuidNamespace)}`,
        resource: {
          resourceType: 'Specimen',
          id: specimen.code,
          type: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                version: specimen.version,
                code: specimen.code,
                display: specimen.display
              }
            ],
            text: specimen.display
          },
          text: {
            status: 'generated',
            div: `<div xmlns="http://www.w3.org/1999/xhtml">Specimen for ${specimen.display}</div>`
          }
        }
      });
    });

    this.fhirBundle.entry.push({
      fullUrl: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      resource: this.activePatient
    });

    this.fhirBundleStr = JSON.stringify(this.fhirBundle, null, 2);
  }

  getPatientDisplayName(): string {
    const name = this.activePatient?.name?.[0];
    if (name?.text) return name.text;
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
}
