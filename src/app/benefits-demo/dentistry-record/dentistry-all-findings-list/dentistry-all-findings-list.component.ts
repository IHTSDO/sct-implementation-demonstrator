import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DentalFindingListItem } from '../models/dental-finding-list-item.model';

@Component({
  selector: 'app-dentistry-all-findings-list',
  templateUrl: './dentistry-all-findings-list.component.html',
  styleUrls: ['./dentistry-all-findings-list.component.css'],
  standalone: false
})
export class DentistryAllFindingsListComponent {
  @Input() items: DentalFindingListItem[] = [];
  @Output() focusFinding = new EventEmitter<DentalFindingListItem>();

  onFocus(item: DentalFindingListItem): void {
    this.focusFinding.emit(item);
  }
}
