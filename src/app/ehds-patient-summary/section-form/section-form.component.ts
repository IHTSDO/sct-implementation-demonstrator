import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EpsFieldMeta, EpsSectionMeta } from '../spec/eps-sections.model';
import { EpsEntry } from '../eps-fhir.service';

/**
 * Generic, metadata-driven form for one EPS section. It builds its controls from
 * the section's field metadata (produced by the spec generator + curated config)
 * and renders each field by control type — SNOMED autocomplete, dropdown, date or
 * free text. On "Add" it emits a captured EpsEntry.
 */
@Component({
  selector: 'app-eps-section-form',
  templateUrl: './section-form.component.html',
  styleUrls: ['./section-form.component.css'],
  standalone: false,
})
export class SectionFormComponent {
  @Input() set section(value: EpsSectionMeta) {
    this._section = value;
    this.buildForm();
  }
  get section(): EpsSectionMeta {
    return this._section;
  }
  private _section!: EpsSectionMeta;

  @Output() entryAdded = new EventEmitter<EpsEntry>();

  form!: FormGroup;
  /** Coded values captured from SNOMED autocompletes, keyed by field key. */
  private codedValues: Record<string, any> = {};

  constructor(private fb: FormBuilder) {}

  private buildForm(): void {
    this.codedValues = {};
    const controls: Record<string, any> = {};
    for (const f of this._section.fields) {
      const validators = f.min >= 1 ? [Validators.required] : [];
      controls[f.key] = ['', validators];
    }
    this.form = this.fb.group(controls);
  }

  onSnomedSelected(field: EpsFieldMeta, concept: any): void {
    if (concept && concept.code) {
      this.codedValues[field.key] = {
        code: concept.code,
        system: field.system || 'http://snomed.info/sct',
        display: concept.display,
      };
    } else {
      delete this.codedValues[field.key];
    }
  }

  private optionFor(field: EpsFieldMeta, code: string): any {
    const opt = (field.options || []).find((o) => o.code === code);
    return opt ? { code: opt.code, system: opt.system, display: opt.display } : undefined;
  }

  /** True when all required SNOMED fields have a coded value selected. */
  private missingRequiredCode(): boolean {
    return this._section.fields.some(
      (f) => f.control === 'snomed' && f.min >= 1 && !this.codedValues[f.key]
    );
  }

  get canAdd(): boolean {
    return this.form.valid && !this.missingRequiredCode();
  }

  add(): void {
    if (!this.canAdd) {
      this.form.markAllAsTouched();
      return;
    }
    const values: Record<string, any> = {};
    for (const f of this._section.fields) {
      switch (f.control) {
        case 'snomed':
          if (this.codedValues[f.key]) values[f.key] = this.codedValues[f.key];
          break;
        case 'dropdown': {
          const code = this.form.get(f.key)?.value;
          const opt = code ? this.optionFor(f, code) : undefined;
          if (opt) values[f.key] = opt;
          break;
        }
        case 'date': {
          const d = this.form.get(f.key)?.value;
          if (d) values[f.key] = d instanceof Date ? d.toISOString().slice(0, 10) : d;
          break;
        }
        default: {
          const v = this.form.get(f.key)?.value;
          if (v) values[f.key] = v;
        }
      }
    }
    this.entryAdded.emit({ id: this.uuid(), values });
    this.reset();
  }

  reset(): void {
    this.codedValues = {};
    this.form.reset();
  }

  private uuid(): string {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const val = c === 'x' ? r : (r & 0x3) | 0x8;
      return val.toString(16);
    });
  }
}
