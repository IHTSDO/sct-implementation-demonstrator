import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefsetViewerComponent } from './refset-viewer.component';

describe('RefsetViewerComponent', () => {
  let component: RefsetViewerComponent;
  let fixture: ComponentFixture<RefsetViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefsetViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefsetViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
