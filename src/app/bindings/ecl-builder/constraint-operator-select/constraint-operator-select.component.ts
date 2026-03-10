import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EclOperator } from '../ecl-builder.models';

@Component({
  selector: 'app-constraint-operator-select',
  templateUrl: './constraint-operator-select.component.html',
  styleUrls: ['./constraint-operator-select.component.css'],
  standalone: false
})
export class ConstraintOperatorSelectComponent {
  @Input() label = 'Operator';
  @Input() value: EclOperator = '';
  @Input() readonly = false;
  @Input() compact = false;
  @Output() valueChange = new EventEmitter<EclOperator>();

  readonly options: Array<{ value: EclOperator; label: string }> = [
    { value: '', label: 'Self' },
    { value: 'descendantof', label: '< Descendant of' },
    { value: 'descendantorselfof', label: '<< Descendants or Self of' },
    { value: 'childof', label: '<! Child of' },
    { value: 'ancestorof', label: '> Ancestor of' },
    { value: 'ancestororselfof', label: '>> Ancestor or Self of' },
    { value: 'parentof', label: '>! Parent of' },
    { value: 'memberOf', label: '^ Member of' }
  ];
}
