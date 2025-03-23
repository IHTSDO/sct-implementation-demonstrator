import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityDashboardComponent } from './maturity-dashboard.component';

describe('MaturityDashboardComponent', () => {
  let component: MaturityDashboardComponent;
  let fixture: ComponentFixture<MaturityDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaturityDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaturityDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
