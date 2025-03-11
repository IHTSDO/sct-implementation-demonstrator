import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlipCardComponent } from './flip-card.component';

describe('FlipCardComponent', () => {
  let component: FlipCardComponent;
  let fixture: ComponentFixture<FlipCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlipCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlipCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
