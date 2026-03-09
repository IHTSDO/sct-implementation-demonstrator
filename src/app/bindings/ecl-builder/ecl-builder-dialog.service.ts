import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EclBuilderDialogComponent } from '../ecl-builder-dialog/ecl-builder-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class EclBuilderDialogService {
  constructor(private dialog: MatDialog) {}

  open(initialEcl = ''): Observable<string | null> {
    return this.dialog.open(EclBuilderDialogComponent, {
      data: { ecl: initialEcl },
      width: '80%',
      height: '80%'
    }).afterClosed().pipe(
      map((result: string | undefined) => result ?? null)
    );
  }
}
