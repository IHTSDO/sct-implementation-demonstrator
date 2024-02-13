import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SituationMapComponent } from './situation-map.component';

describe('SituationMapComponent', () => {
  let component: SituationMapComponent;
  let fixture: ComponentFixture<SituationMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SituationMapComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SituationMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
