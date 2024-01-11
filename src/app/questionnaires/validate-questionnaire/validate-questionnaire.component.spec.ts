import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ValidateQuestionnaireComponent } from './validate-questionnaire.component';

describe('ValidateQuestionnaireComponent', () => {
  let component: ValidateQuestionnaireComponent;
  let fixture: ComponentFixture<ValidateQuestionnaireComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ValidateQuestionnaireComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ValidateQuestionnaireComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
