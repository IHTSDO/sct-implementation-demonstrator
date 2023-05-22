import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RadiosBindingComponent } from './radios-binding.component';

describe('DropdownBindingComponent', () => {
  let component: RadiosBindingComponent;
  let fixture: ComponentFixture<RadiosBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RadiosBindingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RadiosBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
