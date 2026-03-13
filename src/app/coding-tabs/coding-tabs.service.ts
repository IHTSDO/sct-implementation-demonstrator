import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { BindingSpec, CodingTabSpec } from './coding-tabs.models';

@Injectable({
  providedIn: 'root'
})
export class CodingTabsService {

  constructor(private http: HttpClient) { }

  loadSpecs(specPaths: string[]): Observable<CodingTabSpec[]> {
    if (!specPaths.length) {
      return of([]);
    }

    return forkJoin(
      specPaths.map(path =>
        this.http.get<CodingTabSpec>(path).pipe(
          map(spec => this.normalizeSpec(spec))
        )
      )
    );
  }

  normalizeSpecs(specs: CodingTabSpec[]): CodingTabSpec[] {
    return specs.map(spec => this.normalizeSpec(spec));
  }

  normalizeSpec(spec: CodingTabSpec): CodingTabSpec {
    return {
      ...spec,
      description: spec?.description || '',
      bindings: (spec?.bindings || []).map(binding => this.normalizeBinding(binding))
    };
  }

  private normalizeBinding(binding: BindingSpec): BindingSpec {
    return {
      ...binding,
      type: this.normalizeBindingType(binding?.type),
      repeatable: binding?.repeatable ?? false,
      count: binding?.count ?? 1
    };
  }

  private normalizeBindingType(type: string | undefined): string {
    const normalizedType = (type || '').trim().toLowerCase();
    switch (normalizedType) {
      case 'autocomplete':
        return 'Autocomplete';
      case 'select':
      case 'select (single)':
        return 'Select (Single)';
      case 'select (multiple)':
        return 'Select (Multiple)';
      case 'textbox':
      case 'text box':
        return 'Text box';
      default:
        return type || '';
    }
  }
}
