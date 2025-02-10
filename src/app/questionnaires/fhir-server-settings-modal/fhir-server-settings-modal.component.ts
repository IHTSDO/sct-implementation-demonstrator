import { Component, OnInit, ViewChild } from '@angular/core';
import { FhirService } from '../../services/fhir.service';
import { NgForm } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-fhir-server-settings-modal',
    templateUrl: './fhir-server-settings-modal.component.html',
    styleUrls: ['./fhir-server-settings-modal.component.css'],
    standalone: false
})
export class FhirServerSettingsModalComponent implements OnInit {
  baseUrl: string = '';
  userTag: string = '';

  constructor(private fhirService: FhirService, private dialogRef: MatDialogRef<FhirServerSettingsModalComponent>) {}

  @ViewChild('settingsForm') settingsForm!: NgForm;

  ngAfterViewInit() {
    this.triggerValidation();
  }

  triggerValidation() {
    Object.keys(this.settingsForm.controls).forEach(field => {
      const control = this.settingsForm.control.get(field);
      control?.markAsTouched({ onlySelf: true });
      control?.markAsDirty({ onlySelf: true });
    });
  }

  ngOnInit() {
    this.baseUrl = this.fhirService.getBaseUrl()
    this.userTag = this.fhirService.getUserTag();
  }

  updateSettings() {
    if (this.settingsForm.valid) {
      this.fhirService.setBaseUrl(this.baseUrl);
      this.fhirService.setUserTag(this.userTag);
      this.dialogRef.close('save');
    }
    
  }
}
