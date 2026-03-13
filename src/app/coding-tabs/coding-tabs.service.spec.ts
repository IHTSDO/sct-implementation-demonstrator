import { CodingTabsService } from './coding-tabs.service';

describe('CodingTabsService', () => {
  let service: CodingTabsService;

  beforeEach(() => {
    service = new CodingTabsService({} as any);
  });

  it('normalizes legacy autocomplete bindings', () => {
    const spec = service.normalizeSpec({
      title: 'Legacy demo',
      bindings: [
        {
          title: 'Clinical drug',
          type: 'autocomplete',
          ecl: '<< 763158003 |Medicinal product|'
        }
      ]
    });

    expect(spec.bindings[0].type).toBe('Autocomplete');
    expect(spec.bindings[0].count).toBe(1);
    expect(spec.bindings[0].repeatable).toBeFalse();
  });

  it('keeps existing supported binding types intact', () => {
    const spec = service.normalizeSpec({
      title: 'Current demo',
      description: 'Current format',
      bindings: [
        {
          title: 'Diagnosis',
          type: 'Select (Single)',
          ecl: '<< 404684003 |Clinical finding|',
          repeatable: true,
          count: 3
        }
      ]
    });

    expect(spec.description).toBe('Current format');
    expect(spec.bindings[0].type).toBe('Select (Single)');
    expect(spec.bindings[0].repeatable).toBeTrue();
    expect(spec.bindings[0].count).toBe(3);
  });
});
