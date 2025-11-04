import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { CookieConsentComponent } from './cookie-consent.component';

describe('CookieConsentComponent', () => {
  let component: CookieConsentComponent;
  let fixture: ComponentFixture<CookieConsentComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<CookieConsentComponent>>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      declarations: [ CookieConsentComponent ],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CookieConsentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close dialog with true when accept is called', () => {
    component.accept();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close dialog with false when decline is called', () => {
    component.decline();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});

