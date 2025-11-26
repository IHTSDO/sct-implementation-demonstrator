import { Component, OnInit, AfterViewInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ValuesetDialogComponent } from '../valueset-dialog/valueset-dialog.component';

export interface ServiceRequestData {
  identifier: string;
  status: string;
  intent: string;
  priority: string;
  code: {
    code: string;
    system: string;
    display: string;
  } | null;
  subject: {
    reference: string;
    display: string;
  } | null;
  authoredOn: Date | null;
  requester: {
    reference: string;
    display: string;
  } | null;
  reasonCode: {
    code: string;
    system: string;
    display: string;
  } | null;
  bodySite: {
    code: string;
    display: string;
  } | null;
}

@Component({
  selector: 'app-service-request-form',
  templateUrl: './service-request-form.component.html',
  styleUrls: ['./service-request-form.component.css'],
  standalone: false
})
export class ServiceRequestFormComponent implements OnInit, AfterViewInit {
  serviceRequestForm: FormGroup;
  isViewOnly: boolean = false;

  // Binding for Body Site autocomplete
  bodySiteBinding = {
    ecl: '<< 442083009 |Anatomical or acquired body structure (body structure)|',
    title: 'Body Site',
    note: 'Search for anatomical body structures'
  };

  // Status options from FHIR RequestStatus ValueSet
  // https://hl7.org/fhir/R4/valueset-request-status.html
  statusOptions = [
    { code: 'draft', display: 'Draft', definition: 'The request has been created but is not yet complete or ready for action.' },
    { code: 'active', display: 'Active', definition: 'The request is ready to be acted upon and is awaiting action.' },
    { code: 'on-hold', display: 'On Hold', definition: 'The request has been held by an originator, receiver, or other party and may be acted upon later.' },
    { code: 'revoked', display: 'Revoked', definition: 'The request (and any implicit authorization to act) has been terminated prior to the known full completion of the intended actions.' },
    { code: 'completed', display: 'Completed', definition: 'The request has been completed (fulfilled or denied).' },
    { code: 'entered-in-error', display: 'Entered in Error', definition: 'The request was entered in error and should not be acted upon.' },
    { code: 'unknown', display: 'Unknown', definition: 'The authoring/source system does not know which of the status values currently applies for this request.' }
  ];

  // Intent options from FHIR RequestIntent ValueSet
  // https://hl7.org/fhir/R4/valueset-request-intent.html
  intentOptions = [
    { code: 'proposal', display: 'Proposal', definition: 'The request is a suggestion made by someone/something that doesn\'t have the authority to make it a proper order.' },
    { code: 'plan', display: 'Plan', definition: 'The request represents an intention to ensure something occurs without providing an authorization for others to act.' },
    { code: 'directive', display: 'Directive', definition: 'The request represents a legally binding instruction authored by a Patient or RelatedPerson.' },
    { code: 'order', display: 'Order', definition: 'The request represents a request/demand and authorization for action by a Practitioner.' },
    { code: 'original-order', display: 'Original Order', definition: 'The request represents an original authorization for action.' },
    { code: 'reflex-order', display: 'Reflex Order', definition: 'The request represents an automatically generated supplemental authorization for action based on a parent authorization together with initial results of the action taken against that parent authorization.' },
    { code: 'filler-order', display: 'Filler Order', definition: 'The request represents the view of an authorization instantiated by a fulfilling system representing the details of the fulfiller\'s intention to act upon a submitted order.' },
    { code: 'instance-order', display: 'Instance Order', definition: 'An order created in response to an order that was created by another system.' },
    { code: 'option', display: 'Option', definition: 'The request represents a component or option for a RequestGroup that establishes timing, conditionality and/or other constraints among a set of requests.' }
  ];

  // Priority options from FHIR RequestPriority ValueSet
  // https://hl7.org/fhir/R4/valueset-request-priority.html
  priorityOptions = [
    { code: 'routine', display: 'Routine', definition: 'The request has normal priority.' },
    { code: 'urgent', display: 'Urgent', definition: 'The request should be actioned promptly - higher priority than routine.' },
    { code: 'asap', display: 'ASAP', definition: 'The request should be actioned as soon as possible - higher priority than urgent.' },
    { code: 'stat', display: 'STAT', definition: 'The request should be actioned immediately - highest possible priority.' }
  ];

  // Code options - Common laboratory test codes (LOINC)
  codeOptions = [
    { code: '24356-8', system: 'http://loinc.org', display: 'Complete blood count (CBC) with differential panel' },
    { code: '24323-8', system: 'http://loinc.org', display: 'Basic metabolic panel' },
    { code: '57698-3', system: 'http://loinc.org', display: 'Lipid panel with direct LDL' },
    { code: '24325-3', system: 'http://loinc.org', display: 'Comprehensive metabolic panel' },
    { code: '24320-4', system: 'http://loinc.org', display: 'Liver function panel' },
    { code: '24359-2', system: 'http://loinc.org', display: 'Complete blood count (CBC) panel' },
    { code: '24357-6', system: 'http://loinc.org', display: 'Complete blood count (CBC) with manual differential panel' },
    { code: '24358-4', system: 'http://loinc.org', display: 'Complete blood count (CBC) with automated differential panel' }
  ];

  // Reason Code options - Common reasons for laboratory orders
  reasonCodeOptions = [
    { code: '182836005', system: 'http://snomed.info/sct', display: 'Review of medication' },
    { code: '390906007', system: 'http://snomed.info/sct', display: 'Follow-up examination' },
    { code: '183061000', system: 'http://snomed.info/sct', display: 'Routine health check' },
    { code: '185349003', system: 'http://snomed.info/sct', display: 'Consultation for symptom' },
    { code: '271428004', system: 'http://snomed.info/sct', display: 'Monitoring of treatment' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ServiceRequestFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog
  ) {
    this.serviceRequestForm = this.createForm();
    // Check if data contains viewOnly flag
    if (this.data && typeof this.data === 'object') {
      if ('viewOnly' in this.data) {
        this.isViewOnly = this.data.viewOnly === true;
      }
      if (this.isViewOnly) {
        this.serviceRequestForm.disable();
      }
    }
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    // Load data after view is initialized to ensure all form controls are ready
    if (this.data) {
      const dataToLoad = (this.data && typeof this.data === 'object' && 'serviceRequest' in this.data) ? this.data.serviceRequest : this.data;
      this.loadFormData(dataToLoad);
      // Disable form if viewOnly mode
      if (this.isViewOnly) {
        this.serviceRequestForm.disable();
      }
    }
  }

  private loadFormData(data: ServiceRequestData): void {
    setTimeout(() => {
      const matchedCode = data.code && data.code.code ? this.codeOptions.find(opt => opt.code === data.code!.code) : null;
      const matchedReasonCode = data.reasonCode && data.reasonCode.code ? this.reasonCodeOptions.find(opt => opt.code === data.reasonCode!.code) : null;

      this.serviceRequestForm.patchValue({
        identifier: data.identifier || '',
        status: data.status || '',
        intent: data.intent || '',
        priority: data.priority || '',
        code: matchedCode || null,
        subject: data.subject || null,
        authoredOn: data.authoredOn ? new Date(data.authoredOn) : null,
        requester: data.requester || null,
        reasonCode: matchedReasonCode || null,
        bodySite: data.bodySite || null
      }, { emitEvent: false });
    }, 100);
  }

  private createForm(): FormGroup {
    return this.fb.group({
      identifier: [''],
      status: ['draft', Validators.required],
      intent: ['order', Validators.required],
      priority: ['routine', Validators.required],
      code: [null, Validators.required],
      subject: [null],
      authoredOn: [null],
      requester: [null],
      reasonCode: [null, Validators.required],
      bodySite: [null]
    });
  }

  onSubmit(): void {
    if (this.serviceRequestForm.valid) {
      const formData = this.serviceRequestForm.value as ServiceRequestData;
      this.dialogRef.close(formData);
    } else {
      Object.keys(this.serviceRequestForm.controls).forEach(key => {
        this.serviceRequestForm.get(key)?.markAsTouched();
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getStatusDefinition(code: string): string {
    const status = this.statusOptions.find(opt => opt.code === code);
    return status ? status.definition : '';
  }

  getSubjectDisplay(): string {
    const subject = this.serviceRequestForm.get('subject')?.value;
    if (subject && typeof subject === 'object') {
      return subject.display || subject.reference || '';
    }
    return '';
  }

  getRequesterDisplay(): string {
    const requester = this.serviceRequestForm.get('requester')?.value;
    if (requester && typeof requester === 'object') {
      return requester.display || requester.reference || '';
    }
    return '';
  }

  openValuesetDialog(valuesetUrl: string, fieldName: string, dialogTitle?: string): void {
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      autoFocus: false,
      restoreFocus: true,
      data: { url: valuesetUrl, fieldName: fieldName, dialogTitle: dialogTitle },
      panelClass: 'valueset-dialog-container'
    });
  }
}

