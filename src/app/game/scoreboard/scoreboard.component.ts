import { trigger, transition, animate, keyframes, style } from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseService } from 'src/app/services/firebase.service';

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
export class ScoreboardComponent implements OnInit {
  displayedColumns: string[] = ['position', 'message', 'difficulty', 'score', 'numberOfRounds', 'secondsPlayed', 'date'];
  dataSource: any[] = [];
  loadingScores = false;

  constructor(private firebaseService: FirebaseService, public router: Router) { }

  ngOnInit() {
   this.loadScores();
  }

  loadScores() {
    this.loadingScores = true;
    this.firebaseService.getScores().then(scores => {
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
