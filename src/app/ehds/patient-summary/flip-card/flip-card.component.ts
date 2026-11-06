import { Component, Input } from '@angular/core';

/**
 * Two-sided card that flips between a front (`[flipFront]`) and a back
 * (`[flipBack]`) projected content, like the Laboratory demo's form / FHIR
 * resource card. It adds no background or padding of its own, so it can wrap
 * a whole page area or the body of a single section.
 */
@Component({
  selector: 'app-eps-flip-card',
  templateUrl: './flip-card.component.html',
  styleUrls: ['./flip-card.component.css'],
  standalone: false,
})
export class FlipCardComponent {
  @Input() flipped = false;
}
