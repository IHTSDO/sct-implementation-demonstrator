import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { OdontogramTooth } from '../models/tooth.model';

type RootDirection = 'top' | 'bottom' | 'left' | 'right';

interface RootSurfaceToothPosition {
  tooth: OdontogramTooth;
  x: number;
  y: number;
}

interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: 'app-dentistry-odontogram-root-surface',
  templateUrl: './dentistry-odontogram-root-surface.component.html',
  styleUrls: ['./dentistry-odontogram-root-surface.component.css'],
  standalone: false
})
export class DentistryOdontogramRootSurfaceComponent implements OnInit, OnChanges {
  @Input() getTeethForQuadrant: (prefix: string) => OdontogramTooth[] = () => [];
  @Input() isSelected: (toothId: string) => boolean = () => false;
  @Input() hasSurfaceVisual: (toothId: string, surfaceCode: string) => boolean = () => false;
  @Input() isSurfacePreview: (toothId: string, surfaceCode: string) => boolean = () => false;
  @Input() hoveredTooth: OdontogramTooth | null = null;
  @Input() tooltipX = 0;
  @Input() tooltipY = 0;

  @Input() surfaceCodeMesial = '';
  @Input() surfaceCodeDistal = '';
  @Input() surfaceCodeOcclusal = '';
  @Input() surfaceCodeLingual = '';
  @Input() surfaceCodeVestibular = '';
  @Input() surfaceCodeEntire = '';
  @Input() surfaceCodePeriodontal = '';

  @Output() toothPinned = new EventEmitter<OdontogramTooth>();
  @Output() toothMouseEnter = new EventEmitter<{ tooth: OdontogramTooth; event: MouseEvent }>();
  @Output() toothMouseMove = new EventEmitter<MouseEvent>();
  @Output() toothMouseLeave = new EventEmitter<void>();

  upperLeftRow: RootSurfaceToothPosition[] = [];
  upperRightRow: RootSurfaceToothPosition[] = [];
  lowerLeftRow: RootSurfaceToothPosition[] = [];
  lowerRightRow: RootSurfaceToothPosition[] = [];

  private readonly toothSpacing = 52;

  ngOnInit(): void {
    this.refreshRows();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['getTeethForQuadrant']) {
      this.refreshRows();
    }
  }

  onPinTooth(tooth: OdontogramTooth): void {
    this.toothPinned.emit(tooth);
  }

  trackByToothPosition(_: number, positioned: RootSurfaceToothPosition): string {
    return positioned.tooth.id;
  }

  onMouseEnter(tooth: OdontogramTooth, event: MouseEvent): void {
    this.toothMouseEnter.emit({ tooth, event });
  }

  getToothScale(tooth: OdontogramTooth): number {
    if (this.isMolar(tooth)) {
      return 1.12;
    }
    if (this.isPremolar(tooth)) {
      return 1;
    }
    return 0.9;
  }

  getCenterPolygonPoints(tooth: OdontogramTooth): string {
    const half = this.getInnerHalfSize(tooth);
    return `${-half},${-half} ${half},${-half} ${half},${half} ${-half},${half}`;
  }

  getOuterSquarePoints(tooth: OdontogramTooth): string {
    const half = this.getOuterHalfSize(tooth);
    return `${-half},${-half} ${half},${-half} ${half},${half} ${-half},${half}`;
  }

  getInnerSquarePoints(tooth: OdontogramTooth): string {
    const half = this.getInnerHalfSize(tooth);
    return `${-half},${-half} ${half},${-half} ${half},${half} ${-half},${half}`;
  }

  getConnectorLines(tooth: OdontogramTooth): ConnectorLine[] {
    const outer = this.getOuterHalfSize(tooth);
    const inner = this.getInnerHalfSize(tooth);
    return [
      { x1: -outer, y1: -outer, x2: -inner, y2: -inner },
      { x1: outer, y1: -outer, x2: inner, y2: -inner },
      { x1: outer, y1: outer, x2: inner, y2: inner },
      { x1: -outer, y1: outer, x2: -inner, y2: inner }
    ];
  }

  getTopPolygonPoints(tooth: OdontogramTooth): string {
    const outer = this.getOuterHalfSize(tooth);
    const inner = this.getInnerHalfSize(tooth);
    return `${-outer},${-outer} ${outer},${-outer} ${inner},${-inner} ${-inner},${-inner}`;
  }

  getBottomPolygonPoints(tooth: OdontogramTooth): string {
    const outer = this.getOuterHalfSize(tooth);
    const inner = this.getInnerHalfSize(tooth);
    return `${-inner},${inner} ${inner},${inner} ${outer},${outer} ${-outer},${outer}`;
  }

  getLeftPolygonPoints(tooth: OdontogramTooth): string {
    const outer = this.getOuterHalfSize(tooth);
    const inner = this.getInnerHalfSize(tooth);
    return `${-outer},${-outer} ${-inner},${-inner} ${-inner},${inner} ${-outer},${outer}`;
  }

  getRightPolygonPoints(tooth: OdontogramTooth): string {
    const outer = this.getOuterHalfSize(tooth);
    const inner = this.getInnerHalfSize(tooth);
    return `${inner},${-inner} ${outer},${-outer} ${outer},${outer} ${inner},${inner}`;
  }

  hasDirectionSurface(tooth: OdontogramTooth, direction: RootDirection): boolean {
    const fdi = tooth.notations.fdi;
    if (direction === this.getMesialDirection(fdi)) {
      return this.hasSurfaceVisual(tooth.id, this.surfaceCodeMesial);
    }
    if (direction === this.getDistalDirection(fdi)) {
      return this.hasSurfaceVisual(tooth.id, this.surfaceCodeDistal);
    }
    if (direction === this.getVestibularDirection(fdi)) {
      return this.hasSurfaceVisual(tooth.id, this.surfaceCodeVestibular);
    }
    if (direction === this.getLingualDirection(fdi)) {
      return this.hasSurfaceVisual(tooth.id, this.surfaceCodeLingual);
    }
    return false;
  }

  isDirectionPreview(tooth: OdontogramTooth, direction: RootDirection): boolean {
    const fdi = tooth.notations.fdi;
    if (direction === this.getMesialDirection(fdi)) {
      return this.isSurfacePreview(tooth.id, this.surfaceCodeMesial);
    }
    if (direction === this.getDistalDirection(fdi)) {
      return this.isSurfacePreview(tooth.id, this.surfaceCodeDistal);
    }
    if (direction === this.getVestibularDirection(fdi)) {
      return this.isSurfacePreview(tooth.id, this.surfaceCodeVestibular);
    }
    if (direction === this.getLingualDirection(fdi)) {
      return this.isSurfacePreview(tooth.id, this.surfaceCodeLingual);
    }
    return false;
  }

  hasOcclusalSurface(tooth: OdontogramTooth): boolean {
    return this.hasSurfaceVisual(tooth.id, this.surfaceCodeOcclusal);
  }

  isOcclusalPreview(tooth: OdontogramTooth): boolean {
    return this.isSurfacePreview(tooth.id, this.surfaceCodeOcclusal);
  }

  hasEntireSurface(tooth: OdontogramTooth): boolean {
    return this.hasSurfaceVisual(tooth.id, this.surfaceCodeEntire);
  }

  hasPeriodontalSurface(tooth: OdontogramTooth): boolean {
    return this.hasSurfaceVisual(tooth.id, this.surfaceCodePeriodontal);
  }

  isEntirePreview(tooth: OdontogramTooth): boolean {
    return this.isSurfacePreview(tooth.id, this.surfaceCodeEntire);
  }

  isPeriodontalPreview(tooth: OdontogramTooth): boolean {
    return this.isSurfacePreview(tooth.id, this.surfaceCodePeriodontal);
  }

  private buildRow(prefix: string, sequence: number[], startX: number, y: number): RootSurfaceToothPosition[] {
    return sequence
      .map((toothNumber, index) => {
        const tooth = this.getTeethForQuadrant(prefix).find((item) => item.name === String(toothNumber));
        if (!tooth) {
          return null;
        }
        return {
          tooth,
          x: startX + index * this.toothSpacing,
          y
        };
      })
      .filter((item): item is RootSurfaceToothPosition => !!item);
  }

  private refreshRows(): void {
    this.upperLeftRow = this.buildRow('1', [8, 7, 6, 5, 4, 3, 2, 1], 90, 130);
    this.upperRightRow = this.buildRow('2', [1, 2, 3, 4, 5, 6, 7, 8], 530, 130);
    this.lowerLeftRow = this.buildRow('4', [8, 7, 6, 5, 4, 3, 2, 1], 90, 430);
    this.lowerRightRow = this.buildRow('3', [1, 2, 3, 4, 5, 6, 7, 8], 530, 430);
  }

  private getMesialDirection(fdi: string): RootDirection {
    const quadrant = fdi.charAt(0);
    return quadrant === '1' || quadrant === '4' ? 'right' : 'left';
  }

  private getDistalDirection(fdi: string): RootDirection {
    return this.getMesialDirection(fdi) === 'right' ? 'left' : 'right';
  }

  private getVestibularDirection(fdi: string): RootDirection {
    const quadrant = fdi.charAt(0);
    return quadrant === '1' || quadrant === '2' ? 'top' : 'bottom';
  }

  private getLingualDirection(fdi: string): RootDirection {
    return this.getVestibularDirection(fdi) === 'top' ? 'bottom' : 'top';
  }

  private isMolar(tooth: OdontogramTooth): boolean {
    return tooth.type.toLowerCase().includes('molar') && !tooth.type.toLowerCase().includes('premolar');
  }

  private isPremolar(tooth: OdontogramTooth): boolean {
    return tooth.type.toLowerCase().includes('premolar');
  }

  private getOuterHalfSize(tooth: OdontogramTooth): number {
    void tooth;
    // Outer square vertices must lie on the outer circle (r=18): half-side = r / sqrt(2)
    return 12.727922;
  }

  private getInnerHalfSize(tooth: OdontogramTooth): number {
    return this.isMolar(tooth) ? 7.1 : this.isPremolar(tooth) ? 6.2 : 5.4;
  }
}
