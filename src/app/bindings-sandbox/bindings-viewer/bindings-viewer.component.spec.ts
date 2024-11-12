import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BindingsViewerComponent } from './bindings-viewer.component';

describe('BindingsViewerComponent', () => {
  let component: BindingsViewerComponent;
  let fixture: ComponentFixture<BindingsViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BindingsViewerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BindingsViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
