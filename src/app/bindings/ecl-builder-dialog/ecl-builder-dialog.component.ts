import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
    selector: 'app-ecl-builder-dialog',
    templateUrl: './ecl-builder-dialog.component.html',
    styleUrls: ['./ecl-builder-dialog.component.css'],
    standalone: false
})

export class EclBuilderDialogComponent {
  localEcl = '';
  isValid = false;

  constructor(
    public dialogRef: MatDialogRef<EclBuilderDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {
    this.localEcl = data.ecl;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    this.dialogRef.close(this.localEcl);
  }

  eclChanged(ecl: string) {
    this.localEcl = ecl;
    this.data.ecl = ecl;
  }

  validityChanged(isValid: boolean) {
    this.isValid = isValid;
  }
}
