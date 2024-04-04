import { Component, OnInit, ViewChild } from "@angular/core";
import { Observable, Subscription, firstValueFrom, map, takeWhile, timer } from "rxjs";
import { Game, SnoguessService } from "../service/snoguess.service";
import { trigger, state, style, transition, animate, keyframes } from "@angular/animations";
import { KeyboardComponent } from "../keyboard/keyboard.component";
import { PreloadService } from "src/app/services/preload.service";
import { TerminologyService } from "src/app/services/terminology.service";
import { FirebaseService } from "src/app/services/firebase.service";
import { Router } from "@angular/router";
import { Timestamp } from "firebase/firestore";

@Component({
  selector: 'app-snoguess-main',
  templateUrl: './snoguess-main.component.html',
  styleUrls: ['./snoguess-main.component.css'],
  animations: [
    trigger('shake', [
      transition('normal => shake', animate(200, keyframes([
        style({transform: 'translateX(0)'}),
        style({transform: 'translateX(-10px)'}),
        style({transform: 'translateX(10px)'}),
        style({transform: 'translateX(0)'}),
      ]))),
    ]),
    trigger('popIn', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }), // Initial state
        animate('0.5s cubic-bezier(.8, -0.6, 0.2, 1.5)',
          style({ transform: 'scale(1.3)', opacity: 1 })),
        animate('0.2s cubic-bezier(.8, -0.6, 0.2, 1.5)',
          style({ transform: 'scale(1)', opacity: 1 })) // End state
      ]),
    ]),
    trigger('scrollUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }), // Start from below
        animate('0.5s ease-out',
          style({ transform: 'translateY(0)', opacity: 1 })) // End at its original position
      ])
    ]),
    trigger('fadeInDelayed', [
      transition(':enter', [
        style({ opacity: 0 }),
        // Delay equal to scroll-up duration
        animate('1s 0.5s ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})

export class SnoguessMainComponent implements OnInit {

  // add viewchild for #keyboard
  @ViewChild('keyboard') keyboard!: KeyboardComponent;

  game!: Observable<Game>;
  shakeState = 'normal';
  termGuessed = '';
  goals: any[] = [];
  loadingAssetsProgress = 0;
  loadingAssets = true;
  showInstructions = false;
  chooseDifficulty = false;
  currentYear: Date = new Date();
  difficultyLevels: any[] = [];

  selectedEdition!: string;
  selectedLanguage!: string;

  private gameTimerSubscription!: Subscription;
  public elapsedTime: number = 0;
  private gameInProgress: boolean = false;

  messageForLeaderboard = "";
  highScore: boolean = false;


  constructor(
    private snoguessMainService: SnoguessService, 
    private preloadService: PreloadService, 
    private terminologyService: TerminologyService,
    private firebaseService: FirebaseService,
    private router: Router
    ) {}

  ngOnInit(): void {
    this.game = this.snoguessMainService.getGameState();
    this.difficultyLevels = this.snoguessMainService.getDifficultyLevels();
    this.game.subscribe((game: Game) => {
      if (game.state === 'playing') {
        this.goals = game.rules.goals;
      }
      if (game.state === 'gameOver' || game.state === 'won') {
        this.stopTimer();
        if (game.state === 'won') {
          // check if this is a high score
          this.firebaseService.getScores().then((scores: any) => {
            if (game.score > scores[scores.length - 1].score) {
              this.highScore = true;
            }
          });
        }
      }
    });
    this.snoguessMainService.guessResult.subscribe((guess: any) => {
      if (guess.result === false) {
        this.keyboard?.addGuessedLetter(guess.letter, false);
        this.shakeState = 'shake';
        // Ensure we only shake once per guess
        setTimeout(() => this.shakeState = 'normal', 200);
      } else {
        this.keyboard?.addGuessedLetter(guess.letter, true);
      }
    });

    this.snoguessMainService.termResult.subscribe((result: string) => {
      if (result) {
        this.keyboard?.reset();
        this.termGuessed = result;
        setTimeout(() => {
          this.termGuessed = '';
        }, 2000);
      }
    });

    const imageUrls = [
      'assets/img/SI_CT_w_tagline.png',
      'assets/img/snoguess-logo.png',
      'assets/img/congratulations.png',
      'assets/img/correct.png',
      'assets/img/game-over.png',
      'assets/img/instructions.png',
      'assets/img/difficulty.png',
      'assets/img/scoreboard.png',
    ];

    this.preloadService.preloadImages(imageUrls).then(() => {
      setTimeout(() => {
        this.loadingAssets = false;
        this.loadMenu();
      }, 500);
    });

    this.preloadService.loadingProgress.subscribe(progress => {
      this.loadingAssetsProgress = progress;
    });

    this.terminologyService.fhirUrlParam$.subscribe(url => {
      if (url) {
        this.terminologyService.getCodeSystem(url).subscribe(data => {
          this.selectedEdition = data?.entry[0]?.resource?.title;
        });
      }
    });

    this.terminologyService.lang$.subscribe(lang => {
      this.selectedLanguage = lang;
    });

  }

  loadMenu(): void {
    this.snoguessMainService.loadMenu();
  }
  
  backToMenu(): void {
    this.chooseDifficulty = false;
  }

  showInstructionsPanel(): void {
    this.showInstructions = true;
  }

  hideInstructionsPanel(): void {
    this.showInstructions = false;
  }

  chooseDifficultyLevel(): void {
    this.chooseDifficulty = true;
  }

  startGame(level: string): void {
    this.chooseDifficulty = false;
    if (this.keyboard) this.keyboard.reset();
    this.stopTimer(); // Ensure any existing timer is stopped before starting a new one
    this.snoguessMainService.startGame(level);
    this.startTimer(); // Start the game timer
    this.highScore = false;
  }

  async guessLetter(letter: string) {
    let game = await firstValueFrom(this.game);
    if (game?.state === 'playing') {
      this.snoguessMainService.guessLetter(letter);
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

  getMaxTrophyObtained(score: number): string {
    let maxTrophy = '';
    this.goals.forEach((goal) => {
      if (score >= goal.score) {
        maxTrophy = goal.name;
      }
    });
    return maxTrophy;
  }

  startTimer(): void {
    this.elapsedTime = 0;
    this.gameInProgress = true;
    const timer$ = timer(0, 1000).pipe(
      map(tick => this.elapsedTime = tick),
      takeWhile(() => this.gameInProgress)
    );
    this.gameTimerSubscription = timer$.subscribe();
  }
  
  stopTimer(): void {
    this.gameInProgress = false;
    if (this.gameTimerSubscription) {
      this.gameTimerSubscription.unsubscribe();
    }
  }

  openScoreboard(): void {
    this.router.navigate(['/snoguess/scoreboard']);
  }

  saveScore(gameState: any): void {
    let highScore = {
      "score": gameState.score,
      "numberOfRounds": gameState.round,
      "difficulty": gameState.difficultyLevel,
      "elapsed": gameState.endTimestamp - gameState.startTimestamp,
      "date": Timestamp.now(),
      "message": this.messageForLeaderboard
    }
    this.firebaseService.addScore(highScore).then(() => {
      this.messageForLeaderboard = "";
      this.openScoreboard();
    }).catch((error) => {
      this.messageForLeaderboard = "";
      console.error("Error saving score: ", error);
      this.loadMenu();
    });
  }

  getLanguageName(lang: string): string {
    const languageNames: { [key: string]: string } = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      da: 'Danish',
      nl: 'Dutch',
      et: 'Estonian',
      fi: 'Finnish',
      no: 'Norwegian',
      sv: 'Swedish',
    };

    return languageNames[lang] || lang;
  }
  setLanguage(lang: string): void {
    const editions: { [key: string]: any } = {
      en: { lang: 'en', fhirUrl: 'http://snomed.info/sct/900000000000207008/version/20240401' },
      es: { lang: 'es', fhirUrl: 'http://snomed.info/sct/449081005/version/20240331' },
      fr: { lang: 'fr', fhirUrl: 'http://snomed.info/sct/11000241103/version/20230331' },
      de: { lang: 'de', fhirUrl: 'http://snomed.info/sct/11000274103/version/20231115' },
      da: { lang: 'da', fhirUrl: 'http://snomed.info/sct/554471000005108/version/20240331' },
      nl: { lang: 'nl', fhirUrl: 'http://snomed.info/sct/11000146104/version/20240331' },
      et: { lang: 'et', fhirUrl: 'http://snomed.info/sct/11000181102/version/20231130' },
      fi: { lang: 'fi', fhirUrl: 'http://snomed.info/sct/11000229106/version/20231215' },
      no: { lang: 'no', fhirUrl: 'http://snomed.info/sct/51000202101/version/20231015' },
      sv: { lang: 'sv', fhirUrl: 'http://snomed.info/sct/45991000052106/version/20231130' }
    }

    this.terminologyService.setLang(lang);
    this.terminologyService.setFhirUrlParam(editions[lang].fhirUrl);
  }

}
