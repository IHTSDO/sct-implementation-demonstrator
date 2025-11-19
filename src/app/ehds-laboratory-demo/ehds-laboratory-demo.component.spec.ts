import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EhdsLaboratoryDemoComponent } from './ehds-laboratory-demo.component';

describe('EhdsLaboratoryDemoComponent', () => {
  let component: EhdsLaboratoryDemoComponent;
  let fixture: ComponentFixture<EhdsLaboratoryDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EhdsLaboratoryDemoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EhdsLaboratoryDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

