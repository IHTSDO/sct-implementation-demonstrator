import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoincOrderComponent } from './loinc-order.component';

describe('LoincOrderComponent', () => {
  let component: LoincOrderComponent;
  let fixture: ComponentFixture<LoincOrderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoincOrderComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoincOrderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
