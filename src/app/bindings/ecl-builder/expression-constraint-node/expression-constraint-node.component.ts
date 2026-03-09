import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EclBuilderService } from '../ecl-builder.service';
import { EclExpressionConstraint, EclOperator } from '../ecl-builder.models';

@Component({
  selector: 'app-expression-constraint-node',
  templateUrl: './expression-constraint-node.component.html',
  styleUrls: ['./expression-constraint-node.component.css'],
  standalone: false
})
export class ExpressionConstraintNodeComponent {
  @Input({ required: true }) model!: EclExpressionConstraint;
  @Input() label = 'Focus concept';
  @Input() note = '';
  @Input() conceptEcl = '*';
  @Input() allowWildcard = false;
  @Input() readonly = false;

  @Output() changed = new EventEmitter<void>();
 
  constructor(private eclBuilderService: EclBuilderService) {}

  get currentConceptId(): string {
    if (this.model.wildcard) {
      return '*';
    }

    return this.model.conceptId ?? '';
  }

  updateOperator(operator: EclOperator): void {
    this.model.operator = operator;
    this.changed.emit();
  }

  updateConceptId(conceptId: string): void {
    if (conceptId === '*') {
      this.model.wildcard = true;
      this.model.conceptId = '*';
      this.model.operator = this.model.operator ?? '';
    } else {
      this.model.wildcard = false;
      this.model.conceptId = conceptId;
      this.model.operator = this.model.operator ?? 'descendantorselfof';
    }
    this.changed.emit();
  }
}
