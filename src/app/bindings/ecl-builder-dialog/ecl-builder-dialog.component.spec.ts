import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EclBuilderDialogComponent } from './ecl-builder-dialog.component';

describe('EclBuilderDialogComponent', () => {
  let component: EclBuilderDialogComponent;
  let fixture: ComponentFixture<EclBuilderDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EclBuilderDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EclBuilderDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
