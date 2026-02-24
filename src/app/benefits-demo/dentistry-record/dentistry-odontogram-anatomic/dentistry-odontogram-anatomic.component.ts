import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OdontogramTooth, SnomedConceptOption } from '../models/tooth.model';

interface QuadrantView {
  key: string;
  label: string;
  prefix: string;
  transform: string;
}

@Component({
  selector: 'app-dentistry-odontogram-anatomic',
  templateUrl: './dentistry-odontogram-anatomic.component.html',
  styleUrls: ['./dentistry-odontogram-anatomic.component.css'],
  standalone: false
})
export class DentistryOdontogramAnatomicComponent {
  @Input() quadrants: QuadrantView[] = [];
  @Input() surfaceOptions: SnomedConceptOption[] = [];
  @Input() hoveredTooth: OdontogramTooth | null = null;
  @Input() tooltipX = 0;
  @Input() tooltipY = 0;

  @Input() getTeethForQuadrant: (prefix: string) => OdontogramTooth[] = () => [];
  @Input() trackByToothId: (_: number, tooth: OdontogramTooth) => string = (_: number, tooth: OdontogramTooth) => tooth.id;
  @Input() isSelected: (toothId: string) => boolean = () => false;
  @Input() isToothAbsent: (toothId: string) => boolean = () => false;
  @Input() getLinePaths: (tooth: OdontogramTooth) => string[] = () => [];
  @Input() hasSurfaceVisual: (toothId: string, surfaceCode: string) => boolean = () => false;
  @Input() getSurfaceVisualType: (toothId: string, surfaceCode: string) => 'finding' | 'procedure-planned' | 'procedure-completed' | null = () => null;
  @Input() getSurfaceOverlayClass: (surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string) => string = () => '';
  @Input() isSurfacePreview: (toothId: string, surfaceCode: string) => boolean = () => false;
  @Input() getSurfaceOverlayPath: (surfaceCode: string, tooth: OdontogramTooth) => string = () => '';
  @Input() getSurfaceFill: (surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string) => string = () => 'none';
  @Input() getSurfaceStroke: (surfaceCode: string) => string | null = () => null;
  @Input() getSurfaceStrokeWidth: (surfaceCode: string) => string | null = () => null;
  @Input() getToothTooltipLines: (toothId: string) => string[] = () => [];

  @Output() toothPinned = new EventEmitter<OdontogramTooth>();
  @Output() toothMouseEnter = new EventEmitter<{ tooth: OdontogramTooth; event: MouseEvent }>();
  @Output() toothMouseMove = new EventEmitter<MouseEvent>();
  @Output() toothMouseLeave = new EventEmitter<void>();

  onPinTooth(tooth: OdontogramTooth): void {
    this.toothPinned.emit(tooth);
  }

  onMouseEnter(tooth: OdontogramTooth, event: MouseEvent): void {
    this.toothMouseEnter.emit({ tooth, event });
  }
}
