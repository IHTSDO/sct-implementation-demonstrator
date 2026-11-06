import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EpsAdditionalBinding, EpsFieldMeta } from '../spec/eps-sections.model';
import { ValuesetDialogComponent } from '../../laboratory-demo/valueset-dialog/valueset-dialog.component';

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

  /** The BINDING badge opens a menu (instead of the dialog) when there is more to show than one value set. */
  get hasBindingMenu(): boolean {
    return !!(this.field.bindingMeta?.additional?.length || this.field.alignmentNote);
  }

  /** Last segment of a value set canonical, e.g. `problems-uv-ips`. */
  valueSetName(canonical: string): string {
    return canonical.split('/').pop() || canonical;
  }

  openValueSet(): void {
    const b = this.field.bindingMeta;
    if (!b) return;
    this.openDialog(b.pageUrl, `${this.field.label} — value set (${b.strength})`);
  }

  /**
   * Additional bindings: embeddable pages open in the same dialog; pages that
   * refuse framing (MyHealth@EU catalogue) open in a new tab.
   */
  openAdditional(a: EpsAdditionalBinding): void {
    if (!a.embeddable) {
      window.open(a.pageUrl, '_blank', 'noopener');
      return;
    }
    this.openDialog(a.pageUrl, `${this.field.label} — ${a.title} (additional, ${a.purpose})`);
  }

  private openDialog(url: string, dialogTitle: string): void {
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      autoFocus: false,
      restoreFocus: true,
      data: { url, fieldName: this.field.label, dialogTitle },
      panelClass: 'valueset-dialog-container',
    });
  }
}
