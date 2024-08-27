import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcdSearchComponent } from './icd-search.component';

describe('IcdSearchComponent', () => {
  let component: IcdSearchComponent;
  let fixture: ComponentFixture<IcdSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcdSearchComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(IcdSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
