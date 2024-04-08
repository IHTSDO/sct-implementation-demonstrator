import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityQuestionComponent } from './maturity-question.component';

describe('MaturityQuestionComponent', () => {
  let component: MaturityQuestionComponent;
  let fixture: ComponentFixture<MaturityQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaturityQuestionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityQuestionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
