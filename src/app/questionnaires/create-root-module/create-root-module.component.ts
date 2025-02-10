import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup } from '@angular/forms';
import { FhirService } from 'src/app/services/fhir.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-create-root-module',
    templateUrl: './create-root-module.component.html',
    styleUrls: ['./create-root-module.component.css'],
    standalone: false
})
export class CreateRootModuleComponent {

  questionnaireForm!: FormGroup;
  allQuestionnaires: any[] = []; // Holds all questionnaires
  availableQuestionnaires: any[] = [];
  addedQuestionnaires: any[] = [];
  userTag: string = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private fhirService: FhirService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<CreateRootModuleComponent>
  ) {}

  ngOnInit() {
    this.questionnaireForm = this.fb.group({
      selectedQuestionnaire: [{value: '', disabled: true}],
      assignedName: [{value: '', disabled: true}]
    });
    if (this.data) {
      this.addedQuestionnaires = this.data.questionnaires;
      this.questionnaireForm.get('assignedName')?.setValue(this.data.title);
    }
    this.questionnaireForm.get('selectedQuestionnaire')
    this.userTag = this.fhirService.getUserTag();

    this.loadAvailableQuestionnaires();
  }

  updateAvailableQuestionnaires() {
    if (this.addedQuestionnaires) {
      this.availableQuestionnaires = this.allQuestionnaires.filter(q => 
        !this.addedQuestionnaires.some(addedQ => addedQ.id === q.id));
    } else {
      this.availableQuestionnaires = this.allQuestionnaires;
    }
    // remove questionnaires that have an assembly exptantion equals to root
    this.availableQuestionnaires = this.availableQuestionnaires.filter(q => 
      !q.extension || !q.extension.some((ext: any) => ext.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-assemble-expectation' && ext.valueCode === 'assemble-root'));
  }

  loadAvailableQuestionnaires() {
    this.loading = true;
    this.fhirService.getQuestionnairesByTag(this.userTag).subscribe((data: any) => {
      this.allQuestionnaires = data['entry'].map((entry: any) => entry.resource);
      this.allQuestionnaires.sort((a, b) => a.title.localeCompare(b.title));
      this.updateAvailableQuestionnaires();
      this.loading = false;
      this.questionnaireForm?.get('selectedQuestionnaire')?.enable();
      this.questionnaireForm?.get('assignedName')?.enable();
    });
  }

  addQuestionnaire() {
    const formValue = this.questionnaireForm.value;
    if (formValue.selectedQuestionnaire) {
      this.addedQuestionnaires.push({
        ...formValue.selectedQuestionnaire,
        assignedName: formValue.assignedName
      });
      this.questionnaireForm.get('selectedQuestionnaire')?.reset();
      this.updateAvailableQuestionnaires();
    }
  }

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.addedQuestionnaires, event.previousIndex, event.currentIndex);
  }

  deleteQuestionnaire(index: number) {
    if (index > -1) {
      this.addedQuestionnaires.splice(index, 1);
      this.updateAvailableQuestionnaires();
    }
  }

  isSaveDisabled(): boolean {
    return (!this.questionnaireForm.get('assignedName')?.value || !this.addedQuestionnaires.length);
  }

  closeModal() {
    this.dialogRef.close({ title: this.questionnaireForm.get('assignedName')?.value, questionnaires: this.addedQuestionnaires } );
  }

}
