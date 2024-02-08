import { Component, OnInit, ViewChild } from "@angular/core";
import { Observable, firstValueFrom } from "rxjs";
import { Game, SnoguessService } from "../service/snoguess.service";
import { trigger, state, style, transition, animate, keyframes } from "@angular/animations";
import { KeyboardComponent } from "../keyboard/keyboard.component";

@Component({
  selector: 'app-snoguess-main',
  templateUrl: './snoguess-main.component.html',
  styleUrls: ['./snoguess-main.component.css', './fireworks.scss', './rain.scss'],
  animations: [
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

  // add viewchild for #keyboard
  @ViewChild('keyboard') keyboard!: KeyboardComponent;

  game!: Observable<Game>;
  shakeState = 'normal';
  termGuessed = false;
  goals: any[] = [];

  constructor(private snoguessMainService: SnoguessService) {}

  ngOnInit(): void {
    this.game = this.snoguessMainService.getGameState();
    this.goals = this.snoguessMainService.goals;
    this.initialize();
    this.snoguessMainService.guessResult.subscribe((guess: any) => {
      if (guess.result === false) {
        this.keyboard.addGuessedLetter(guess.letter, false);
        this.shakeState = 'shake';
        // Ensure we only shake once per guess
        setTimeout(() => this.shakeState = 'normal', 200);
      } else {
        this.keyboard.addGuessedLetter(guess.letter, true);
      }
    });

    this.snoguessMainService.termResult.subscribe((result: boolean) => {
      if (result) {
        this.keyboard.reset();
        this.termGuessed = true;
        setTimeout(() => {
          this.termGuessed = false;
        }, 3000);
      }
    });
  }

  initialize(): void {
    if (this.keyboard) this.keyboard.reset();
    this.snoguessMainService.getRandomConcept(true);
  }

  async guessLetter(letter: string) {
    let game = await firstValueFrom(this.game);
    if (game?.state === 'playing') {
      this.snoguessMainService.guessLetter(letter);
    }
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
    this.snoguessMainService.revealHint();
  }

  calculateProgress(score: number): number {
    const maxScore = this.goals[this.goals.length - 1].score;
    const progress = (score / maxScore) * 100;
    return Math.min(progress, 100); // Ensure it doesn't go over 100%
  }
  
  calculateGoalPosition(goalScore: number): number {
    const maxScore = this.goals[this.goals.length - 1].score;
    const position = (goalScore / maxScore) * 100;
    return position;
  }

  findCurrentGoal(currentScore: number): any {
    // Default to the first goal if no score or below first goal
    if (!currentScore || currentScore < this.goals[0].score) {
      return { ...this.goals[0], previousGoalScore: 0 };
    }
  
    // Iterate through goals to find the current goal based on score
    for (let i = 0; i < this.goals.length; i++) {
      // Check if the current score is less than the next goal's score
      if (i === this.goals.length - 1 || currentScore < this.goals[i + 1].score) {
        // Return the current goal, along with the previous goal's score for progress calculation
        return {
          ...this.goals[i],
          previousGoalScore: i === 0 ? 0 : this.goals[i - 1].score
        };
      }
    }
  
    // If all else fails, return the last goal as the current goal
    // This case might not be needed if you always expect the score to be within the goals
    return { ...this.goals[this.goals.length - 1], previousGoalScore: this.goals[this.goals.length - 2].score };
  }

}
