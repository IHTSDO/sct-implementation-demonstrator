import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BindingsSandboxComponent } from './bindings-sandbox.component';

describe('BindingsSandboxComponent', () => {
  let component: BindingsSandboxComponent;
  let fixture: ComponentFixture<BindingsSandboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BindingsSandboxComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BindingsSandboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
