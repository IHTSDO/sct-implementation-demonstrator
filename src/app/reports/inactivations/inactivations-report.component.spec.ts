import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InactivationsReportComponent } from './inactivations-report.component';

describe('FsnChangesComponent', () => {
  let component: InactivationsReportComponent;
  let fixture: ComponentFixture<InactivationsReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InactivationsReportComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InactivationsReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
