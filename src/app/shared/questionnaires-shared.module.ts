import { NgModule } from '@angular/core';
import { ConfirmationDialogComponent } from '../questionnaires/confirmation-dialog/confirmation-dialog.component';
import { AppMaterialModule } from './app-material.module';

@NgModule({
  declarations: [ConfirmationDialogComponent],
  imports: [AppMaterialModule],
  exports: [ConfirmationDialogComponent],
})
export class QuestionnairesSharedModule {}
