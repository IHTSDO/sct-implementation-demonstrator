import { Component, OnInit } from '@angular/core';
import { FhirService } from '../../services/fhir.service';

@Component({
  selector: 'app-fhir-server-settings-modal',
  templateUrl: './fhir-server-settings-modal.component.html',
  styleUrls: ['./fhir-server-settings-modal.component.css']
})
export class FhirServerSettingsModalComponent implements OnInit {
  baseUrl: string = '';
  userTag: string = '';

  constructor(private fhirService: FhirService) {}

  ngOnInit() {
    this.fhirService.baseUrl$.subscribe(url => this.baseUrl = url);
    this.fhirService.userTag$.subscribe(tag => this.userTag = tag);
  }

  updateSettings() {
    this.fhirService.setBaseUrl(this.baseUrl);
    this.fhirService.setUserTag(this.userTag);
  }
}
