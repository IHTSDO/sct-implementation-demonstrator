import { DataSource } from '@angular/cdk/collections';
import { Component } from '@angular/core';
import { ReplaySubject, Observable, lastValueFrom, map } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';

const ELEMENT_DATA: any[] = [];
const ELEMENT_DATA2: any[] = [];


@Component({
  selector: 'app-allergies-problem-list',
  templateUrl: './allergies-problem-list.component.html',
  styleUrls: ['./allergies-problem-list.component.css']
})
export class AllergiesProblemListComponent {
  problemBinding = { ecl: '< 404684003 |Clinical finding|', title: 'Search...' };
  eclProblem = '< 404684003 |Clinical finding|';
  selectedProblemSct: any;
  term: string = '';
  displayedColumns: string[] = ['date', 'code', 'display'];
  dataToDisplay = [...ELEMENT_DATA];
  dataSource = new ExampleDataSource(this.dataToDisplay);
  loading = false;
  displayedColumns2: string[] = ['code', 'display'];
  dataToDisplay2 = [...ELEMENT_DATA2];
  dataSource2 = new ExampleDataSource2(this.dataToDisplay2);

  constructor(private terminologyService: TerminologyService) { }

  async updateProblem(event: any) {
    this.selectedProblemSct = event;
  }

  async addProblem() {
    // push selectedProblemSct in problemList if it is not already present ion the list
    if (this.selectedProblemSct) {
      this.loading = true;
      this.term = this.selectedProblemSct.display;
      this.selectedProblemSct.date = new Date();
      const allergyQueryResult: any = await this.getAllergyData();
      if (allergyQueryResult?.expansion?.contains?.length > 0) {
        this.selectedProblemSct.allergy = true;
        this.addAllergySubstanceToList(this.selectedProblemSct);
      }
      if (!this.dataToDisplay.find((x) => x.code === this.selectedProblemSct.code)) {
        this.dataToDisplay = [...this.dataToDisplay, this.selectedProblemSct];
        this.dataSource.setData(this.dataToDisplay);
      }
      this.loading = false;
      this.term = "";
    }
  }

  async addAllergySubstanceToList(allergy: any) {
    const res: any = await this.getAllergySubstance(allergy);
    res?.expansion?.contains?.forEach((element: any) => {
      if (!this.dataToDisplay2.find((x) => x.code === element.code)) {
        this.dataToDisplay2 = [...this.dataToDisplay2, element];
        this.dataSource2.setData(this.dataToDisplay2);
      }
    });
  }

  async getAllergyData(): Promise<any> {
    const response = await this.terminologyService.expandValueSet('<<473011001 |Allergic condition (finding)|', this.selectedProblemSct.code,0,1);
    return lastValueFrom(response.pipe(map(res => res)));
  }

  async getAllergySubstance(allergy: any): Promise<any> {
    const response = await this.terminologyService.expandValueSet(`${allergy.code} |${allergy.display}| . 246075003 |Causative agent (attribute)|`, '');
    return lastValueFrom(response.pipe(map(res => res)));
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

class ExampleDataSource2 extends DataSource<any> {
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