import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FsnChangesComponent } from './fsn-changes.component';

describe('FsnChangesComponent', () => {
  let component: FsnChangesComponent;
  let fixture: ComponentFixture<FsnChangesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FsnChangesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FsnChangesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
