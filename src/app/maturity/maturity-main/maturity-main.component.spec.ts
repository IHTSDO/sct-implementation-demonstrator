import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityMainComponent } from './maturity-main.component';

describe('MaturityMainComponent', () => {
  let component: MaturityMainComponent;
  let fixture: ComponentFixture<MaturityMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaturityMainComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
