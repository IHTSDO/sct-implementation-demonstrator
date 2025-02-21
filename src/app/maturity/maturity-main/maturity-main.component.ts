import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { lastValueFrom, timestamp } from 'rxjs';
import { MaturityResultsDialogComponent } from '../maturity-results-dialog';
import { trigger, state, style, transition, animate } from '@angular/animations';
import cloneDeep from 'lodash/cloneDeep';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  selectedStakeholder: any = null;
  animationState = 'enter';
  currentKpas: any[] = [];

  constructor(private http: HttpClient, private fb: FormBuilder, private dialog: MatDialog) {
    this.responseForm = this.fb.group({
      selectedStakeholder: new FormControl(null, Validators.required), // Add stakeholder selection control
    });
    this.currentControl = this.responseForm.controls['selectedStakeholder'] as FormControl;
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
    this.nameControl = new FormControl(null);
    this.authorControl = new FormControl(null);
    this.timestampControl = new FormControl(new Date().toISOString());
    this.responseForm = this.fb.group({
      selectedStakeholder: new FormControl(null, Validators.required),
      name: this.nameControl,
      author: this.authorControl,
      timestamp: this.timestampControl,
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
      this.selectedStakeholder.kpas.forEach((kpa: any) => {
        kpaGroup.addControl(kpa.id, this.fb.control(true));
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
   * Saves the current form state (including stakeholder, selectedKpas, and question responses)
   * as a JSON file.
   */
  saveState(): void {
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
      allQuestions: this.allQuestions
    };

    const blob = new Blob([JSON.stringify(currentState)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'maturity-assessment-results.json';
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
