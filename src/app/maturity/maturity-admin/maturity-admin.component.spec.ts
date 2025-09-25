import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityAdminComponent } from './maturity-admin.component';

describe('MaturityAdminComponent', () => {
  let component: MaturityAdminComponent;
  let fixture: ComponentFixture<MaturityAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MaturityAdminComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
