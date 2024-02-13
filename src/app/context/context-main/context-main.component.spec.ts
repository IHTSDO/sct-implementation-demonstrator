import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContextMainComponent } from './context-main.component';

describe('ContextMainComponent', () => {
  let component: ContextMainComponent;
  let fixture: ComponentFixture<ContextMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ContextMainComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContextMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
