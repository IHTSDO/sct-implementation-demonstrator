import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ExternalService {

  private tokenEndpoint = 'https://icdaccessmanagement.who.int/connect/token';
  private clientId = '...'; // replace with your clientId
  private clientSecret = '...'; // replace with your clientSecret
  private scope = 'icdapi_access';

  constructor(private http: HttpClient) {}

  public updateCredentials(clientId: string, clientSecret: string): void {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private getAccessToken(): Observable<string> {
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('scope', this.scope);

    const authHeader = btoa(`${this.clientId}:${this.clientSecret}`);
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    });

    return this.http.post<any>(this.tokenEndpoint, body.toString(), { headers }).pipe(
      map(response => response.access_token),
      catchError(error => {
        console.error('Error fetching access token', error);
        return of(''); // return an empty string in case of an error
      })
    );
  }

  public getICDEntity(): Observable<any> {
    return this.getAccessToken().pipe(
      switchMap(token => {
        if (!token) {
          return of(null); // handle the case where the token couldn't be fetched
        }

        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json, application/ld+json',
          'Accept-Language': 'en',
          'API-Version': 'v2'
        });

        return this.http.get('https://id.who.int/icd/entity', { headers });
      }),
      catchError(error => {
        console.error('Error fetching ICD entity', error);
        return of(null); // return null in case of an error
      })
    );
  }

  public searchICDf(query: string, highlighting: boolean): Observable<any> {
    return this.getAccessToken().pipe(
      switchMap(token => {
        if (!token) {
          return of([]); // handle the case where the token couldn't be fetched
        }

        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json, application/ld+json',
          'Accept-Language': 'en',
          'API-Version': 'v2'
        });

        return this.http.get(`https://id.who.int/icd/entity/search?q=${query}&useFlexisearch=false&flatResults=true&highlightingEnabled=${highlighting}`, { headers });
      }),
      catchError(error => {
        console.error('Error searching ICD', error);
        return of([]); // return an empty array in case of an error
      })
    );
  }
}
