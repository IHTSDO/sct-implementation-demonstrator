import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { catchError, debounceTime, map, Observable, of, switchMap } from 'rxjs';
import { ExternalService } from 'src/app/services/external.service';

@Component({
    selector: 'app-icd-search',
    templateUrl: './icd-search.component.html',
    styleUrl: './icd-search.component.css',
    standalone: false
})
export class IcdSearchComponent {

  credentialsForm!: FormGroup;
  searchControl = new FormControl();
  filteredOptions: any[] = [];

  constructor(private fb: FormBuilder, private externalService: ExternalService) {}

  ngOnInit(): void {
    const clientId = localStorage.getItem('clientId');
    const clientSecret = localStorage.getItem('clientSecret');
    this.credentialsForm = this.fb.group({
      clientId: [clientId, Validators.required],
      clientSecret: [clientId, Validators.required]
    });

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300), // wait for the user to stop typing for 300ms
        switchMap((value: string) => this.searchICD(value))
      )
      .subscribe((results: any) => {
        this.filteredOptions = results?.['destinationEntities'] || [];
      });
  }

  submitCredentials(): void {
    if (this.credentialsForm.valid) {
      const clientId = this.credentialsForm.get('clientId')?.value;
      const clientSecret = this.credentialsForm.get('clientSecret')?.value;
      console.log('Client ID:', clientId);
      console.log('Client Secret:', clientSecret);

      localStorage.setItem('clientId', clientId);
      localStorage.setItem('clientSecret', clientSecret);
    }
  }

  searchICD(query: string): Observable<any> {
    return this.externalService.searchICDf(query, true).pipe(
      map((response: any) => {
        // Assuming the response has a structure where 'destinationEntities' is the array of results
        return response?.destinationEntities || [];
      }),
      catchError((error: any) => {
        console.error('Error during ICD search', error);
        return of([]); // Return an empty array in case of error
      })
    );
  }
  
}
