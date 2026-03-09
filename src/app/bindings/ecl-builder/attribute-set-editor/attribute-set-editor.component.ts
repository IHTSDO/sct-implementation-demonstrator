import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EclBuilderService } from '../ecl-builder.service';
import { EclAttribute, EclExpressionConstraint, EclSubAttributeSet } from '../ecl-builder.models';

@Component({
  selector: 'app-attribute-set-editor',
  templateUrl: './attribute-set-editor.component.html',
  styleUrls: ['./attribute-set-editor.component.css'],
  standalone: false
})
export class AttributeSetEditorComponent {
  @Input({ required: true }) model!: EclExpressionConstraint;
  @Input() readonly = false;
  @Output() changed = new EventEmitter<void>();

  constructor(private eclBuilderService: EclBuilderService) {}

  get attributes(): EclSubAttributeSet[] {
    const eclAttributeSet = this.model.eclRefinement?.subRefinement?.eclAttributeSet;
    if (!eclAttributeSet) {
      return [];
    }

    return [
      eclAttributeSet.subAttributeSet,
      ...(eclAttributeSet.conjunctionAttributeSet ?? [])
    ];
  }

  addAttribute(): void {
    const eclAttributeSet = this.model.eclRefinement?.subRefinement?.eclAttributeSet;
    if (!eclAttributeSet) {
      return;
    }

    if (!eclAttributeSet.conjunctionAttributeSet) {
      eclAttributeSet.conjunctionAttributeSet = [];
    }

    eclAttributeSet.conjunctionAttributeSet.push({
      uiId: Math.random().toString(36).slice(2, 10),
      attribute: this.eclBuilderService.createEmptyAttribute()
    });
    this.changed.emit();
  }

  removeAttribute(index: number): void {
    const eclAttributeSet = this.model.eclRefinement?.subRefinement?.eclAttributeSet;
    if (!eclAttributeSet) {
      return;
    }

    if (index === 0) {
      const conjunctions = eclAttributeSet.conjunctionAttributeSet ?? [];
      if (conjunctions.length > 0) {
        eclAttributeSet.subAttributeSet = conjunctions.shift() as EclSubAttributeSet;
        eclAttributeSet.conjunctionAttributeSet = conjunctions;
      } else {
        delete this.model.eclRefinement;
        this.model.operator = this.model.subexpressionConstraint?.operator ?? 'descendantorselfof';
        this.model.conceptId = this.model.subexpressionConstraint?.conceptId ?? '';
        this.model.wildcard = this.model.conceptId === '*';
        delete this.model.subexpressionConstraint;
      }
    } else {
      eclAttributeSet.conjunctionAttributeSet?.splice(index - 1, 1);
    }

    this.changed.emit();
  }

  trackAttribute(_: number, item: EclSubAttributeSet): string {
    return item.uiId ?? item.attribute.uiId ?? `${_}`;
  }
}
