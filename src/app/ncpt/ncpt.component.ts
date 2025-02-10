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
    { specFile: "Example-spec.json", spec: this.emptySpec },
    { specFile: "Example-spec-2.json", spec: this.emptySpec },
  ];

  constructor(private http: HttpClient) { }
  
  ngOnInit() {
    this.specs.forEach(async (spec) => {
      const data: any = await lastValueFrom(this.http.get('assets/specs/ncpt/' + spec.specFile));
      console.log(data);
      spec.spec = data;
    });
  }

}
