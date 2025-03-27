import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { TerminologyService } from '../services/terminology.service';

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

  constructor(private http: HttpClient, private terminologyService: TerminologyService) { }
  
  ngOnInit() {
    this.terminologyService.fhirUrlParam$.subscribe(urlParam => {
      console.log('fhirUrlParam', urlParam);
      this.loadSpecs();
    });

    this.terminologyService.snowstormFhirBase$.subscribe(url => {
      console.log('snowstormFhirBase', url);
      this.loadSpecs();
    });

    this.terminologyService.lang$.subscribe(lang => {
      console.log('lang', lang);
      this.loadSpecs();
    });
  }

  loadSpecs() {
    this.specs.forEach(async (spec) => {
      spec.spec = this.emptySpec;
      const data: any = await lastValueFrom(this.http.get('assets/specs/ncpt/' + spec.specFile));
      spec.spec = data;
    });
  }


}
