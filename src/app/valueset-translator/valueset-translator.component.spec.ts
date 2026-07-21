import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { EclBuilderDialogService } from '../bindings/ecl-builder/ecl-builder-dialog.service';
import { TerminologyService, SnomedReplacementConcept } from '../services/terminology.service';
import { ValuesetTranslatorComponent } from './valueset-translator.component';

describe('ValuesetTranslatorComponent', () => {
  let component: ValuesetTranslatorComponent;
  let fixture: ComponentFixture<ValuesetTranslatorComponent>;
  let terminologyService: jasmine.SpyObj<TerminologyService>;

  beforeEach(async () => {
    terminologyService = jasmine.createSpyObj(
      'TerminologyService',
      [
        'validateCode',
        'translateInactiveSnomedReplacements',
        'getSnowstormFhirBase',
        'getComputedLanguageContext',
        'getComputedLanguageContextForSelection',
        'getLang',
        'getContextsForEdition',
      ],
      {
        fhirUrlParam$: of('http://snomed.info/sct/900000000000207008/version/20260101'),
        lang$: of('en'),
        languageRefsetConcept$: of(null),
        context$: of(null),
        editionName$: of('International Edition'),
        editionsDetails$: of([]),
        languages$: of(['en']),
        contexts$: of([]),
      }
    );

    terminologyService.getSnowstormFhirBase.and.returnValue('https://example.org/fhir');
    terminologyService.getComputedLanguageContext.and.returnValue('en');
    terminologyService.getLang.and.returnValue('en');
    terminologyService.getContextsForEdition.and.returnValue([]);
    terminologyService.translateInactiveSnomedReplacements.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [ValuesetTranslatorComponent],
      imports: [ReactiveFormsModule, FormsModule],
      providers: [
        FormBuilder,
        { provide: TerminologyService, useValue: terminologyService },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
        { provide: EclBuilderDialogService, useValue: jasmine.createSpyObj('EclBuilderDialogService', ['open']) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ValuesetTranslatorComponent);
    component = fixture.componentInstance;
    component.ngOnInit();

    component.showPreview = true;
    component.previewData = [
      ['code', 'display'],
      ['181216001', 'Entire lung (body structure)'],
      ['123456789', 'Bad term'],
    ];
    component.importForm.patchValue({ codeColumn: 0, displayColumn: 1, skipHeader: true });
    component.terminologyContext = {
      fhirUrlParam: 'http://snomed.info/sct/900000000000207008/version/20260101',
      language: 'en',
      editionName: 'International Edition',
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('validates codes sequentially with one second delay between requests', fakeAsync(() => {
    const firstResponse = new Subject<{ result: boolean; display?: string; message?: string }>();
    terminologyService.validateCode.and.returnValues(
      firstResponse.asObservable(),
      of({ result: false, message: 'Display incorrect', display: 'Correct term' })
    );

    let completed = false;
    component.validateCodesAndTerms().then(() => {
      completed = true;
    });

    tick(0);
    expect(component.validationResults.length).toBe(2);
    expect(component.validationResults[0].status).toBe('validating');
    expect(component.validationResults[1].status).toBe('pending');

    firstResponse.next({ result: true, display: 'Entire lung (body structure)' });
    firstResponse.complete();
    tick(0);

    expect(component.validationResults[0].status).toBe('valid');
    expect(component.validationResults[0].result).toBeTrue();
    expect(terminologyService.validateCode).toHaveBeenCalledTimes(1);

    tick(999);
    expect(terminologyService.validateCode).toHaveBeenCalledTimes(1);

    tick(1);
    tick(0);
    expect(component.validationResults[1].status).toBe('invalid');
    expect(component.validationResults[1].message).toBe('Display incorrect');
    expect(terminologyService.validateCode).toHaveBeenCalledTimes(2);
    expect(component.isValidationLoading).toBeFalse();
    expect(completed).toBeTrue();
  }));

  it('initializes validation rows as pending before requests complete', fakeAsync(() => {
    const pendingResponse = new Subject<{ result: boolean }>();
    terminologyService.validateCode.and.returnValue(pendingResponse.asObservable());

    component.validateCodesAndTerms();
    tick(0);

    expect(component.validationResults.map((row) => row.status)).toEqual(['validating', 'pending']);
    expect(component.validationProgress.total).toBe(2);

    pendingResponse.next({ result: true });
    pendingResponse.complete();
    tick(0);
  }));

  it('treats inactive codes as invalid even when result is true', fakeAsync(() => {
    terminologyService.validateCode.and.returnValue(
      of({ result: true, inactive: true, display: 'Entire lung' })
    );

    component.validateCodesAndTerms();
    tick(0);
    tick(1000);
    tick(0);
    tick(1000);
    tick(0);

    expect(component.validationResults[0].status).toBe('invalid');
    expect(component.validationResults[0].result).toBeFalse();
    expect(component.validationResults[0].message).toBe('Code is inactive');
    expect(component.validationInvalidCount).toBe(2);
  }));

  it('treats inactive codes as valid when inactiveCodesAreInvalid is unchecked', fakeAsync(() => {
    component.inactiveCodesAreInvalid = false;
    component.previewData = [['code', 'display'], ['181216001', 'Entire lung']];
    terminologyService.validateCode.and.returnValue(
      of({ result: true, inactive: true, display: 'Entire lung' })
    );

    component.validateCodesAndTerms();
    tick(0);

    expect(component.validationResults[0].status).toBe('valid');
    expect(component.validationResults[0].result).toBeTrue();
    expect(component.validationResults[0].message).toBe('Code is inactive');
    expect(component.validationValidCount).toBe(1);
    expect(component.validationInvalidCount).toBe(0);
  }));

  it('prepends inactive notice when server also returns a validation message', fakeAsync(() => {
    terminologyService.validateCode.and.returnValue(
      of({ result: false, inactive: true, message: 'The display is incorrect' })
    );
    component.previewData = [['code', 'display'], ['181216001', 'Entire lung']];

    component.validateCodesAndTerms();
    tick(0);

    expect(component.validationResults[0].message).toBe('Code is inactive. The display is incorrect');
  }));

  it('appends replacement concepts when validate returns inactive code', fakeAsync(() => {
    const replacements: SnomedReplacementConcept[] = [
      {
        code: '1372723000',
        display: 'Fluoroscopy of lower gastrointestinal tract with barium and air contrast enema',
      },
      {
        code: '1372724006',
        display: 'Plain X-ray of lower gastrointestinal tract with barium and air contrast enema',
      },
    ];
    component.previewData = [['code', 'display'], ['123456789', 'Inactive concept']];
    terminologyService.validateCode.and.returnValue(
      of({ result: true, inactive: true, display: 'Inactive concept' })
    );
    terminologyService.translateInactiveSnomedReplacements.and.returnValue(of(replacements));

    component.validateCodesAndTerms();
    tick(0);

    expect(terminologyService.translateInactiveSnomedReplacements).toHaveBeenCalledWith(
      '123456789',
      'https://example.org/fhir'
    );
    expect(component.validationResults[0].message).toContain('Code is inactive');
    expect(component.validationResults[0].message).toContain('Replacement concepts:');
    expect(component.validationResults[0].message).toContain(
      '- 1372723000 |Fluoroscopy of lower gastrointestinal tract with barium and air contrast enema|'
    );
    expect(component.validationResults[0].message).toContain(
      '- 1372724006 |Plain X-ray of lower gastrointestinal tract with barium and air contrast enema|'
    );
  }));

  it('does not call translate when code is not inactive', fakeAsync(() => {
    component.previewData = [['code', 'display'], ['181216001', 'Entire lung']];
    terminologyService.validateCode.and.returnValue(
      of({ result: true, inactive: false, display: 'Entire lung' })
    );

    component.validateCodesAndTerms();
    tick(0);

    expect(terminologyService.translateInactiveSnomedReplacements).not.toHaveBeenCalled();
  }));

  it('leaves message unchanged when translate returns no replacements', fakeAsync(() => {
    component.previewData = [['code', 'display'], ['123456789', 'Inactive concept']];
    terminologyService.validateCode.and.returnValue(
      of({ result: true, inactive: true, display: 'Inactive concept' })
    );
    terminologyService.translateInactiveSnomedReplacements.and.returnValue(of([]));

    component.validateCodesAndTerms();
    tick(0);

    expect(component.validationResults[0].message).toBe('Code is inactive');
    expect(component.validationResults[0].message).not.toContain('Replacement concepts:');
  }));

  it('sorts invalid rows to the top of visible validation results', () => {
    component.validationResults = [
      { code: '1', status: 'valid', result: true },
      { code: '2', status: 'invalid', result: false, message: 'Bad display' },
      { code: '3', status: 'pending' },
      { code: '4', status: 'valid', result: true },
    ];
    component.validationPreviewVisibleCount = 100;

    expect(component.visibleValidationRows.map((row) => row.code)).toEqual(['2', '3', '1', '4']);
  });

  it('loads another 100 validation rows when Load more is clicked', () => {
    component.validationResults = Array.from({ length: 250 }, (_, index) => ({
      code: String(index),
      status: 'valid' as const,
      result: true,
    }));
    component.validationPreviewVisibleCount = 100;

    component.loadMoreValidationRows();

    expect(component.validationPreviewVisibleCount).toBe(200);
    expect(component.visibleValidationRows.length).toBe(200);
  });

  it('loads the first worksheet by default for multi-sheet workbooks', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['code', 'display'], ['111', 'Sheet1 term']]),
      'Sheet1'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['code', 'display'], ['222', 'Sheet2 term']]),
      'Sheet2'
    );

    (component as any).loadSpreadsheetPreviewFromWorkbook(workbook);

    expect(component.availableSheetNames).toEqual(['Sheet1', 'Sheet2']);
    expect(component.selectedSheetName).toBe('Sheet1');
    expect(component.previewData[1][0]).toBe('111');
    expect(component.showPreview).toBeTrue();
  });

  it('switches preview data and clears downstream state when worksheet changes', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['code', 'display'], ['111', 'Sheet1 term']]),
      'Sheet1'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['code', 'display'], ['222', 'Sheet2 term']]),
      'Sheet2'
    );

    (component as any).loadSpreadsheetPreviewFromWorkbook(workbook);
    component.selectedAction = 'validate-codes';
    component.validationResults = [{ code: '111', status: 'valid', result: true }];

    component.onSheetChange('Sheet2');

    expect(component.selectedSheetName).toBe('Sheet2');
    expect(component.previewData[1][0]).toBe('222');
    expect(component.selectedAction).toBeNull();
    expect(component.validationResults.length).toBe(0);
  });

  it('reads cached workbook data from the selected worksheet', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['code', 'display'], ['111', 'Sheet1 term']]),
      'Sheet1'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['source code', 'target code'], ['A', '222']]),
      'Sheet2'
    );

    component.uploadedWorkbook = workbook;
    component.selectedSheetName = 'Sheet2';

    const data = await (component as any).readExcelFile({ name: 'test.xlsx' } as File);

    expect(data.length).toBe(1);
    expect(data[0]['target code']).toBe('222');
  });

  it('scrolls to the worksheet selector after multi-sheet file load', () => {
    const scrollToElementSpy = spyOn<any>(component, 'scrollToElementAfterRender');
    const scrollToBottomSpy = spyOn<any>(component, 'scrollToBottomAfterRender');

    component.availableSheetNames = ['Sheet1', 'Sheet2'];
    (component as any).scrollAfterSuccessfulFileLoad();

    expect(scrollToElementSpy).toHaveBeenCalled();
    expect(scrollToBottomSpy).not.toHaveBeenCalled();
  });

  it('scrolls to the page bottom after single-sheet file load', () => {
    const scrollToElementSpy = spyOn<any>(component, 'scrollToElementAfterRender');
    const scrollToBottomSpy = spyOn<any>(component, 'scrollToBottomAfterRender');

    component.availableSheetNames = ['Sheet1'];
    (component as any).scrollAfterSuccessfulFileLoad();

    expect(scrollToBottomSpy).toHaveBeenCalled();
    expect(scrollToElementSpy).not.toHaveBeenCalled();
  });
});
