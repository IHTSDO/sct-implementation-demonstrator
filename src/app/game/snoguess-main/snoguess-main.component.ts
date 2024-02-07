import { Component, OnInit } from "@angular/core";
import { Observable } from "rxjs";
import { Game, SnoguessService } from "../service/snoguess.service";
import { trigger, state, style, transition, animate, keyframes } from "@angular/animations";

@Component({
  selector: 'app-snoguess-main',
  templateUrl: './snoguess-main.component.html',
  styleUrls: ['./snoguess-main.component.css', './fireworks.scss', './rain.scss'],
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
  termGuessed = false;
  goals: any[] = [];

  constructor(private snoguessMainService: SnoguessService) {}

  ngOnInit(): void {
    this.game = this.snoguessMainService.getGameState();
    this.goals = this.snoguessMainService.goals;
    this.initialize();
    this.snoguessMainService.guessResult.subscribe((isCorrect: boolean) => {
      if (!isCorrect) {
        this.shakeState = 'shake';
        // Ensure we only shake once per guess
        setTimeout(() => this.shakeState = 'normal', 200);
      }
    });

    this.snoguessMainService.termResult.subscribe((result: boolean) => {
      if (result) {
        this.termGuessed = true;
        setTimeout(() => {
          this.termGuessed = false;
        }, 3000);
      }
    });
  }

  initialize(): void {
    this.snoguessMainService.getRandomConcept(true);
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
    this.snoguessMainService.revealHint();
  }

  calculateProgress(score: number): number {
    // This function calculates the progress towards the current goal
    const currentGoal = this.findCurrentGoal(score); // Implement this based on your goals array
    const previousGoalScore = currentGoal.previousGoalScore || 0; // Handle the first goal case
    const progress = ((score - previousGoalScore) / (currentGoal.score - previousGoalScore)) * 100;
    return Math.min(progress, 100); // Ensure it doesn't go over 100%
  }
  
  calculateGoalPosition(goalScore: number): number {
    // This would calculate where to position the goal indicator on the progress bar
    // For simplicity, this might just be a static percentage based on the goal score vs. max score
    const maxScore = 500 + 2; // Assuming Platinum is the max goal
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
