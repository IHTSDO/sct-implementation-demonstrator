import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { debounceTime, filter, finalize, lastValueFrom, switchMap, tap, timestamp } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import cloneDeep from 'lodash/cloneDeep';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ActivatedRoute, Router } from '@angular/router';
import { GeocodingService } from 'src/app/services/geocoding.service';
import { FirebaseService, MaturityAssessmentResult } from 'src/app/services/firebase.service';
import { MaturityResultsComponent } from '../maturity-results/maturity-results.component';

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
    ],
    standalone: false
})
export class MaturityMainComponent implements OnInit {
  
  baseMaturityQuestions: any = {};
  maturityQuestions: any = {};
  responseForm: FormGroup;
  allQuestions: any[] = [];
  currentQuestionIndex = -3;
  currentControl!: FormControl;
  currentCommentControl!: FormControl;
  nameControl!: FormControl;
  authorControl!: FormControl;
  timestampControl!: FormControl;
  systemNameControl!: FormControl;
  locationControl!: FormControl;
  locationResults: any[] = []; // will store geocoding matches
  loadingLocationResults = false;
  selectedStakeholder: any = null;
  animationState = 'enter';
  currentKpas: any[] = [];
  authorMode: boolean = false;
  expoMode: boolean = false;

  @ViewChild('results') results!: MaturityResultsComponent;

  constructor(private http: HttpClient, private fb: FormBuilder, private dialog: MatDialog, 
    private route: ActivatedRoute, private geocodingService: GeocodingService, private router: Router,
    private firebaseService: FirebaseService) {
    this.responseForm = this.fb.group({
      selectedStakeholder: new FormControl(null, Validators.required), // Add stakeholder selection control
    });
    this.currentControl = this.responseForm.controls['selectedStakeholder'] as FormControl;
    this.route.queryParams.subscribe(params => {
      if (params['author']) {
        this.authorMode = true;
      }
      if (params['expo']) {
        this.expoMode = true;
      }
    });
  }

  async ngOnInit() {
    this.baseMaturityQuestions = await lastValueFrom(this.http.get('assets/maturity/maturityLevels.json'));
    this.initializeForm();
    // Flatten all questions into one array for one-at-a-time display
    // this.flattenQuestions();
  }

  async initializeForm(newQuestions?: any) {
    if (newQuestions) {
      this.maturityQuestions = newQuestions;
    } else {
      this.maturityQuestions = cloneDeep(this.baseMaturityQuestions);
    }
    
    // In Expo mode, make stakeholder description fields mandatory
    const nameValidators = this.expoMode ? [Validators.required] : [];
    const authorValidators = this.expoMode ? [Validators.required] : [];
    const locationValidators = this.expoMode ? [Validators.required] : [];
    
    this.nameControl = new FormControl(null, nameValidators);
    this.authorControl = new FormControl(null, authorValidators);
    this.timestampControl = new FormControl(new Date().toISOString());
    this.systemNameControl = new FormControl(null);
    this.locationControl = new FormControl(null, locationValidators);
    this.locationResults = [];
    this.responseForm = this.fb.group({
      selectedStakeholder: new FormControl(null, Validators.required),
      name: this.nameControl,
      author: this.authorControl,
      timestamp: this.timestampControl,
      systemName: this.systemNameControl,
      location: this.locationControl,
      comment: new FormControl('')
    });
    this.currentControl = this.responseForm.controls['selectedStakeholder'] as FormControl;
    this.maturityQuestions.stakeHolders.forEach((stakeholder: any) => {
      stakeholder.kpas.forEach((kpa: any) => {
        kpa.questions.forEach((question: any) => {
          const questionPath = [stakeholder.id, kpa.id, question.id].join('_');
          // Flatten controls using the full path as the key
          this.responseForm.addControl(questionPath, new FormControl(null, Validators.required));
        });
      });
    });
    this.locationControl.valueChanges.pipe(
      debounceTime(300),
      filter(value => value && value.length >= 2),
      // turn the loading flag ON each time a new search is triggered
      tap(() => this.loadingLocationResults = true),
      switchMap(value => this.geocodingService.search(value))
    )
    .subscribe(
      results => {
        this.locationResults = results;
        this.loadingLocationResults = false
      },
      error => {
        console.error('Error', error);
        // loadingLocationResults will also be set to false by finalize() above
      }
    );
  }

  displayLocation(location: any): string {
    if (!location) {
      return '';
    }
    return location.label;
  }

  onLocationSelected(option: any) {
    // Do nothing for now
  }

  openDashboard(): void {
    if (this.expoMode) {
      this.router.navigate(['/maturity/dashboard'], { queryParams: { expo: true } });
    } else {
      this.router.navigate(['/maturity/dashboard']);
    }
  }

  startAssessment(): void {
    this.animationState = 'leave';
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.animationState = 'enter';
    }, 200);
  }

  onStakeholderSelected(): void {
    this.animationState = 'leave';
    setTimeout(() => {
      const stakeholderId = this.responseForm.get('selectedStakeholder')?.value;
      this.selectedStakeholder = this.getStakeHolder(stakeholderId);
      
      // Prepare form group for the selected stakeholder KPAs
      const kpaGroup = this.fb.group({});
      this.selectedStakeholder.kpas.forEach((kpa: any, index: number) => {
        // In Expo mode, only enable the first KPA
        const isEnabled = this.expoMode ? index === 0 : true;
        kpaGroup.addControl(kpa.id, this.fb.control({value: isEnabled, disabled: this.expoMode && index !== 0}));
      });
      this.responseForm.addControl('selectedKpas', kpaGroup);

      this.currentKpas = this.selectedStakeholder.kpas; // Store KPAs for template rendering
      
      this.flattenQuestions(); // Refilter questions for the selected stakeholder
      this.currentQuestionIndex++; // Move to select KPAs
      // this.currentControl = this.responseForm.controls[this.allQuestions[1].questionFullPath] as FormControl;
      this.animationState = 'enter';
    }, 200); // Match the duration of the animation
  }

  getKpaControl(kpaId: string): FormControl {
    const selectedKpas = this.responseForm.get('selectedKpas') as FormGroup | null;
    return selectedKpas?.get(kpaId) as FormControl;
  }

  getStakeHolder(stakeholderId: string): any {
    const stakeholder = this.maturityQuestions.stakeHolders.find(
      (stakeholder: any) => stakeholder.id === stakeholderId
    );
    return stakeholder;
  }
  
  flattenQuestions(): void {
    this.allQuestions = [];
    if (this.selectedStakeholder) {
      this.selectedStakeholder.kpas.forEach((kpa: any) => {
        kpa.questions.forEach((question: any) => {
          // Ensure each question has a comment property
          question.comment = question.comment || '';
          const questionPath = [this.selectedStakeholder.id, kpa.id, question.id].join('_');
          // Add the question answer control (if not already added)
          if (!this.responseForm.contains(questionPath)) {
            this.responseForm.addControl(questionPath, new FormControl(null, Validators.required));
          }
          // Add a separate control for the comment (if not already added)
          const commentControlKey = questionPath + '_comment';
          if (!this.responseForm.contains(commentControlKey)) {
            this.responseForm.addControl(commentControlKey, new FormControl(question.comment));
          }
          // Push the question data with its unique path into allQuestions
          this.allQuestions.push({
            stakeholderName: this.selectedStakeholder.name,
            kpaName: kpa.name,
            kpaId: kpa.id,
            question: question,
            questionFullPath: questionPath,
          });
        });
      });
    }
  }
  

  filterKpasAndGoNext(): void {
    this.animationState = 'leave';
    // Get the selected KPAs
    const selectedKpas = this.responseForm.get('selectedKpas') as FormGroup;
    const selectedKpaIds = Object.keys(selectedKpas.controls).filter(kpaId => selectedKpas.get(kpaId)?.value);
    // Remove questions related to unselected KPAs from the responseForm
    this.selectedStakeholder.kpas.forEach((kpa: any) => {
      if (!selectedKpaIds.includes(kpa.id)) {
        kpa.questions.forEach((question: any) => {
          const questionPath = [this.selectedStakeholder.id, kpa.id, question.id].join('_');
          if (this.responseForm.contains(questionPath)) {
            this.responseForm.removeControl(questionPath); // Remove unselected question controls
          }
        });
      }
    });
    // Filter `allQuestions` to only include questions from selected KPAs
    this.allQuestions = this.allQuestions.filter((question: any) => selectedKpaIds.includes(question.kpaId));
    // Move to the next question or step
    setTimeout(() => {
      this.currentQuestionIndex++;
      if (this.allQuestions.length > 0) {
        this.currentControl = this.responseForm.controls[this.allQuestions[this.currentQuestionIndex].questionFullPath] as FormControl;
        this.currentCommentControl = this.responseForm.controls[this.allQuestions[this.currentQuestionIndex].questionFullPath + '_comment'] as FormControl;
      }
      this.animationState = 'enter';
    }, 200); // Match the animation duration
  }

  goToNextQuestion(): void {
    this.animationState = 'leave';
    setTimeout(() => {
      this.currentQuestionIndex++;
      const currentQuestion = this.allQuestions[this.currentQuestionIndex];
      const questionPath = currentQuestion.questionFullPath;
      this.currentControl = this.responseForm.get(questionPath) as FormControl;
      this.currentCommentControl = this.responseForm.get(questionPath + '_comment') as FormControl;
      this.animationState = 'enter';
    }, 200);
  }
  
  goToPreviousQuestion(): void {
    this.animationState = 'leave';
    setTimeout(() => {
      this.currentQuestionIndex--;
      const currentQuestion = this.allQuestions[this.currentQuestionIndex];
      const questionPath = currentQuestion.questionFullPath;
      this.currentControl = this.responseForm.get(questionPath) as FormControl;
      this.currentCommentControl = this.responseForm.get(questionPath + '_comment') as FormControl;
      this.animationState = 'enter';
    }, 200);
  }
  
  startOver(): void {
    this.currentQuestionIndex = -3;
    // reset all responses
    this.responseForm.reset();
    this.currentKpas = [];
    this.selectedStakeholder = null;
    this.allQuestions = [];
    this.initializeForm();
  }

  uploadSpecification(event: any) {
    if (event.target.files.length !== 1) {
      console.error('No file selected');
    } else {
      const reader = new FileReader();
      reader.onloadend = (e) => {
        if (reader.result) {
          const uploadedVersion = JSON.parse(reader.result?.toString());
          this.initializeForm(uploadedVersion);
        }
      };
      reader.readAsText(event.target.files[0]);
    }
  }

  downloadSpecification(): void {
    const dataStr = JSON.stringify(this.maturityQuestions, null, 2); // Format JSON with 2-space indentation
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
    const exportFileDefaultName = 'maturity_specification.json';
  
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  submitStakeholderResponses(): void {
    this.timestampControl.setValue(new Date().toISOString());
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

  getKpas(stakeholderName: string): any[] {
    // return an array of KPA objects for the given stakeholder
    const stakeholder = this.getStakeHolder(stakeholderName);
    return stakeholder.kpas;
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

  /**
   * Saves the current assessment to Firebase (Expo mode only)
   */
  async saveToFirebase(): Promise<void> {
    if (!this.expoMode) {
      return;
    }

    if (!this.results) {
      return;
    }

    try {
      // Convert scores from 0-100 scale to 0-5 scale for display consistency
      const convertToFiveScale = (value: number): number => {
        return Math.round((value / 100) * 5 * 100) / 100; // Round to 2 decimal places
      };

      const currentState = {
        selectedStakeholder: this.responseForm.get('selectedStakeholder')?.value,
        selectedKpas: this.responseForm.get('selectedKpas')?.value,
        responses: this.responseForm.value,
        name: this.nameControl.value,
        author: this.authorControl.value,
        timestamp: this.timestampControl.value,
        systemName: this.systemNameControl.value,
        location: this.locationControl.value,
        allQuestions: this.allQuestions,
        // Raw scores (0-100 scale) - for internal calculations and utilities
        overallScore: this.results.overallAverage,
        kpasScores: this.results.kpaAverages,
        // Normalized scores (0-5 scale) - for display and user-facing features
        overallScoreNormalized: convertToFiveScale(this.results.overallAverage),
        kpasScoresNormalized: Object.fromEntries(
          Object.entries(this.results.kpaAverages).map(([key, value]) => [key, convertToFiveScale(value)])
        ),
        level: this.results.level
      };

      
      // Create a clean data structure for Firebase (remove problematic nested arrays)
      const firebaseData: MaturityAssessmentResult = {
        selectedStakeholder: currentState.selectedStakeholder,
        selectedKpas: currentState.selectedKpas,
        name: currentState.name || '',
        author: currentState.author || '',
        timestamp: currentState.timestamp || new Date().toISOString(),
        systemName: currentState.systemName || '',
        // Remove allQuestions array as it contains nested arrays that Firebase doesn't support
        // allQuestions: [], // Commented out to avoid nested array error
        // Raw scores (0-100 scale) - for internal calculations and utilities
        overallScore: currentState.overallScore || 0,
        kpasScores: currentState.kpasScores || {},
        // Normalized scores (0-5 scale) - for display and user-facing features
        overallScoreNormalized: currentState.overallScoreNormalized || 0,
        kpasScoresNormalized: currentState.kpasScoresNormalized || {},
        level: currentState.level || '',
        // Include only the essential question responses (these should be simple values)
        ...currentState.responses,
        // Override location after spread to ensure clean version is used (no nested arrays)
        location: currentState.location ? {
          x: currentState.location.x,
          y: currentState.location.y,
          label: currentState.location.label,
          country: currentState.location.raw?.address?.country || null,
          countryCode: currentState.location.raw?.address?.country_code || null,
          placeName: currentState.location.raw?.name || null,
          placeId: currentState.location.raw?.place_id || null
        } : null
      };

      await this.firebaseService.addMaturityAssessmentResult(firebaseData, 'Expo 2025');
      
      // Show success message to user
      alert('Assessment successfully saved to Expo 2025 database!');
      
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      alert('Failed to save assessment to Expo 2025 database. Please try again.');
    }
  }

  /**
   * Saves the current form state (including stakeholder, selectedKpas, and question responses)
   * as a JSON file.
   */
  async saveState(): Promise<void> {
    // Convert scores from 0-100 scale to 0-5 scale for display consistency
    const convertToFiveScale = (value: number): number => {
      return Math.round((value / 100) * 5 * 100) / 100; // Round to 2 decimal places
    };

    const currentState = {
      selectedStakeholder: this.responseForm.get('selectedStakeholder')?.value,
      selectedKpas: this.responseForm.get('selectedKpas')?.value,
      responses: this.responseForm.value, // includes question responses
      currentQuestionIndex: this.currentQuestionIndex,
      currentControl: this.currentControl?.value,
      animationState: this.animationState,
      name: this.nameControl.value,
      author: this.authorControl.value,
      timestamp: this.timestampControl.value,
      systemName: this.systemNameControl.value,
      location: this.locationControl.value,
      allQuestions: this.allQuestions,
      // Raw scores (0-100 scale) - for internal calculations and utilities
      overallScore: this.results?.overallAverage || 0,
      kpasScores: this.results?.kpaAverages || {},
      // Normalized scores (0-5 scale) - for display and user-facing features
      overallScoreNormalized: this.results?.overallAverage ? convertToFiveScale(this.results.overallAverage) : 0,
      kpasScoresNormalized: this.results?.kpaAverages ? Object.fromEntries(
        Object.entries(this.results.kpaAverages).map(([key, value]) => [key, convertToFiveScale(value)])
      ) : {},
      level: this.results?.level
    };


    // Download local file
    const blob = new Blob([JSON.stringify(currentState)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = this.expoMode ? 'expo-maturity-assessment-results.json' : 'maturity-assessment-results.json';
    link.click();
  }

  /**
   * Load a previously saved JSON state, re-initialize the form to match it.
   */
  loadState(event: any): void {
    if (event.target.files.length !== 1) {
      console.error('No file selected');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (!reader.result) {
        console.error('FileReader result is empty');
        return;
      }

      const uploadedState = JSON.parse(reader.result.toString());

      // 1) Reset everything
      this.responseForm.reset();
      this.currentQuestionIndex = -3;
      this.allQuestions = [];
      this.selectedStakeholder = null;
      this.currentKpas = [];

      // 2) Re-initialize the form (creates universal controls + all Q controls)
      //    preserving any updated .json in `this.maturityQuestions`
      this.initializeForm().then(() => {
        // 3) Restore meta fields
        this.nameControl.setValue(uploadedState.name);
        this.authorControl.setValue(uploadedState.author);
        this.timestampControl.setValue(uploadedState.timestamp);
        this.systemNameControl.setValue(uploadedState.systemName);
        this.locationControl.setValue(uploadedState.location);

        // 4) Set stakeholder & selectedKpas
        const stakeholderId = uploadedState.selectedStakeholder;
        const selectedKpasValue = uploadedState.selectedKpas || {};

        this.responseForm.get('selectedStakeholder')?.setValue(stakeholderId);

        // Build the KPA group that was saved
        const kpaGroup = this.fb.group({});
        const stakeHolderData = this.getStakeHolder(stakeholderId);
        this.selectedStakeholder = stakeHolderData;

        if (stakeHolderData?.kpas) {
          stakeHolderData.kpas.forEach((kpa: any) => {
            kpaGroup.addControl(
              kpa.id,
              this.fb.control(!!selectedKpasValue[kpa.id]) // true or false
            );
          });
        }
        this.responseForm.setControl('selectedKpas', kpaGroup);

        // 5) Re-add question controls for the chosen stakeholder
        if (this.selectedStakeholder?.kpas) {
          this.selectedStakeholder.kpas.forEach((kpa: any) => {
            kpa.questions.forEach((question: any) => {
              const questionPath = [
                this.selectedStakeholder.id,
                kpa.id,
                question.id
              ].join('_');
              // Only add if it doesn't exist
              if (!this.responseForm.contains(questionPath)) {
                this.responseForm.addControl(
                  questionPath,
                  new FormControl(null, Validators.required)
                );
              }
            });
          });
        }

        // 6) Remove controls for KPA that were *not* selected
        const selectedKpaIds = Object.keys(selectedKpasValue).filter(kpaId => selectedKpasValue[kpaId]);
        if (this.selectedStakeholder?.kpas) {
          this.selectedStakeholder.kpas.forEach((kpa: any) => {
            if (!selectedKpaIds.includes(kpa.id)) {
              kpa.questions.forEach((question: any) => {
                const questionPath = [
                  this.selectedStakeholder.id,
                  kpa.id,
                  question.id
                ].join('_');
                if (this.responseForm.contains(questionPath)) {
                  this.responseForm.removeControl(questionPath);
                }
              });
            }
          });
        }

        // 7) Flatten the final questions + filter out unselected KPA
        this.flattenQuestions();
        this.allQuestions = this.allQuestions.filter(q => selectedKpaIds.includes(q.kpaId));

        // 8) Restore each question's answer
        const responses = uploadedState.responses || {};
        Object.keys(responses).forEach(questionPath => {
          if (this.responseForm.contains(questionPath)) {
            this.responseForm.controls[questionPath].setValue(responses[questionPath]);
          }
        });

        // 9) Finally, restore the question index + animation + current control
        this.currentQuestionIndex = uploadedState.currentQuestionIndex || -3;
        this.animationState = uploadedState.animationState || 'enter';

        // if (this.allQuestions[this.currentQuestionIndex]) {
        //   const currentQPath = this.allQuestions[this.currentQuestionIndex].questionFullPath;
        //   this.currentControl = this.responseForm.get(currentQPath) as FormControl;
        // } else {
        //   // If there's no valid question index, default back to stakeholder selection
        //   this.currentControl = this.responseForm.get('selectedStakeholder') as FormControl;
        // }

      });
    };

    reader.readAsText(event.target.files[0]);
  }

  downloadPdf(): void {
    // 1) Reference the element you want to capture
    const dataElement = document.getElementById('pdfReport');
    if (!dataElement) {
      console.error('Could not find the pdfReport element.');
      return;
    }

    dataElement.classList.add('pdf-mode');
    // 2) Use html2canvas to render it into a canvas
    setTimeout(() => {
      html2canvas(dataElement, { scale: 2 }).then(canvas => {
        // scale: 2 for better clarity (higher resolution) if desired

        // 3) Convert the canvas to an image
        const contentDataURL = canvas.toDataURL('image/png');

        // 4) Create a jsPDF instance (A4 page, landscape mode)
        const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // 5) Calculate the image dimensions while maintaining aspect ratio
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = Math.min(pageWidth / canvasWidth, pageHeight / canvasHeight);
        const imgWidth = canvasWidth * ratio;
        const imgHeight = canvasHeight * ratio;

        // 6) Compute X and Y coordinates to center the image
        const xPos = (pageWidth - imgWidth) / 2;  // Center horizontally
        const yPos = (pageHeight - imgHeight) / 2; // Center vertically

        // 7) Add the image centered on the page
        pdf.addImage(contentDataURL, 'PNG', xPos, yPos, imgWidth, imgHeight);

        // FOOTNOTE: Add some text at the bottom
        const footnote = 'Generated using the SNOMED International Maturity Assessment Tool';
        pdf.setFontSize(10); // optional, make the footnote smaller
        pdf.text(
          footnote,
          pageWidth / 2,          // X position: half the page width → center
          pageHeight - 10,        // Y position: 10mm from bottom
          { align: 'center' }
        );

        // 8) Save/download the PDF
        pdf.save('maturity-report.pdf');

      }).catch(error => {
        console.error('Could not generate PDF', error);
      });
      dataElement.classList.remove('pdf-mode');
    }, 1000); // Wait for the DOM to update before capturing
  }
  
} 
