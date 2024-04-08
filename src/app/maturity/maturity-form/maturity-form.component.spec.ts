import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityFormComponent } from './maturity-form.component';

describe('MaturityFormComponent', () => {
  let component: MaturityFormComponent;
  let fixture: ComponentFixture<MaturityFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaturityFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
