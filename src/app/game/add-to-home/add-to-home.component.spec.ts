import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddToHomeComponent } from './add-to-home.component';

describe('AddToHomeComponent', () => {
  let component: AddToHomeComponent;
  let fixture: ComponentFixture<AddToHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddToHomeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddToHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
