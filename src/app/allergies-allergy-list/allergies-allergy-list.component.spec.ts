import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllergiesAllergyListComponent } from './allergies-allergy-list.component';

describe('AllergiesAllergyListComponent', () => {
  let component: AllergiesAllergyListComponent;
  let fixture: ComponentFixture<AllergiesAllergyListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AllergiesAllergyListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllergiesAllergyListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
