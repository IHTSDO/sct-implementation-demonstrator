import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatFormFieldAppearance } from '@angular/material/form-field';

@Component({
  selector: 'app-concept-picker',
  templateUrl: './concept-picker.component.html',
  styleUrls: ['./concept-picker.component.css'],
  standalone: false
})
export class ConceptPickerComponent {
  @Input() label = '';
  @Input() note = '';
  @Input() ecl = '*';
  @Input() conceptId = '';
  @Input() readonly = false;
  @Input() appearance: MatFormFieldAppearance = 'fill';
  @Input() compact = false;
  @Input() allowWildcard = false;

  @Output() conceptIdChange = new EventEmitter<string>();

  binding = {
    title: '',
    note: '',
    ecl: '*'
  };
  selectedTerm: { code?: string; display?: string } | string = '';

  ngOnChanges(): void {
    this.binding = {
      title: this.label,
      note: this.note,
      ecl: this.ecl || '*'
    };
    this.selectedTerm = this.toSelectedTerm(this.conceptId);
  }

  onSelectionChange(selection: { code?: string; display?: string } | string): void {
    if (typeof selection === 'string') {
      if (this.allowWildcard && selection.trim() === '*') {
        this.conceptIdChange.emit('*');
      } else {
        this.conceptIdChange.emit('');
      }
      return;
    }

    if (!selection?.code) {
      this.conceptIdChange.emit('');
      return;
    }

    if (this.allowWildcard && selection.code === '*') {
      this.conceptIdChange.emit('*');
      return;
    }

    const display = selection.display?.trim() ?? '';
    this.conceptIdChange.emit(display ? `${selection.code} |${display}|` : selection.code);
  }

  onCleared(): void {
    this.conceptIdChange.emit('');
  }

  private extractCode(value: string): string {
    if (value.includes('|')) {
      return value.substring(0, value.indexOf('|')).trim();
    }

    return value.trim();
  }

  private extractDisplay(value: string): string {
    if (!value.includes('|')) {
      return '';
    }

    return value.substring(value.indexOf('|') + 1).replace(/\|/g, '').trim();
  }

  private toSelectedTerm(value: string): { code?: string; display?: string } | string {
    if (!value) {
      return '';
    }

    if (value === '*') {
      return value;
    }

    const code = this.extractCode(value);
    const display = this.extractDisplay(value);

    if (code && display) {
      return { code, display };
    }

    return value;
  }
}
