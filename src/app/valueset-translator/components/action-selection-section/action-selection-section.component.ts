import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FileProcessingResult } from '../../models';

@Component({
  selector: 'app-action-selection-section',
  templateUrl: './action-selection-section.component.html',
  styleUrls: ['./action-selection-section.component.scss']
})
export class ActionSelectionSectionComponent {
  @Input() showPreview = false;
  @Input() previewData: any[] = [];
  @Input() selectedAction: string | null = null;
  @Input() processingResult: FileProcessingResult | null = null;
  @Input() canExecuteAction = false;
  @Input() isLoading = false;
  
  @Output() actionSelected = new EventEmitter<string>();

  onActionSelect(action: string): void {
    this.actionSelected.emit(action);
  }

  shouldShowActionSelection(): boolean {
    return this.showPreview && 
           this.previewData.length > 0 && 
           !this.selectedAction && 
           !this.isLoading && 
           this.canExecuteAction;
  }

  getAvailableActions(): Array<{id: string, label: string, icon: string, color: string, condition?: boolean}> {
    const actions = [
      {
        id: 'translate',
        label: 'Translate the set of concepts',
        icon: 'translate',
        color: 'primary',
        condition: true
      },
      {
        id: 'source-valueset',
        label: 'Generate FHIR ValueSet (identical to uploaded concepts)',
        icon: 'list_alt',
        color: 'accent',
        condition: true
      },
      {
        id: 'target-valueset',
        label: 'Generate FHIR ValueSet (with translated display terms)',
        icon: 'language',
        color: 'accent',
        condition: true
      },
      {
        id: 'translate-target',
        label: 'Translate target column (Snap2Snomed Map)',
        icon: 'swap_horiz',
        color: 'warn',
        condition: this.processingResult?.isMap || false
      },
      {
        id: 'fhir-package',
        label: 'Create FHIR Package (Snap2Snomed Map)',
        icon: 'archive',
        color: 'warn',
        condition: this.processingResult?.isMap || false
      }
    ];

    return actions.filter(action => action.condition);
  }
}
