import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubsetValidatorComponent } from './subset-validator.component';

describe('SubsetValidatorComponent', () => {
  let component: SubsetValidatorComponent;
  let fixture: ComponentFixture<SubsetValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SubsetValidatorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubsetValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
