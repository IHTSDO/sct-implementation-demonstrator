import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';

@Component({
    selector: 'app-ncpt',
    templateUrl: './ncpt.component.html',
    styleUrl: './ncpt.component.css',
    standalone: false
})
export class NcptComponent implements OnInit {

  emptySpec: any = {};
  specs = [
    { specFile: "Nutrition Assessment.json", spec: this.emptySpec },
    { specFile: "Nutrition Diagnosis.json", spec: this.emptySpec },
    { specFile: "NCPT_Intervention_form.json", spec: this.emptySpec },
  ];

  constructor(private http: HttpClient) { }
  
  ngOnInit() {
    this.specs.forEach(async (spec) => {
      const data: any = await lastValueFrom(this.http.get('assets/specs/ncpt/' + spec.specFile));
      spec.spec = data;
    });
  }

}
