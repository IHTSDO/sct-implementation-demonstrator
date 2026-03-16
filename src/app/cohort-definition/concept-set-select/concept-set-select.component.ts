import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ConceptSet } from '../cohort-definition.model';

@Component({
  selector: 'app-concept-set-select',
  templateUrl: './concept-set-select.component.html',
  styleUrls: ['./concept-set-select.component.css'],
  standalone: false
})
export class ConceptSetSelectComponent {
  @Input() label = 'Concept Set';
  @Input() conceptSets: ConceptSet[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
}
