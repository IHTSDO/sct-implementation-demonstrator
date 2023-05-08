import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllergiesAllergyListReactionComponent } from './allergies-allergy-list-reaction.component';

describe('AllergiesAllergyListReactionComponent', () => {
  let component: AllergiesAllergyListReactionComponent;
  let fixture: ComponentFixture<AllergiesAllergyListReactionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AllergiesAllergyListReactionComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllergiesAllergyListReactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
