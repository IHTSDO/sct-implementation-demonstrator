import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';

@Injectable({
  providedIn: 'root'
})
export class LoincGrouperCacheService {
  readonly grouperEcl = `<< 363787002 |Observable entity (observable entity)| :
[1..1] 370130000 |Property (attribute)| = *,
[1..1] 704327008 |Direct site (attribute)|  = *,
[1..1] 246093002 |Component (attribute)|  = *,
[0..0] 370132008 |Scale type (attribute)| = *,
[0..0] 370134009 |Time aspect (attribute)| = *`;
  readonly grouperCountLimit = 3000;

  private grouperSetsByEdition = new Map<string, Set<string>>();
  private grouperRequestsByEdition = new Map<string, Observable<Set<string>>>();

  constructor(private terminologyService: TerminologyService) {}

  warmGroupers(fhirBase: string, editionVersion: string): Observable<Set<string>> {
    const cachedGroupers = this.grouperSetsByEdition.get(editionVersion);
    if (cachedGroupers) {
      return of(cachedGroupers);
    }

    const inFlightRequest = this.grouperRequestsByEdition.get(editionVersion);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.terminologyService.expandValueSetFromServer(
      fhirBase,
      editionVersion,
      this.grouperEcl,
      '',
      0,
      this.grouperCountLimit
    ).pipe(
      map((response: any) => {
        const contains = response?.expansion?.contains || [];
        return new Set<string>(contains.map((concept: any) => concept.code));
      }),
      tap((grouperSet) => {
        this.grouperSetsByEdition.set(editionVersion, grouperSet);
      }),
      catchError(() => {
        this.grouperRequestsByEdition.delete(editionVersion);
        return of(new Set<string>());
      }),
      shareReplay(1)
    );

    this.grouperRequestsByEdition.set(editionVersion, request);
    return request;
  }

  isGrouper(editionVersion: string, conceptCode: string): boolean {
    return this.grouperSetsByEdition.get(editionVersion)?.has(conceptCode) || false;
  }
}
