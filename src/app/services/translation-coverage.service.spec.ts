import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { TranslationCoverageService } from './translation-coverage.service';

describe('TranslationCoverageService', () => {
  let service: TranslationCoverageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        TranslationCoverageService,
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
        {
          provide: TranslocoService,
          useValue: jasmine.createSpyObj('TranslocoService', ['getActiveLang', 'load', 'translate'])
        },
      ],
    });

    service = TestBed.inject(TranslationCoverageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps matching route segments to the same scope', () => {
    expect(service.resolveScope('maturity')).toBe('maturity');
    expect(service.resolveScope('my-feature')).toBe('my-feature');
  });

  it('maps aliased route segments to their shared translation scope', () => {
    expect(service.resolveScope('ehr-lab')).toBe('benefits-demo');
    expect(service.resolveScope('descriptive-analytics')).toBe('descriptive-statistics');
  });

  it('extracts the first route segment and defaults the root route to home', () => {
    expect(service.getPrimaryRouteSegment('/ehr-lab/analytics?demo=true')).toBe('ehr-lab');
    expect(service.getPrimaryRouteSegment('/')).toBe('home');
  });

  it('reports translated coverage when the scope asset exists', () => {
    let result: boolean | undefined;
    service.hasTranslationAssets('benefits-demo', 'es').subscribe((hasAssets) => result = hasAssets);

    const request = httpMock.expectOne('assets/i18n/benefits-demo/benefits-demo-es.json');
    request.flush('{}');

    expect(result).toBeTrue();
  });

  it('reports untranslated coverage when the scope asset is missing', () => {
    let result: boolean | undefined;
    service.hasTranslationAssets('loinc', 'es').subscribe((hasAssets) => result = hasAssets);

    const request = httpMock.expectOne('assets/i18n/loinc/loinc-es.json');
    request.flush('Not found', { status: 404, statusText: 'Not Found' });

    expect(result).toBeFalse();
  });
});
