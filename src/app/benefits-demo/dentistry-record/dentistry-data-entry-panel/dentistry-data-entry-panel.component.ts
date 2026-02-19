import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OdontogramTooth, SnomedConceptOption } from '../models/tooth.model';
import { DentalFindingListItem } from '../models/dental-finding-list-item.model';

@Component({
  selector: 'app-dentistry-data-entry-panel',
  templateUrl: './dentistry-data-entry-panel.component.html',
  styleUrls: ['./dentistry-data-entry-panel.component.css'],
  standalone: false
})
export class DentistryDataEntryPanelComponent {
  @Input() pinnedTooth: OdontogramTooth | null = null;
  @Input() surfaceOnlyOptions: SnomedConceptOption[] = [];
  @Input() selectedSiteCodes: string[] = [];
  @Input() completeSiteCode = '302214001';
  @Input() periodontalSiteCode = '8711009';
  @Input() findingQuery = '';
  @Input() filteredFindingOptions: SnomedConceptOption[] = [];
  @Input() canSave = false;
  @Input() isSaved = false;
  @Input() pinnedToothSavedFindings: DentalFindingListItem[] = [];

  @Output() exclusiveSiteToggle = new EventEmitter<{ siteCode: string; checked: boolean }>();
  @Output() surfaceSiteToggle = new EventEmitter<{ siteCode: string; checked: boolean }>();
  @Output() findingInputChange = new EventEmitter<string>();
  @Output() findingSelected = new EventEmitter<string>();
  @Output() save = new EventEmitter<void>();
  @Output() deleteFinding = new EventEmitter<DentalFindingListItem>();

  isSelectedSite(siteCode: string): boolean {
    return this.selectedSiteCodes.includes(siteCode);
  }

  onExclusiveToggle(siteCode: string, checked: boolean): void {
    this.exclusiveSiteToggle.emit({ siteCode, checked });
  }

  onSurfaceToggle(siteCode: string, checked: boolean): void {
    this.surfaceSiteToggle.emit({ siteCode, checked });
  }

  onFindingInput(query: string): void {
    this.findingInputChange.emit(query);
  }

  onFindingOptionSelected(code: string): void {
    this.findingSelected.emit(code);
  }

  onSaveClick(): void {
    this.save.emit();
  }

  onDeleteFinding(item: DentalFindingListItem): void {
    this.deleteFinding.emit(item);
  }
}
