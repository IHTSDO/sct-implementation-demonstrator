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
  @Output() resolveFinding = new EventEmitter<DentalFindingListItem>();
  @Output() deleteFinding = new EventEmitter<DentalFindingListItem>();
  @Output() copyPostcoordinated = new EventEmitter<DentalFindingListItem>();

  onFocus(item: DentalFindingListItem): void {
    this.focusFinding.emit(item);
  }

  onResolve(item: DentalFindingListItem): void {
    this.resolveFinding.emit(item);
  }

  onDelete(item: DentalFindingListItem): void {
    this.deleteFinding.emit(item);
  }

  onCopyPostcoordinated(item: DentalFindingListItem): void {
    this.copyPostcoordinated.emit(item);
  }
}
