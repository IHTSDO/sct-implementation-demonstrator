import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ConceptSetItem } from '../cohort-definition.model';

@Component({
  selector: 'app-concept-set-item-table',
  templateUrl: './concept-set-item-table.component.html',
  styleUrls: ['./concept-set-item-table.component.css'],
  standalone: false
})
export class ConceptSetItemTableComponent {
  @Input() items: ConceptSetItem[] = [];
  @Output() itemsChange = new EventEmitter<ConceptSetItem[]>();

  addRow(): void {
    this.itemsChange.emit([
      ...this.items,
      {
        conceptId: '',
        includeDescendants: true,
        includeMapped: false,
        exclude: false
      }
    ]);
  }

  removeRow(index: number): void {
    this.itemsChange.emit(this.items.filter((_, itemIndex) => itemIndex !== index));
  }

  updateRow(index: number, patch: Partial<ConceptSetItem>): void {
    this.itemsChange.emit(
      this.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  addConceptFromLookup(concept: { conceptId: string }): void {
    this.itemsChange.emit([
      ...this.items,
      {
        conceptId: concept.conceptId,
        includeDescendants: true,
        includeMapped: false,
        exclude: false
      }
    ]);
  }
}
