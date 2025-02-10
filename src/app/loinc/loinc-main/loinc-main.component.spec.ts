import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoincMainComponent } from './loinc-main.component';

describe('LoincMainComponent', () => {
  let component: LoincMainComponent;
  let fixture: ComponentFixture<LoincMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoincMainComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoincMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
