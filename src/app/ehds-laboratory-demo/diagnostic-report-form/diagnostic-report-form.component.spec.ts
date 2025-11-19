import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiagnosticReportFormComponent } from './diagnostic-report-form.component';

describe('DiagnosticReportFormComponent', () => {
  let component: DiagnosticReportFormComponent;
  let fixture: ComponentFixture<DiagnosticReportFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DiagnosticReportFormComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiagnosticReportFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

