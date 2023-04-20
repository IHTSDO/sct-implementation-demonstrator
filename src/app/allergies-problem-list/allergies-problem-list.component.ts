import { DataSource } from '@angular/cdk/collections';
import { Component } from '@angular/core';
import { ReplaySubject, Observable } from 'rxjs';

const ELEMENT_DATA: any[] = [];

@Component({
  selector: 'app-allergies-problem-list',
  templateUrl: './allergies-problem-list.component.html',
  styleUrls: ['./allergies-problem-list.component.css']
})
export class AllergiesProblemListComponent {
  eclProblem = '< 404684003 |Clinical finding|';
  selectedProblemSct: any;
  term: string = '';
  displayedColumns: string[] = ['icon', 'code', 'display'];
  dataToDisplay = [...ELEMENT_DATA];
  dataSource = new ExampleDataSource(this.dataToDisplay);

  async updateProblem(event: any) {
    this.selectedProblemSct = event;
  }

  addProblem() {
    // push selectedProblemSct in problemList if it is not already present ion the list
    if (this.selectedProblemSct) {
      this.selectedProblemSct.date = new Date();
      if (!this.dataToDisplay.find((x) => x.code === this.selectedProblemSct.code)) {
        this.dataToDisplay = [...this.dataToDisplay, this.selectedProblemSct];
        this.dataSource.setData(this.dataToDisplay);
      }
    }
  }
}

class ExampleDataSource extends DataSource<any> {
  private _dataStream = new ReplaySubject<any[]>();

  constructor(initialData: any[]) {
    super();
    this.setData(initialData);
  }

  connect(): Observable<any[]> {
    return this._dataStream;
  }

  disconnect() {}

  setData(data: any[]) {
    this._dataStream.next(data);
  }
}