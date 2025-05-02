import { Component } from '@angular/core';
import { SnomedBox } from './models';

@Component({
  selector: 'app-snomed-hub',
  templateUrl: './snomed-hub.component.html',
  styleUrls: ['./snomed-hub.component.scss'],
  standalone: false
})
export class SnomedHubComponent {
  centerX = 400;
  centerY = 400;
  boxSpacing = 20;
  boxOffset = 200; // distance from center to square boundary

  boxes: SnomedBox[] = [
    { label: 'AAP/EPF Periodontal', width: 120, height: 50, fill: 'white' },
    { label: 'GMDN devices', width: 120, height: 50, fill: 'white' },
    { label: 'ICD-10', width: 120, height: 50, fill: 'white' },
    { label: 'ICD-11 MMS', width: 120, height: 50, fill: 'white' },
    { label: 'ICD-O', width: 120, height: 50, fill: 'white' },
    { label: 'HPO', width: 120, height: 50, fill: 'white' },
    { label: 'MedDRA', width: 120, height: 50, fill: 'white' },
    { label: 'Orphanet', width: 120, height: 50, fill: 'white' },
    { label: 'INCP', width: 120, height: 50, fill: 'white' }
    // Add more as needed
  ];

  getBoxPosition(index: number): { x: number; y: number } {
    const total = this.boxes.length;
    const sideLength = this.boxOffset * 2;
    const perimeter = sideLength * 4;
    const boxSpacing = perimeter / total;
    const distance = boxSpacing * index;
  
    let x = 0;
    let y = 0;
  
    const startX = this.centerX - this.boxOffset;
    const startY = this.centerY - this.boxOffset;
  
    if (distance < sideLength) {
      // Top side (left to right)
      x = startX + distance;
      y = startY;
    } else if (distance < sideLength * 2) {
      // Right side (top to bottom)
      x = this.centerX + this.boxOffset;
      y = startY + (distance - sideLength);
    } else if (distance < sideLength * 3) {
      // Bottom side (right to left)
      x = this.centerX + this.boxOffset - (distance - sideLength * 2);
      y = this.centerY + this.boxOffset;
    } else {
      // Left side (bottom to top)
      x = startX;
      y = this.centerY + this.boxOffset - (distance - sideLength * 3);
    }
  
    return {
      x: x - this.boxes[index].width / 2,
      y: y - this.boxes[index].height / 2
    };
  }
}
