import { Component, ViewChild } from '@angular/core';
import { AllergiesProblemListComponent } from './allergies-problem-list/allergies-problem-list.component';

@Component({
  selector: 'app-allergies',
  templateUrl: './allergies.component.html',
  styleUrls: ['./allergies.component.css']
})

export class AllergiesComponent {

  @ViewChild(AllergiesProblemListComponent) allergiesProblemListComponent!: AllergiesProblemListComponent;

  constructor() { }

  async addProblem(problem?: any) {
    this.allergiesProblemListComponent.addProblem(problem);
  }

}
