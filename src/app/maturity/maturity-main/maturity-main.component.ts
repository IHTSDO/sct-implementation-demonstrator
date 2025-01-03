import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';

interface MaturityResponse {
  [goalIndex: string]: {
    components: {
      [componentName: string]: {
        [metricName: string]: string; // Assuming the response is a string corresponding to the value of the radio button
      };
    };
  };
}

@Component({
  selector: 'app-maturity-main',
  templateUrl: './maturity-main.component.html',
  styleUrl: './maturity-main.component.css'
})
export class MaturityMainComponent implements OnInit {
  
  maturityQuestions: any = {};

  constructor(private http: HttpClient) { }

  async ngOnInit() {
    console.log('Fetching maturity questions...');
    this.maturityQuestions = await lastValueFrom(this.http.get('assets/maturity/maturityLevels.json'));
    console.log('Fetched maturity questions:', this.maturityQuestions);
  }

  uploadFile(event: any) {
    if (event.target.files.length !== 1) {
      console.error('No file selected');
    } else {
      const reader = new FileReader();
      reader.onloadend = (e) => {
        if (reader.result) {
          const uploadedVersion = JSON.parse(reader.result?.toString());
          console.log('Uploaded version:', uploadedVersion);
          this.maturityQuestions = uploadedVersion;
        }
      };
      reader.readAsText(event.target.files[0]);
    }
  }
} 
