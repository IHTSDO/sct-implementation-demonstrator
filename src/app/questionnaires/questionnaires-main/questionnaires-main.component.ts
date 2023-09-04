import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
// const LFormsUtil: any = (window as any).LForms.Util;

@Component({
  selector: 'app-questionnaires-main',
  templateUrl: './questionnaires-main.component.html',
  styleUrls: ['./questionnaires-main.component.css']
})
export class QuestionnairesMainComponent implements OnInit{

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    lastValueFrom(this.http.get('/assets/questionnaires/Carcinoma-of-the-Exocrine-Pancreas-Histopathology-Reporting-Form.R4 (11).json')).then(data => {
      console.log('Data: ', data);
      // var nativeForm = LFormsUtil.convertFHIRQuestionnaireToLForms(data, "R4")
      // console.log('QuestionnairesMainComponent.onInit() nativeForm: ', nativeForm);
    });
  }
}
