import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EpsFieldMeta } from '../spec/eps-sections.model';
import { ValuesetDialogComponent } from '../../ehds-laboratory-demo/valueset-dialog/valueset-dialog.component';

/**
 * Reusable FHIR / SNOMED + BINDING badges for a single EPS field.
 *
 * This is the generated equivalent of the hand-written badge + element-definition
 * menus in the Laboratory demo: the popover is filled from `field.doc` (extracted
 * from the EPS StructureDefinition snapshot) and the BINDING badge opens the value
 * set page in the shared ValuesetDialogComponent, exactly like the Lab.
 */
@Component({
  selector: 'app-eps-field-badges',
  templateUrl: './field-badges.component.html',
  styleUrls: ['./field-badges.component.css'],
  standalone: false,
})
export class FieldBadgesComponent {
  @Input() field!: EpsFieldMeta;

  constructor(private dialog: MatDialog) {}

  get bindingLabel(): string {
    return this.field.bindingMeta?.isSct ? 'BINDING (SCT)' : 'BINDING';
  }

  openValueSet(): void {
    const b = this.field.bindingMeta;
    if (!b) return;
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      autoFocus: false,
      restoreFocus: true,
      data: { url: b.pageUrl, fieldName: this.field.label, dialogTitle: `${this.field.label} — value set (${b.strength})` },
      panelClass: 'valueset-dialog-container',
    });
  }
}
