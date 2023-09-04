import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionMainComponent } from './prescription-main.component';

describe('PrescriptionMainComponent', () => {
  let component: PrescriptionMainComponent;
  let fixture: ComponentFixture<PrescriptionMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PrescriptionMainComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
