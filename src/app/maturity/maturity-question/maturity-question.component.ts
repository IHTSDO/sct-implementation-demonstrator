import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-maturity-question',
  templateUrl: './maturity-question.component.html',
  styleUrls: ['./maturity-question.component.css']
})
export class MaturityQuestionComponent {

  @Input() metric: any;


  constructor() { }


}
