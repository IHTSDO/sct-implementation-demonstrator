import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionnairesMainComponent } from './questionnaires-main.component';

describe('QuestionnairesMainComponent', () => {
  let component: QuestionnairesMainComponent;
  let fixture: ComponentFixture<QuestionnairesMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionnairesMainComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionnairesMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
