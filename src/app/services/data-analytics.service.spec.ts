import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataAnalyticsService } from './data-analytics.service';
import { TerminologyService, TerminologyServerKind } from './terminology.service';

describe('DataAnalyticsService partial hierarchy server selection', () => {
  const fallbackBase = 'https://implementation-demo.snomedtools.org/snowstorm-lite/fhir';
  let service: DataAnalyticsService;
  let httpMock: HttpTestingController;
  let terminology: { snowstormFhirBase: string; detectServerKind: jasmine.Spy };

  function setup(currentBase: string, kind: TerminologyServerKind): void {
    terminology = {
      snowstormFhirBase: currentBase,
      detectServerKind: jasmine.createSpy('detectServerKind').and.returnValue(of(kind)),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DataAnalyticsService,
        { provide: TerminologyService, useValue: terminology },
      ],
    });
    service = TestBed.inject(DataAnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpMock.verify());

  it('uses the current server when it is Snowstorm Lite', () => {
    setup('https://lite.example.org/fhir/', 'snowstorm-lite');
    let result: any;
    service.getPartialHierarchy(['195967001']).subscribe((nodes) => (result = nodes));

    const req = httpMock.expectOne('https://lite.example.org/fhir/partial-hierarchy');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ system: 'http://snomed.info/sct', includeTerms: true, codes: ['195967001'] });
    req.flush([{ code: '195967001', term: 'Asthma', parents: [] }]);

    expect(terminology.detectServerKind).toHaveBeenCalledWith('https://lite.example.org/fhir');
    expect(result.length).toBe(1);
  });

  it('falls back to the default Lite server when the current server is not Lite', () => {
    setup('https://implementation-demo.snomedtools.org/fhir', 'snowstorm');
    service.getPartialHierarchy(['195967001']).subscribe();

    httpMock.expectOne(`${fallbackBase}/partial-hierarchy`).flush([]);
    expect(terminology.detectServerKind).toHaveBeenCalledWith('https://implementation-demo.snomedtools.org/fhir');
  });

  it('falls back to the default Lite server when no server is selected', () => {
    setup('', 'other');
    service.getPartialHierarchy(['195967001']).subscribe();

    httpMock.expectOne(`${fallbackBase}/partial-hierarchy`).flush([]);
    expect(terminology.detectServerKind).not.toHaveBeenCalled();
  });
});
