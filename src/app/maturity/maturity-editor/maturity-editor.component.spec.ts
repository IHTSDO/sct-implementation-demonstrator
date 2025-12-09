import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityEditorComponent } from './maturity-editor.component';

describe('MaturityEditorComponent', () => {
  let component: MaturityEditorComponent;
  let fixture: ComponentFixture<MaturityEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MaturityEditorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MaturityEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
