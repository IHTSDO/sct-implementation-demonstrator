import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CountConstraint } from '../cohort-definition.model';

@Component({
  selector: 'app-count-constraint-editor',
  templateUrl: './count-constraint-editor.component.html',
  styleUrls: ['./count-constraint-editor.component.css'],
  standalone: false
})
export class CountConstraintEditorComponent {
  @Input() model!: CountConstraint;
  @Output() modelChange = new EventEmitter<CountConstraint>();

  update<K extends keyof CountConstraint>(key: K, value: CountConstraint[K]): void {
    this.modelChange.emit({
      ...this.model,
      [key]: value
    });
  }
}
