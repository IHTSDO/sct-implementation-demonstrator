import { Component, ViewChild } from '@angular/core';
import { AllergiesProblemListComponent } from './allergies-problem-list/allergies-problem-list.component';
import { SnackAlertComponent } from '../alerts/snack-alert';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-allergies',
  templateUrl: './allergies.component.html',
  styleUrls: ['./allergies.component.css']
})

export class AllergiesComponent {

  @ViewChild(AllergiesProblemListComponent) allergiesProblemListComponent!: AllergiesProblemListComponent;

  constructor(private _snackBar: MatSnackBar) { }

  async addProblem(problem?: any) {
    this.allergiesProblemListComponent.addProblem(problem);
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 1 * 1000,
      data: "Problem list updated",
      panelClass: ['green-snackbar']
    });
  }

}
