import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadQuestionnaireModalComponent } from './load-questionnaire-modal.component';

describe('LoadQuestionnaireModalComponent', () => {
  let component: LoadQuestionnaireModalComponent;
  let fixture: ComponentFixture<LoadQuestionnaireModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoadQuestionnaireModalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadQuestionnaireModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
