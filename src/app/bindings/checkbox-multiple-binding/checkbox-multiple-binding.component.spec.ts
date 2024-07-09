import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckBoxMultipleBindingComponent } from './checkbox-multiple-binding.component';

describe('CheckBoxBindingComponent', () => {
  let component: CheckBoxMultipleBindingComponent;
  let fixture: ComponentFixture<CheckBoxMultipleBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CheckBoxMultipleBindingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CheckBoxMultipleBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
