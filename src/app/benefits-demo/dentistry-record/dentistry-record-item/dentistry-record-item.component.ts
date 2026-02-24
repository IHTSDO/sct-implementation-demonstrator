import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { DentalFindingListItem } from '../models/dental-finding-list-item.model';

@Component({
  selector: 'app-dentistry-record-item',
  templateUrl: './dentistry-record-item.component.html',
  styleUrls: ['./dentistry-record-item.component.css'],
  standalone: false
})
export class DentistryRecordItemComponent {
  @Input() item!: DentalFindingListItem;
  @Input() interactive = false;
  @Input() showDelete = false;

  @Output() focus = new EventEmitter<DentalFindingListItem>();
  @Output() toggleStatus = new EventEmitter<DentalFindingListItem>();
  @Output() delete = new EventEmitter<DentalFindingListItem>();
  @Output() copyPostcoordinated = new EventEmitter<DentalFindingListItem>();

  contextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;

  constructor(private hostRef: ElementRef<HTMLElement>) {}

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

  onContextMenu(event: MouseEvent): void {
    if (!this.item) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.contextMenuVisible = true;
  }

  onCopyPostcoordinated(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuVisible = false;
    if (!this.item) {
      return;
    }
    this.copyPostcoordinated.emit(this.item);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.contextMenuVisible) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostRef.nativeElement.contains(target)) {
      return;
    }
    this.contextMenuVisible = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.contextMenuVisible = false;
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
