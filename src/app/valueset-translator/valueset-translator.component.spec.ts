import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ValuesetTranslatorComponent } from './valueset-translator.component';

describe('ValuesetTranslatorComponent', () => {
  let component: ValuesetTranslatorComponent;
  let fixture: ComponentFixture<ValuesetTranslatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValuesetTranslatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ValuesetTranslatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
