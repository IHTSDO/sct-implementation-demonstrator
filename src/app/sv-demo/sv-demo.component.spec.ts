import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvDemoComponent } from './sv-demo.component';

describe('NcptComponent', () => {
  let component: SvDemoComponent;
  let fixture: ComponentFixture<SvDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SvDemoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SvDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
