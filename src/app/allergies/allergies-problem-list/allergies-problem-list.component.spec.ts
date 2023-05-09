import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllergiesProblemListComponent } from './allergies-problem-list.component';

describe('AllergiesProblemListComponent', () => {
  let component: AllergiesProblemListComponent;
  let fixture: ComponentFixture<AllergiesProblemListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AllergiesProblemListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllergiesProblemListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
