import { Component, OnInit } from "@angular/core";
import { Observable } from "rxjs";
import { Game, SnoguessService } from "../service/snoguess.service";
import { trigger, state, style, transition, animate, keyframes } from "@angular/animations";

@Component({
  selector: 'app-snoguess-main',
  templateUrl: './snoguess-main.component.html',
  styleUrls: ['./snoguess-main.component.css', './fireworks.scss'],
  animations: [
    trigger('heartAnimation', [
      state('filled', style({
        opacity: 1,
      })),
      state('empty', style({
        opacity: 0.5,
      })),
      transition('filled => empty', [
        animate('0.5s', keyframes([
          style({transform: 'scale(1)', opacity: 1, offset: 0}),
          style({transform: 'scale(1.5)', opacity: 0.7, offset: 0.5}),
          style({transform: 'scale(1)', opacity: 0.5, offset: 1.0}),
        ]))
      ]),
      transition('empty => filled', [
        animate('0.5s', keyframes([
          style({transform: 'scale(1)', opacity: 0.5, offset: 0}),
          style({transform: 'scale(1.5)', opacity: 0.7, offset: 0.5}),
          style({transform: 'scale(1)', opacity: 1, offset: 1.0}),
        ]))
      ]),
    ]),
    trigger('shake', [
      transition('normal => shake', animate(200, keyframes([
        style({transform: 'translateX(0)'}),
        style({transform: 'translateX(-10px)'}),
        style({transform: 'translateX(10px)'}),
        style({transform: 'translateX(0)'}),
      ]))),
    ]),
    
  ]
})

export class SnoguessMainComponent implements OnInit {
  game!: Observable<Game>;
  shakeState = 'normal';

  constructor(private snoguessMainService: SnoguessService) {}

  ngOnInit(): void {
    this.game = this.snoguessMainService.getGameState();
    this.initialize();
    this.snoguessMainService.guessResult.subscribe((isCorrect: boolean) => {
      if (!isCorrect) {
        this.shakeState = 'shake';
        // Ensure we only shake once per guess
        setTimeout(() => this.shakeState = 'normal', 200);
      }
    });
  }

  initialize(): void {
    this.snoguessMainService.getRandomConcept();
  }

  guessLetter(letter: string): void {
    this.snoguessMainService.guessLetter(letter);
  }

  guessTerm(term: string): void {
    const isCorrect = this.snoguessMainService.guessTerm(term);
    if (isCorrect) {
      // Handle correct guess, maybe show a success message
    } else {
      // Optionally handle incorrect guess, like updating the UI or showing a message
    }
  }

  revealHint(): void {
    // Assume you have a method to fetch or calculate the next hint
    const newHint = 'This is a hint';
    this.snoguessMainService.revealHint(newHint);
  }
}
