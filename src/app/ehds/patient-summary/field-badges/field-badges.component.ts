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

  /** Readable label for a ConceptMap relationship code (source = EHDS model, target = FHIR). */
  relationshipLabel(code: string): string {
    switch (code) {
      case 'equivalent':
        return 'Equivalent';
      case 'related-to':
        return 'Related';
      case 'source-is-broader-than-target':
        return 'EHDS is broader';
      case 'source-is-narrower-than-target':
        return 'EHDS is narrower';
      case 'no-map':
        return 'No FHIR mapping';
      default:
        return code;
    }
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
   * Additional bindings open in the same dialog; pages that refuse framing
   * (MyHealth@EU catalogue) open in a new tab (see ValuesetDialogComponent.openPage).
   */
  openAdditional(a: EpsAdditionalBinding): void {
    this.openDialog(a.pageUrl, `${this.field.label} — ${a.title} (additional, ${a.purpose})`);
  }

  private openDialog(url: string, dialogTitle: string): void {
    ValuesetDialogComponent.openPage(this.dialog, { url, fieldName: this.field.label, dialogTitle });
  }
}
