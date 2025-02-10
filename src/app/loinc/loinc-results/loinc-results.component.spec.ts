import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoincResultsComponent } from './loinc-results.component';

describe('LoincResultsComponent', () => {
  let component: LoincResultsComponent;
  let fixture: ComponentFixture<LoincResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoincResultsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoincResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
