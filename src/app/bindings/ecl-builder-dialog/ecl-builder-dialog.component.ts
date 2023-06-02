import { Component, Inject } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-ecl-builder-dialog',
  templateUrl: './ecl-builder-dialog.component.html',
  styleUrls: ['./ecl-builder-dialog.component.css']
})

export class EclBuilderDialogComponent {
  localEcl = '';
  constructor(
    public dialogRef: MatDialogRef<EclBuilderDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.localEcl = data.ecl;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  eclChanged(event: any) {
    // this.localEcl = event?.detail[0];
    // this.data.ecl = event?.detail[0];
  }
}
