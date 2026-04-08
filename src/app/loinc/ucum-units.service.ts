import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';

export type UcumUnit = {
  code: string;
  display: string;
  system: string;
};

@Injectable({
  providedIn: 'root'
})
export class UcumUnitsService {
  private units$?: Observable<UcumUnit[]>;

  constructor(private http: HttpClient) {}

  getUnits(): Observable<UcumUnit[]> {
    if (!this.units$) {
      this.units$ = this.http.get<any>('assets/data/ucum-units.json').pipe(
        map((response) => {
          const units = (response?.expansion?.contains || []).map((item: any) => ({
            code: item.code || '',
            display: item.display || item.code || '',
            system: item.system || 'http://unitsofmeasure.org'
          }));

          return units.sort((a: UcumUnit, b: UcumUnit) => a.display.localeCompare(b.display));
        }),
        shareReplay(1)
      );
    }

    return this.units$;
  }
}
