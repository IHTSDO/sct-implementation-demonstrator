import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRootModuleComponent } from './create-root-module.component';

describe('CreateRootModuleComponent', () => {
  let component: CreateRootModuleComponent;
  let fixture: ComponentFixture<CreateRootModuleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateRootModuleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateRootModuleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
