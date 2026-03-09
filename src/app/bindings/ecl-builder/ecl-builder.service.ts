import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import {
  EclAttribute,
  EclConceptExpression,
  EclDomainAttribute,
  EclExpressionConstraint
} from './ecl-builder.models';

@Injectable({
  providedIn: 'root'
})
export class EclBuilderService {
  private readonly defaultBranch = 'MAIN/2023-01-31';

  constructor(
    private http: HttpClient,
    private terminologyService: TerminologyService
  ) {}

  stringToModel(eclString: string): Observable<EclExpressionConstraint> {
    const normalized = (eclString || '').trim();
    if (!normalized) {
      return of(this.transformIn({ wildcard: true, returnAllMemberFields: false }));
    }

    return this.http
      .post<any>(`${this.getSnowstormBaseUrl()}/util/ecl-string-to-model`, normalized, {
        headers: new HttpHeaders({
          'Content-Type': 'text/plain'
        }),
        responseType: 'json' as const
      })
      .pipe(map((model) => this.transformIn(model)));
  }

  modelToString(model: EclExpressionConstraint): Observable<string> {
    const clonedModel = this.deepClone(model);
    this.transformOut(clonedModel);

    return this.http
      .post<any>(`${this.getSnowstormBaseUrl()}/util/ecl-model-to-string`, clonedModel, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      })
      .pipe(map((response) => response?.eclString ?? ''));
  }

  getDomainAttributes(parentConceptId: string): Observable<EclDomainAttribute[]> {
    if (!parentConceptId) {
      return of([]);
    }

    const requestUrl =
      `${this.getSnowstormBaseUrl()}/mrcm/${encodeURIComponent(this.getBranch())}/domain-attributes` +
      `?proximalPrimitiveModeling=false&parentIds=${encodeURIComponent(parentConceptId)}`;

    return this.http
      .get<any>(requestUrl, {
        headers: new HttpHeaders({
          'Accept-Language': this.terminologyService.getComputedLanguageContext()
        })
      })
      .pipe(map((response) => response?.items ?? []));
  }

  getBranch(): string {
    return this.defaultBranch;
  }

  hasResolvedConcept(expression: EclConceptExpression | undefined | null): boolean {
    if (!expression) {
      return false;
    }

    if (expression.wildcard || expression.conceptId === '*') {
      return true;
    }

    const conceptId = this.extractConceptId(expression.conceptId);
    return /^\d+$/.test(conceptId);
  }

  isSupportedModel(model: EclExpressionConstraint): boolean {
    return this.collectUnsupportedFeatures(model).length === 0;
  }

  collectUnsupportedFeatures(model: EclExpressionConstraint): string[] {
    const unsupported = new Set<string>();
    this.scanUnsupported(model, unsupported);
    return Array.from(unsupported);
  }

  createEmptyExpression(wildcard = false): EclExpressionConstraint {
    return this.transformIn({
      wildcard,
      operator: wildcard ? undefined : 'descendantorselfof',
      conceptId: wildcard ? undefined : ''
    });
  }

  createEmptyAttribute(): EclAttribute {
    return this.transformIn({
      attributeName: {
        conceptId: '',
        operator: 'descendantorselfof'
      },
      expressionComparisonOperator: '=',
      value: {
        conceptId: '',
        operator: 'descendantorselfof'
      }
    });
  }

  addRefinement(model: EclExpressionConstraint): void {
    const source = this.deepClone(model);
    model.subexpressionConstraint = this.transformIn(source);
    delete model.subexpressionConstraint?.eclRefinement;
    delete model.subexpressionConstraint?.subexpressionConstraint;
    model.eclRefinement = {
      uiId: this.randomId(),
      subRefinement: {
        uiId: this.randomId(),
        eclAttributeSet: {
          uiId: this.randomId(),
          subAttributeSet: {
            uiId: this.randomId(),
            attribute: this.createEmptyAttribute()
          }
        }
      }
    };
    delete model.operator;
    delete model.conceptId;
    delete model.term;
    delete model.wildcard;
  }

  addCompoundConstraint(model: EclExpressionConstraint, type: 'conjunction' | 'disjunction'): void {
    const key = type === 'conjunction'
      ? 'conjunctionExpressionConstraints'
      : 'disjunctionExpressionConstraints';

    if (!model[key]) {
      model[key] = [];
      const currentFocus = this.extractFocusExpression(model);
      if (currentFocus) {
        model[key].push(currentFocus);
      }
      this.clearFocusExpression(model);
    }

    model[key].push(this.createEmptyExpression(false));
  }

  removeCompoundConstraint(model: EclExpressionConstraint, type: 'conjunction' | 'disjunction', index: number): void {
    const key = type === 'conjunction'
      ? 'conjunctionExpressionConstraints'
      : 'disjunctionExpressionConstraints';

    model[key]?.splice(index, 1);
    this.normalizeCompoundConstraints(model);
  }

  private scanUnsupported(model: any, unsupported: Set<string>): void {
    if (!model || typeof model !== 'object') {
      return;
    }

    if (model.exclusionExpressionConstraints?.first || model.exclusionExpressionConstraints?.second) {
      unsupported.add('exclusion expression constraints');
    }
    if (Array.isArray(model.eclRefinement?.disjunctionSubRefinements) && model.eclRefinement.disjunctionSubRefinements.length) {
      unsupported.add('disjunction refinements');
    }
    if (Array.isArray(model.disjunctionAttributeSet) && model.disjunctionAttributeSet.length) {
      unsupported.add('disjunction attribute sets');
    }
    if (model.numericComparisonOperator || model.stringComparisonOperator || model.booleanComparisonOperator) {
      unsupported.add('concrete domain attributes');
    }

    Object.values(model).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => this.scanUnsupported(item, unsupported));
      } else if (value && typeof value === 'object') {
        this.scanUnsupported(value, unsupported);
      }
    });
  }

  private getSnowstormBaseUrl(): string {
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    if (fhirBase.endsWith('/fhir')) {
      return fhirBase.replace(/\/fhir$/, '/snowstorm/snomed-ct');
    }
    return fhirBase.replace(/\/?$/, '/snowstorm/snomed-ct');
  }

  private transformIn<T>(model: T): T {
    const pattern = /^[0-9]+$/;
    const walk = (target: any): any => {
      if (!target || typeof target !== 'object') {
        return target;
      }

      Object.keys(target).forEach((prop) => {
        if (pattern.test(prop)) {
          return;
        }

        if (prop === 'wildcard' && target[prop] === true) {
          target.conceptId = '*';
        } else if (prop === 'term') {
          target.conceptId = `${target.conceptId} |${target.term}|`;
        } else if (prop === 'returnAllMemberFields') {
          delete target[prop];
          return;
        }

        const value = target[prop];
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item && typeof item === 'object' && !item.uiId) {
              item.uiId = this.randomId();
            }
            walk(item);
          });
        } else if (value && typeof value === 'object') {
          if (!value.uiId) {
            value.uiId = this.randomId();
          }
          walk(value);
        }
      });

      if (!target.uiId) {
        target.uiId = this.randomId();
      }

      return target;
    };

    return walk(model);
  }

  private transformOut(model: any): void {
    if (!model || typeof model !== 'object') {
      return;
    }

    Object.keys(model).forEach((prop) => {
      const value = model[prop];

      if (prop === 'uiId') {
        delete model[prop];
        return;
      }

      if (prop === 'operator' && value === '') {
        delete model[prop];
        return;
      }

      if (prop === 'conceptId' && typeof value === 'string') {
        const conceptId = value.trim();
        model.wildcard = conceptId === '*';
        if (model.wildcard) {
          delete model.conceptId;
          delete model.term;
        } else if (conceptId.includes('|')) {
          model.term = conceptId.substring(conceptId.indexOf('|') + 1).replace(/\|/g, '').trim();
          model.conceptId = conceptId.substring(0, conceptId.indexOf('|')).trim();
        } else {
          model.conceptId = conceptId;
        }
      }

      if (Array.isArray(value)) {
        value.forEach((item) => this.transformOut(item));
      } else if (value && typeof value === 'object') {
        this.transformOut(value);
      }
    });
  }

  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  private extractFocusExpression(model: EclExpressionConstraint): EclExpressionConstraint | null {
    const source = model.subexpressionConstraint ?? model;
    if (!source) {
      return null;
    }

    const extracted = this.deepClone(source);
    delete extracted.eclRefinement;
    delete extracted.conjunctionExpressionConstraints;
    delete extracted.disjunctionExpressionConstraints;
    delete extracted.exclusionExpressionConstraints;
    delete extracted.subexpressionConstraint;

    if (!this.hasResolvedConcept(extracted)) {
      return null;
    }

    return this.transformIn(extracted);
  }

  private clearFocusExpression(model: EclExpressionConstraint): void {
    delete model.operator;
    delete model.conceptId;
    delete model.term;
    delete model.wildcard;
    delete model.subexpressionConstraint;
  }

  private normalizeCompoundConstraints(model: EclExpressionConstraint): void {
    const conjunctions = model.conjunctionExpressionConstraints ?? [];
    const disjunctions = model.disjunctionExpressionConstraints ?? [];
    const total = conjunctions.length + disjunctions.length;

    if (total !== 1) {
      if (conjunctions.length === 0) {
        delete model.conjunctionExpressionConstraints;
      }
      if (disjunctions.length === 0) {
        delete model.disjunctionExpressionConstraints;
      }
      return;
    }

    const single = conjunctions[0] ?? disjunctions[0];
    if (!single) {
      return;
    }

    this.clearFocusExpression(model);
    model.operator = single.operator;
    model.conceptId = single.conceptId;
    model.term = single.term;
    model.wildcard = single.wildcard;
    model.nestedExpressionConstraint = single.nestedExpressionConstraint;
    delete model.conjunctionExpressionConstraints;
    delete model.disjunctionExpressionConstraints;
  }

  private extractConceptId(conceptIdAndTerm?: string): string {
    if (!conceptIdAndTerm) {
      return '';
    }

    if (conceptIdAndTerm.includes('|')) {
      return conceptIdAndTerm.substring(0, conceptIdAndTerm.indexOf('|')).trim();
    }

    return conceptIdAndTerm.trim();
  }

  private randomId(): string {
    return Math.random().toString(36).slice(2, 10);
  }
}
