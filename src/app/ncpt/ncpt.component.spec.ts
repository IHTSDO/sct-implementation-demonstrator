import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NcptComponent } from './ncpt.component';

describe('NcptComponent', () => {
  let component: NcptComponent;
  let fixture: ComponentFixture<NcptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NcptComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NcptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
