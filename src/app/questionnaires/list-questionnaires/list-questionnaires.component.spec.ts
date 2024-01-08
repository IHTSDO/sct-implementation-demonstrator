import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListQuestionnairesComponent } from './list-questionnaires.component';

describe('ListQuestionnairesComponent', () => {
  let component: ListQuestionnairesComponent;
  let fixture: ComponentFixture<ListQuestionnairesComponent>;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ListQuestionnairesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListQuestionnairesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
