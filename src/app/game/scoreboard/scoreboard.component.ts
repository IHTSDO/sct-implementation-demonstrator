import { trigger, transition, animate, keyframes, style } from '@angular/animations';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseService } from 'src/app/services/firebase.service';
import { SnoguessService } from '../service/snoguess.service';

@Component({
  selector: 'app-scoreboard',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.css'],
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
export class ScoreboardComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['position', 'message', 'difficulty', 'score', 'numberOfRounds', 'secondsPlayed', 'date'];
  dataSource: any[] = [];
  loadingScores = false;
  difficultyLevels: any[] = []
  selectedLevel: string = '';
  intervalId: any;

  constructor(
    private firebaseService: FirebaseService,
    public router: Router,
    private snoguessMainService: SnoguessService,
    private route: ActivatedRoute // Inject ActivatedRoute
  ) {}
  
  ngOnInit() {
    this.difficultyLevels = this.snoguessMainService.getDifficultyLevels();
    
    this.route.queryParams.subscribe(params => {
      const levelParam = params['level'];
      // Check if the levelParam exists and is a valid difficulty level
      if (levelParam && this.difficultyLevels.some(level => level.name === levelParam)) {
        this.selectedLevel = levelParam;
      } else {
        // Default to the first difficulty level if the parameter is missing or invalid
        this.selectedLevel = this.difficultyLevels[0].name;
      }
      this.loadScores(this.selectedLevel);
      this.startAutoRefresh();
    });
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  startAutoRefresh() {
  // Clear any existing interval to prevent duplicates
  this.stopAutoRefresh();
    this.intervalId = setInterval(() => {
      if (this.selectedLevel == 'Tournament') {
        this.loadScores(this.selectedLevel);
      }
    }, 60000); // Refresh every 30 seconds
  }

  stopAutoRefresh() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setLevel(level: string) {
    this.selectedLevel = level;
    this.loadScores(level);
  }

  loadScores(collectionName: string) {
    this.loadingScores = true;
    this.firebaseService.getScores(collectionName).then(scores => {
      this.dataSource = scores.map((doc: any) => ({
        ...doc,
        date: doc.date ? doc.date.toDate() : new Date() // Converting Firestore Timestamp to JavaScript Date object
      }));
      this.loadingScores = false;
      
    });
  }

  backToGame() {
    this.router.navigate(['/snoguess']);
  }
}
