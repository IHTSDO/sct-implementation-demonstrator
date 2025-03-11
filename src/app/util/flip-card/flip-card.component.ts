import { Component } from '@angular/core';

@Component({
  selector: 'app-flip-card',
  templateUrl: './flip-card.component.html',
  styleUrls: ['./flip-card.component.scss'],
  standalone: false
})
export class FlipCardComponent {
  isFlipped = false;

  toggleFlip(): void {
    this.isFlipped = !this.isFlipped;
  }
}
