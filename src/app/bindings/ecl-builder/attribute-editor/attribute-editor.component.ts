import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { EclBuilderService } from '../ecl-builder.service';
import { EclAttribute, EclComparisonOperator, EclDomainAttribute, EclOperator } from '../ecl-builder.models';

@Component({
  selector: 'app-attribute-editor',
  templateUrl: './attribute-editor.component.html',
  styleUrls: ['./attribute-editor.component.css'],
  standalone: false
})
export class AttributeEditorComponent implements OnChanges {
  @Input({ required: true }) attribute!: EclAttribute;
  @Input() focusConceptId = '';
  @Input() focusConceptOperator = '';
  @Input() readonly = false;
  @Output() changed = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();

  domainAttributes: EclDomainAttribute[] = [];
  domainAttributesEcl = '';
  loadingDomainAttributes = false;
  attributeNameSelection: { code: string; display: string } | null = null;

  readonly comparisonOperators: EclComparisonOperator[] = ['=', '!='];

  constructor(private eclBuilderService: EclBuilderService) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.attributeNameSelection = this.toAttributeNameSelection();

    if (changes['focusConceptId'] || changes['focusConceptOperator']) {
      this.loadDomainAttributes();
    }
  }

  updateAttributeName(conceptId: string): void {
    this.attribute.attributeName.conceptId = conceptId;
    this.attribute.attributeName.wildcard = conceptId === '*';
    this.attribute.attributeName.operator = conceptId === '*' ? undefined : (this.attribute.attributeName.operator ?? 'descendantorselfof');
    this.changed.emit();
  }

  updateAttributeNameSelection(selection: { code?: string; display?: string } | { code?: string; display?: string }[] | null): void {
    if (Array.isArray(selection) || !selection?.code) {
      this.attribute.attributeName.conceptId = '';
      this.attribute.attributeName.term = '';
      this.changed.emit();
      return;
    }

    this.attribute.attributeName.conceptId = `${selection.code} |${selection.display || ''}|`;
    this.attribute.attributeName.term = selection.display || '';
    this.attribute.attributeName.wildcard = false;
    this.attribute.attributeName.operator = this.attribute.attributeName.operator ?? 'descendantorselfof';
    this.attributeNameSelection = this.toAttributeNameSelection();
    this.changed.emit();
  }

  updateValue(conceptId: string): void {
    const valueExpression = this.getValueExpression();
    valueExpression.conceptId = conceptId;
    valueExpression.wildcard = conceptId === '*';
    valueExpression.operator = conceptId === '*' ? undefined : (valueExpression.operator ?? 'descendantorselfof');
    this.changed.emit();
  }

  updateAttributeOperator(operator: string): void {
    this.attribute.attributeName.operator = operator as any;
    this.changed.emit();
  }

  updateValueOperator(operator: string): void {
    const valueExpression = this.getValueExpression();
    valueExpression.operator = operator as any;
    this.changed.emit();
  }

  get valueOperatorSelection(): EclOperator {
    return (this.getValueExpression().operator ?? '') as EclOperator;
  }

  get valueConceptId(): string {
    return this.getValueExpression().conceptId ?? '';
  }

  private toAttributeNameSelection(): { code: string; display: string } | null {
    const conceptId = this.extractConceptId(this.attribute.attributeName.conceptId);
    if (!conceptId) {
      return null;
    }

    return {
      code: conceptId,
      display: this.attribute.attributeName.term || this.extractTerm(this.attribute.attributeName.conceptId)
    };
  }

  getAttributeRangeEcl(): string {
    const conceptId = this.extractConceptId(this.attribute.attributeName.conceptId);
    const matching = this.domainAttributes.find((item) => item.conceptId === conceptId);
    return matching?.attributeRange?.[0]?.rangeConstraint || '';
  }

  private loadDomainAttributes(): void {
    const conceptId = this.extractConceptId(this.focusConceptId);
    if (!conceptId || conceptId === '*' || this.focusConceptOperator === 'memberOf') {
      this.domainAttributes = [];
      this.domainAttributesEcl = '';
      return;
    }

    this.loadingDomainAttributes = true;
    this.eclBuilderService.getDomainAttributes(conceptId).subscribe({
      next: (attributes) => {
        this.domainAttributes = attributes;
        this.domainAttributesEcl = attributes.length
          ? attributes.map((item) => item.conceptId).join(' OR ')
          : '';
        this.loadingDomainAttributes = false;
      },
      error: () => {
        this.domainAttributes = [];
        this.domainAttributesEcl = '';
        this.loadingDomainAttributes = false;
      }
    });
  }

  private extractConceptId(conceptIdAndTerm?: string): string {
    if (!conceptIdAndTerm) {
      return '';
    }

    if (conceptIdAndTerm.includes('|')) {
      return conceptIdAndTerm.substring(0, conceptIdAndTerm.indexOf('|')).trim();
    }

    return conceptIdAndTerm.trim();
  }

  private extractTerm(conceptIdAndTerm?: string): string {
    if (!conceptIdAndTerm || !conceptIdAndTerm.includes('|')) {
      return '';
    }

    return conceptIdAndTerm.substring(conceptIdAndTerm.indexOf('|') + 1).replace(/\|/g, '').trim();
  }

  private getValueExpression(): any {
    return this.attribute.value?.nestedExpressionConstraint ?? this.attribute.value;
  }
}
