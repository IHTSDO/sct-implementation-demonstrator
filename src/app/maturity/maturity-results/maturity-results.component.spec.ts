import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityResultsComponent } from './maturity-results.component';

describe('MaturityResultsComponent', () => {
  let component: MaturityResultsComponent;
  let fixture: ComponentFixture<MaturityResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaturityResultsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
