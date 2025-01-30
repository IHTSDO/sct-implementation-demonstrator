import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TriageGameComponent } from './triage-game.component';

describe('TriageGameComponent', () => {
  let component: TriageGameComponent;
  let fixture: ComponentFixture<TriageGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TriageGameComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TriageGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
