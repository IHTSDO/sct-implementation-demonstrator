import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';

export interface ClinicColor {
  id: string;
  /** Accent used for text, icons and borders; readable on white */
  accent: string;
  /** Light tint used for selected backgrounds */
  soft: string;
}

export interface ClinicBranding {
  name: string;
  colorId: string;
}

/**
 * Fixed palette so any choice keeps enough contrast on light surfaces.
 * The first entry matches the EHR Lab default accent.
 */
export const CLINIC_COLORS: ClinicColor[] = [
  { id: 'blue', accent: '#0d6efd', soft: '#e9f2ff' },
  { id: 'indigo', accent: '#4338ca', soft: '#eeedfb' },
  { id: 'purple', accent: '#7e22ce', soft: '#f5ecfc' },
  { id: 'rose', accent: '#be123c', soft: '#fdecef' },
  { id: 'orange', accent: '#c2410c', soft: '#fdf0e8' },
  { id: 'green', accent: '#15803d', soft: '#e9f6ee' },
  { id: 'teal', accent: '#0f766e', soft: '#e6f4f2' },
  { id: 'slate', accent: '#334155', soft: '#eef1f5' }
];

const DEFAULT_BRANDING: ClinicBranding = { name: '', colorId: CLINIC_COLORS[0].id };

/**
 * Light "branding" for EHR Lab demos: a clinic name and an accent color,
 * kept per browser so two presenters can run the same instance and still
 * look like different clinics.
 */
@Injectable({
  providedIn: 'root'
})
export class ClinicBrandingService {
  private static readonly STORAGE_KEY = 'ehr-lab-branding';

  private readonly brandingSubject: BehaviorSubject<ClinicBranding>;
  readonly branding$: Observable<ClinicBranding>;

  constructor(private storageService: StorageService) {
    this.brandingSubject = new BehaviorSubject<ClinicBranding>(this.load());
    this.branding$ = this.brandingSubject.asObservable();
  }

  get branding(): ClinicBranding {
    return this.brandingSubject.value;
  }

  /** Trimmed clinic name, or '' when none is configured. */
  get clinicName(): string {
    return this.branding.name.trim();
  }

  getColor(colorId: string = this.branding.colorId): ClinicColor {
    return CLINIC_COLORS.find(color => color.id === colorId) ?? CLINIC_COLORS[0];
  }

  /** CSS custom properties for a host element, consumed with the default accent as fallback. */
  getCssVariables(colorId: string = this.branding.colorId): Record<string, string> {
    const color = this.getColor(colorId);
    return {
      '--clinic-accent': color.accent,
      '--clinic-accent-soft': color.soft
    };
  }

  save(branding: ClinicBranding): void {
    const next: ClinicBranding = {
      name: branding.name.trim().slice(0, 60),
      colorId: this.getColor(branding.colorId).id
    };
    this.write(next);
    this.brandingSubject.next(next);
  }

  reset(): void {
    try {
      this.storageService.removeItem(ClinicBrandingService.STORAGE_KEY);
    } catch {
      // Storage unavailable; the in-memory reset still applies
    }
    this.brandingSubject.next({ ...DEFAULT_BRANDING });
  }

  private load(): ClinicBranding {
    try {
      const raw = this.storageService.getItem(ClinicBrandingService.STORAGE_KEY);
      if (!raw) return { ...DEFAULT_BRANDING };
      const parsed = JSON.parse(raw);
      return {
        name: typeof parsed?.name === 'string' ? parsed.name : '',
        colorId: typeof parsed?.colorId === 'string' ? parsed.colorId : DEFAULT_BRANDING.colorId
      };
    } catch {
      return { ...DEFAULT_BRANDING };
    }
  }

  private write(branding: ClinicBranding): void {
    try {
      this.storageService.saveItem(ClinicBrandingService.STORAGE_KEY, JSON.stringify(branding));
    } catch {
      // Storage unavailable (private mode); keep the in-memory value
    }
  }
}
