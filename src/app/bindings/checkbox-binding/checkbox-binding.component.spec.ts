import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckBoxBindingComponent } from './checkbox-binding.component';

describe('CheckBoxBindingComponent', () => {
  let component: CheckBoxBindingComponent;
  let fixture: ComponentFixture<CheckBoxBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CheckBoxBindingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CheckBoxBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
