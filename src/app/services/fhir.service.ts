import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FhirService {
  private baseUrlSubject = new BehaviorSubject<string>('https://hapi.fhir.org/baseR4');
  baseUrl$ = this.baseUrlSubject.asObservable();

  private userTagSubject = new BehaviorSubject<string>('snomed-qtag');
  userTag$ = this.userTagSubject.asObservable();
  
  constructor(private http: HttpClient) {}

  setBaseUrl(url: string): void {
    this.baseUrlSubject.next(url);
  }

  getBaseUrl(): string {
    return this.baseUrlSubject.getValue();
  }

  setUserTag(tag: string): void {
    this.userTagSubject.next(tag);
  }

  getUserTag(): string {
    return this.userTagSubject.getValue();
  }

  // POST a questionnaire
  postQuestionnaire(questionnaire: any) {
    return this.http.post(`${this.baseUrlSubject.value}/Questionnaire`, questionnaire);
  }

  // Retrieve questionnaires by tag
  getQuestionnairesByTag(tag: string) {
    return this.http.get(`${this.baseUrlSubject.value}/Questionnaire?_tag=${tag}`);
  }

  tagQuestionnaire(id: string, tag: string) {
    return this.http.post(`${this.baseUrlSubject.value}/Questionnaire/${id}/$meta-add`, {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'meta',
          valueMeta: {
            tag: [
              {
                system: 'http://snomed.org/tags',
                code: tag
              }
            ]
          }
        }
      ]
    });
  }

  deleteQuestionnaire(id: string) {
    return this.http.delete(`${this.baseUrlSubject.value}/Questionnaire/${id}`);
  }

}
