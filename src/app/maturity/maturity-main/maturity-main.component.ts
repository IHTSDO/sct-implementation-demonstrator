import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import { MaturityResultsDialogComponent } from '../maturity-results-dialog';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-maturity-main',
  templateUrl: './maturity-main.component.html',
  styleUrl: './maturity-main.component.css',
  animations: [
    trigger('questionAnimation', [
      state('enter', style({ opacity: 1 })),
      state('leave', style({ opacity: 0 })),
      transition('enter => leave', [
        animate('200ms ease-in-out', style({ opacity: 0 }))
      ]),
      transition('leave => enter', [
        style({ opacity: 0 }),
        animate('200ms ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class MaturityMainComponent implements OnInit {
  
  maturityQuestions: any = {};
  responseForm: FormGroup;
  allQuestions: any[] = [];
  currentQuestionIndex = -1;
  currentControl!: FormControl;
  selectedStakeholder: any = null;
  animationState = 'enter';

  constructor(private http: HttpClient, private fb: FormBuilder, private dialog: MatDialog) {
    this.responseForm = this.fb.group({
      selectedStakeholder: new FormControl(null, Validators.required), // Add stakeholder selection control
    });
    this.currentControl = this.responseForm.controls['selectedStakeholder'] as FormControl;
  }

  async ngOnInit() {
    this.maturityQuestions = await lastValueFrom(this.http.get('assets/maturity/maturityLevels.json'));
    this.initializeForm();
    // Flatten all questions into one array for one-at-a-time display
    // this.flattenQuestions();
  }

  private initializeForm(): void {
    this.responseForm = this.fb.group({
      selectedStakeholder: new FormControl(null, Validators.required),
    });
    this.currentControl = this.responseForm.controls['selectedStakeholder'] as FormControl;
    this.maturityQuestions.stakeHolders.forEach((stakeholder: any) => {
      stakeholder.kpas.forEach((kpa: any) => {
        kpa.questions.forEach((question: any) => {
          const questionPath = [stakeholder.id, kpa.id, question.id].join('.');
          // Flatten controls using the full path as the key
          this.responseForm.addControl(questionPath, new FormControl(null, Validators.required));
        });
      });
    });
  }

  onStakeholderSelected(): void {
    this.animationState = 'leave';
    setTimeout(() => {
      const stakeholderId = this.responseForm.get('selectedStakeholder')?.value;
      this.selectedStakeholder = this.maturityQuestions.stakeHolders.find(
        (stakeholder: any) => stakeholder.id === stakeholderId
      );
      this.flattenQuestions(); // Refilter questions for the selected stakeholder
      this.currentQuestionIndex = 0; // Start showing the first question
      this.currentControl = this.responseForm.controls[this.allQuestions[this.currentQuestionIndex].questionFullPath] as FormControl;
      this.animationState = 'enter';
    }, 200); // Match the duration of the animation
  }
  
  flattenQuestions(): void {
    this.allQuestions = [];
    if (this.selectedStakeholder) {
      this.selectedStakeholder.kpas.forEach((kpa: any) => {
        kpa.questions.forEach((question: any) => {
          const questionPath = [this.selectedStakeholder.id, kpa.id, question.id].join('.');
          this.allQuestions.push({
            stakeholderName: this.selectedStakeholder.name,
            kpaName: kpa.name,
            question: question,
            questionFullPath: questionPath,
          });
        });
      });
    }
  }

  goToNextQuestion() {
    this.animationState = 'leave';
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.currentControl = this.responseForm.controls[this.allQuestions[this.currentQuestionIndex].questionFullPath] as FormControl;
      this.animationState = 'enter';
    }, 200);
  }

  goToPreviousQuestion() {
    this.animationState = 'leave';
    setTimeout(() => {
      this.currentQuestionIndex--;
      this.currentControl = this.responseForm.controls[this.allQuestions[this.currentQuestionIndex].questionFullPath] as FormControl;
      this.animationState = 'enter';
    }, 200);
  }
  
  startOver(): void {
    this.currentQuestionIndex = -1;
    // reset all responses
    this.responseForm.reset();
    this.currentControl = this.responseForm.controls['selectedStakeholder'] as FormControl;
  }

  uploadFile(event: any) {
    if (event.target.files.length !== 1) {
      console.error('No file selected');
    } else {
      const reader = new FileReader();
      reader.onloadend = (e) => {
        if (reader.result) {
          const uploadedVersion = JSON.parse(reader.result?.toString());
          console.log('Uploaded version:', uploadedVersion);
          this.maturityQuestions = uploadedVersion;
        }
      };
      reader.readAsText(event.target.files[0]);
    }
  }

  submitStakeholderResponses(): void {
    this.animationState = 'leave';
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.animationState = 'enter';
      // this.dialog.open(MaturityResultsDialogComponent, {
      //   width: '1600px',
      //   data: { maturityResponse: this.responseForm.value }
      // });
    }, 200);
  }

  getStakeholderFormGroup(stakeholderName: string): FormGroup {
    return this.responseForm.get(stakeholderName) as FormGroup;
  }

  getUnansweredCount(stakeholderName: string): number {
    let count = 0;
    const stakeholderGroup = this.responseForm.get(stakeholderName) as FormGroup;
  
    if (stakeholderGroup) {
      // Iterate through all KPA groups
      Object.keys(stakeholderGroup.controls).forEach(kpaName => {
        const kpaGroup = stakeholderGroup.get(kpaName) as FormGroup;
        if (kpaGroup) {
          // Iterate through all question controls
          Object.keys(kpaGroup.controls).forEach(questionName => {
            const control = kpaGroup.get(questionName);
            // If a control is required and hasn't been answered, it's invalid
            if (control && control.invalid) {
              count++;
            }
          });
        }
      });
    }
    return count;
  }
} 
