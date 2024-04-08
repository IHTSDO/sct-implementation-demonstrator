import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityGraphComponent } from './maturity-graph.component';

describe('MaturityGraphComponent', () => {
  let component: MaturityGraphComponent;
  let fixture: ComponentFixture<MaturityGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaturityGraphComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
