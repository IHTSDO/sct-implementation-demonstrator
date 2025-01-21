import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewConceptsReportComponent } from './new-concepts-report.component';


describe('FsnChangesComponent', () => {
  let component: NewConceptsReportComponent;
  let fixture: ComponentFixture<NewConceptsReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewConceptsReportComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NewConceptsReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
