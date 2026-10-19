import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TerminologyService, SnomedReplacementConcept, ValidateCodeResult } from './terminology.service';

describe('TerminologyService validateCode', () => {
  let service: TerminologyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TerminologyService,
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open', 'openFromComponent']) },
      ],
    });

    service = TestBed.inject(TerminologyService);
    httpMock = TestBed.inject(HttpTestingController);

    const metadataReq = httpMock.expectOne('assets/language/national-language-metadata.json');
    metadataReq.flush({ editions: [] });

    service.snowstormFhirBase = 'https://example.org/fhir';
    service.fhirUrlParam = 'http://snomed.info/sct/900000000000207008/version/20260101';
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts validate-code with display parameter', () => {
    let result: ValidateCodeResult | undefined;

    service.validateCode('181216001', 'Entire lung (body structure)').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://example.org/fhir/CodeSystem/$validate-code');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      resourceType: 'Parameters',
      parameter: [
        { name: 'url', valueUri: 'http://snomed.info/sct' },
        { name: 'version', valueString: 'http://snomed.info/sct/900000000000207008/version/20260101' },
        { name: 'code', valueCode: '181216001' },
        { name: 'display', valueString: 'Entire lung (body structure)' },
      ],
    });

    req.flush({
      resourceType: 'Parameters',
      parameter: [
        { name: 'result', valueBoolean: true },
        { name: 'display', valueString: 'Entire lung (body structure)' },
      ],
    });

    expect(result).toEqual({
      result: true,
      inactive: undefined,
      message: undefined,
      display: 'Entire lung (body structure)',
    });
  });

  it('omits display parameter when display is blank', () => {
    service.validateCode('181216001', '   ').subscribe();

    const req = httpMock.expectOne('https://example.org/fhir/CodeSystem/$validate-code');
    expect(req.request.body.parameter).toEqual([
      { name: 'url', valueUri: 'http://snomed.info/sct' },
      { name: 'version', valueString: 'http://snomed.info/sct/900000000000207008/version/20260101' },
      { name: 'code', valueCode: '181216001' },
    ]);

    req.flush({
      resourceType: 'Parameters',
      parameter: [{ name: 'result', valueBoolean: true }],
    });
  });

  it('parses invalid validation responses with message', () => {
    let result: ValidateCodeResult | undefined;

    service.validateCode('123456789', 'Bad term').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://example.org/fhir/CodeSystem/$validate-code');
    req.flush({
      resourceType: 'Parameters',
      parameter: [
        { name: 'result', valueBoolean: false },
        { name: 'message', valueString: 'The display is incorrect' },
        { name: 'display', valueString: 'Correct term' },
      ],
    });

    expect(result).toEqual({
      result: false,
      inactive: undefined,
      message: 'The display is incorrect',
      display: 'Correct term',
    });
  });

  it('parses inactive flag from validate-code response', () => {
    let result: ValidateCodeResult | undefined;

    service.validateCode('181216001', 'Entire lung').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://example.org/fhir/CodeSystem/$validate-code');
    req.flush({
      resourceType: 'Parameters',
      parameter: [
        { name: 'result', valueBoolean: true },
        { name: 'display', valueString: 'Entire lung' },
        { name: 'inactive', valueBoolean: true },
        { name: 'system', valueString: 'http://snomed.info/sct' },
        { name: 'version', valueString: 'http://snomed.info/sct/900000000000207008/version/20260101' },
      ],
    });

    expect(result).toEqual({
      result: true,
      inactive: true,
      message: undefined,
      display: 'Entire lung',
    });
  });

  it('returns requestError result when HTTP fails', () => {
    let result: ValidateCodeResult | undefined;

    service.validateCode('181216001').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://example.org/fhir/CodeSystem/$validate-code');
    req.flush(
      {
        resourceType: 'OperationOutcome',
        issue: [{ details: { text: 'Server unavailable' } }],
      },
      { status: 500, statusText: 'Server Error' }
    );

    expect(result).toEqual({
      result: false,
      message: 'Server unavailable',
      requestError: true,
    });
  });
});

describe('TerminologyService translateInactiveSnomedReplacements', () => {
  let service: TerminologyService;
  let httpMock: HttpTestingController;

  const translateUrl = 'https://example.org/fhir/ConceptMap/$translate?code=123456789&system=http://snomed.info/sct&targetsystem=http://snomed.info/sct';

  const sampleTranslateResponse = {
    resourceType: 'Parameters',
    parameter: [
      { name: 'result', valueBoolean: true },
      {
        name: 'match',
        part: [
          { name: 'equivalence', valueCode: 'inexact' },
          {
            name: 'concept',
            valueCoding: {
              system: 'http://snomed.info/sct',
              code: '1372723000',
              display: 'Fluoroscopy of lower gastrointestinal tract with barium and air contrast enema',
            },
          },
        ],
      },
      {
        name: 'match',
        part: [
          { name: 'equivalence', valueCode: 'inexact' },
          {
            name: 'concept',
            valueCoding: {
              system: 'http://snomed.info/sct',
              code: '1372724006',
              display: 'Plain X-ray of lower gastrointestinal tract with barium and air contrast enema',
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TerminologyService,
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open', 'openFromComponent']) },
      ],
    });

    service = TestBed.inject(TerminologyService);
    httpMock = TestBed.inject(HttpTestingController);

    const metadataReq = httpMock.expectOne('assets/language/national-language-metadata.json');
    metadataReq.flush({ editions: [] });

    service.snowstormFhirBase = 'https://example.org/fhir';
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('parses replacement concepts from translate response', () => {
    let result: SnomedReplacementConcept[] | undefined;

    service.translateInactiveSnomedReplacements('123456789').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne(translateUrl);
    expect(req.request.method).toBe('GET');
    req.flush(sampleTranslateResponse);

    expect(result).toEqual([
      {
        code: '1372723000',
        display: 'Fluoroscopy of lower gastrointestinal tract with barium and air contrast enema',
      },
      {
        code: '1372724006',
        display: 'Plain X-ray of lower gastrointestinal tract with barium and air contrast enema',
      },
    ]);
  });

  it('deduplicates replacement concepts by code', () => {
    let result: SnomedReplacementConcept[] | undefined;

    service.translateInactiveSnomedReplacements('123456789').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne(translateUrl);
    req.flush({
      resourceType: 'Parameters',
      parameter: [
        { name: 'result', valueBoolean: true },
        sampleTranslateResponse.parameter[1],
        sampleTranslateResponse.parameter[1],
      ],
    });

    expect(result?.length).toBe(1);
    expect(result?.[0].code).toBe('1372723000');
  });

  it('returns empty array when translate result is false', () => {
    let result: SnomedReplacementConcept[] | undefined;

    service.translateInactiveSnomedReplacements('123456789').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne(translateUrl);
    req.flush({
      resourceType: 'Parameters',
      parameter: [{ name: 'result', valueBoolean: false }],
    });

    expect(result).toEqual([]);
  });

  it('returns empty array when HTTP fails', () => {
    let result: SnomedReplacementConcept[] | undefined;

    service.translateInactiveSnomedReplacements('123456789').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne(translateUrl);
    req.flush('Server error', { status: 500, statusText: 'Server Error' });

    expect(result).toEqual([]);
  });
});

describe('TerminologyService server kind detection', () => {
  let service: TerminologyService;
  let httpMock: HttpTestingController;
  const base = 'https://tx.example.org/fhir';

  beforeEach(() => {
    localStorage.removeItem('terminologyServerKinds');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TerminologyService,
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open', 'openFromComponent']) },
      ],
    });

    service = TestBed.inject(TerminologyService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('assets/language/national-language-metadata.json').flush({ editions: [] });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('terminologyServerKinds');
  });

  it('detects Ontoserver from software.name and caches the result', () => {
    const kinds: string[] = [];
    service.detectServerKind(base).subscribe((kind) => kinds.push(kind));
    service.detectServerKind(base + '/').subscribe((kind) => kinds.push(kind));

    httpMock.expectOne(`${base}/metadata?_summary=true`).flush({ software: { name: 'Ontoserver®' } });
    service.detectServerKind(base).subscribe((kind) => kinds.push(kind));

    expect(kinds).toEqual(['ontoserver', 'ontoserver', 'ontoserver']);
    expect(service.getServerKind(base)).toBe('ontoserver');
    expect(JSON.parse(localStorage.getItem('terminologyServerKinds') || '{}')[base].kind).toBe('ontoserver');
  });

  it('distinguishes Snowstorm Lite from Snowstorm', () => {
    let lite: string | undefined;
    let full: string | undefined;
    service.detectServerKind('https://a.example.org/fhir').subscribe((kind) => (lite = kind));
    service.detectServerKind('https://b.example.org/fhir').subscribe((kind) => (full = kind));
    httpMock.expectOne('https://a.example.org/fhir/metadata?_summary=true')
      .flush({ software: { name: 'Snowstorm Lite FHIR Terminology Server' } });
    httpMock.expectOne('https://b.example.org/fhir/metadata?_summary=true')
      .flush({ software: { name: 'SnowstormX FHIR Server' } });

    expect(lite).toBe('snowstorm-lite');
    expect(full).toBe('snowstorm');
  });

  it('falls back to the URL guess without caching when metadata fails', () => {
    const ontoBase = 'https://r4.ontoserver.example.org/fhir';
    let kind: string | undefined;
    service.detectServerKind(ontoBase).subscribe((k) => (kind = k));
    httpMock.expectOne(`${ontoBase}/metadata?_summary=true`).flush('down', { status: 503, statusText: 'Unavailable' });

    expect(kind).toBe('ontoserver');
    service.detectServerKind(ontoBase).subscribe();
    httpMock.expectOne(`${ontoBase}/metadata?_summary=true`).flush({ software: { name: 'Ontoserver®' } });
  });

  it('uses the Ontoserver language dialect format for a detected Ontoserver on any URL', () => {
    service.setSnowstormFhirBase(base);
    expect(service.getComputedLanguageContextForSelection('en', { code: '900000000000509007' })).toBe('en-X-900000000000509007');

    httpMock.expectOne(`${base}/metadata?_summary=true`).flush({ software: { name: 'Ontoserver®' } });

    expect(service.getComputedLanguageContextForSelection('en', { code: '900000000000509007' }))
      .toBe('en-x-sctlang-90000000-00005090-07');
  });
});
