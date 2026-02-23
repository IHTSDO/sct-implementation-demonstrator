import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DentalFindingListItem } from '../models/dental-finding-list-item.model';

@Component({
  selector: 'app-dentistry-finding-item',
  templateUrl: './dentistry-finding-item.component.html',
  styleUrls: ['./dentistry-finding-item.component.css'],
  standalone: false
})
export class DentistryFindingItemComponent {
  @Input() item!: DentalFindingListItem;
  @Input() interactive = false;
  @Input() showDelete = false;

  @Output() focus = new EventEmitter<DentalFindingListItem>();
  @Output() toggleStatus = new EventEmitter<DentalFindingListItem>();
  @Output() delete = new EventEmitter<DentalFindingListItem>();

  onCardClick(): void {
    if (!this.interactive || !this.item) {
      return;
    }
    this.focus.emit(this.item);
  }

  onToggleStatus(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.item) {
      return;
    }
    this.toggleStatus.emit(this.item);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.item) {
      return;
    }
    this.delete.emit(this.item);
  }

  getStatusToggleTooltip(): string {
    if (!this.item) {
      return '';
    }
    if (this.item.entryType === 'procedure') {
      return this.item.isResolved ? 'Set as Planned' : 'Set as Completed';
    }
    return this.item.isResolved ? 'Set as active' : 'Set as resolved';
  }

  isProcedureCompleted(): boolean {
    return this.item?.entryType === 'procedure' && this.item?.isResolved;
  }

  isProcedurePlanned(): boolean {
    return this.item?.entryType === 'procedure' && !this.item?.isResolved;
  }
}
