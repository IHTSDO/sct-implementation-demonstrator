import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-concept-set-lookup-panel',
  templateUrl: './concept-set-lookup-panel.component.html',
  styleUrls: ['./concept-set-lookup-panel.component.css'],
  standalone: false
})
export class ConceptSetLookupPanelComponent {
  @Output() conceptSelected = new EventEmitter<{ conceptId: string; display: string }>();

  readonly binding = {
    title: 'Search SNOMED CT Concept',
    note: 'Type at least 3 characters to search terminology.',
    ecl: '<< 138875005'
  };

  onSelectionChange(concept: any): void {
    if (concept?.code) {
      this.conceptSelected.emit({
        conceptId: concept.code,
        display: concept.display || concept.code
      });
    }
  }
}
