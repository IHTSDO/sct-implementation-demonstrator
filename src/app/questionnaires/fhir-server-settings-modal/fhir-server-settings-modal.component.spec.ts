import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FhirServerSettingsModalComponent } from './fhir-server-settings-modal.component';

describe('FhirServerSettingsModalComponent', () => {
  let component: FhirServerSettingsModalComponent;
  let fixture: ComponentFixture<FhirServerSettingsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FhirServerSettingsModalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FhirServerSettingsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
