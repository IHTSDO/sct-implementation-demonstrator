import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import { MaturityResultsDialogComponent } from '../maturity-results-dialog';

@Component({
  selector: 'app-maturity-main',
  templateUrl: './maturity-main.component.html',
  styleUrl: './maturity-main.component.css'
})
export class MaturityMainComponent implements OnInit {
  
  maturityQuestions: any = {};
  responseForm: FormGroup;


  constructor(private http: HttpClient, private fb: FormBuilder, private dialog: MatDialog) {
    this.responseForm = this.fb.group({});
  }

  async ngOnInit() {
    this.maturityQuestions = await lastValueFrom(this.http.get('assets/maturity/maturityLevels.json'));
    this.initializeForm();
  }

  private initializeForm(): void {
    this.maturityQuestions.stakeHolders.forEach((stakeholder: any) => {
      const stakeholderGroup = this.fb.group({});
      stakeholder.kpas.forEach((kpa: any) => {
        const kpaGroup = this.fb.group({});
        kpa.questions.forEach((question: any) => {
          kpaGroup.addControl(
            question.name,
            new FormControl(null, Validators.required)
          );
        });
        stakeholderGroup.addControl(kpa.name, kpaGroup);
      });
      this.responseForm.addControl(stakeholder.name, stakeholderGroup);
    });
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

  submitStakeholderResponses(stakeholderName: string): void {
    const stakeholderResponses = this.responseForm.get(stakeholderName)?.value;
    if (stakeholderResponses) {
      console.log(`Responses for ${stakeholderName}:`, stakeholderResponses);
      // Add your logic to send or process stakeholder responses

      this.dialog.open(MaturityResultsDialogComponent, {
        width: '1600px',
        data: { maturityResponse: stakeholderResponses }
      });
    }
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
