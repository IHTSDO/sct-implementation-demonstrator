import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EclBuilderDialogComponent } from './ecl-builder-dialog.component';
import { EclBuilderComponent } from '../ecl-builder/ecl-builder.component';
import { ExpressionConstraintNodeComponent } from '../ecl-builder/expression-constraint-node/expression-constraint-node.component';
import { AttributeSetEditorComponent } from '../ecl-builder/attribute-set-editor/attribute-set-editor.component';
import { AttributeEditorComponent } from '../ecl-builder/attribute-editor/attribute-editor.component';
import { ConceptPickerComponent } from '../ecl-builder/concept-picker/concept-picker.component';
import { ConstraintOperatorSelectComponent } from '../ecl-builder/constraint-operator-select/constraint-operator-select.component';
import { AutocompleteBindingComponent } from '../autocomplete-binding/autocomplete-binding.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { EclBuilderService } from '../ecl-builder/ecl-builder.service';
import { TerminologyService } from '../../services/terminology.service';

describe('EclBuilderDialogComponent', () => {
  let component: EclBuilderDialogComponent;
  let fixture: ComponentFixture<EclBuilderDialogComponent>;
  let eclBuilderServiceSpy: jasmine.SpyObj<EclBuilderService>;
  let terminologyServiceSpy: jasmine.SpyObj<TerminologyService>;

  beforeEach(async () => {
    eclBuilderServiceSpy = jasmine.createSpyObj<EclBuilderService>('EclBuilderService', [
      'stringToModel',
      'modelToString',
      'collectUnsupportedFeatures',
      'getDomainAttributes',
      'addRefinement',
      'createEmptyAttribute'
    ]);
    terminologyServiceSpy = jasmine.createSpyObj<TerminologyService>('TerminologyService', [
      'expandValueSet',
      'expandValueSetFromServer',
      'getComputedLanguageContext',
      'getSnowstormFhirBase'
    ]);

    eclBuilderServiceSpy.stringToModel.and.returnValue(of({ wildcard: true, conceptId: '*', uiId: '1' } as any));
    eclBuilderServiceSpy.modelToString.and.returnValue(of('*'));
    eclBuilderServiceSpy.collectUnsupportedFeatures.and.returnValue([]);
    eclBuilderServiceSpy.getDomainAttributes.and.returnValue(of([]));
    eclBuilderServiceSpy.createEmptyAttribute.and.returnValue({
      attributeName: { conceptId: '', operator: 'descendantorselfof' },
      expressionComparisonOperator: '=',
      value: { conceptId: '', operator: 'descendantorselfof' }
    } as any);

    terminologyServiceSpy.expandValueSet.and.returnValue(of({ expansion: { contains: [] } }));
    terminologyServiceSpy.expandValueSetFromServer.and.returnValue(of({ expansion: { contains: [] } }));

    await TestBed.configureTestingModule({
      declarations: [
        EclBuilderDialogComponent,
        EclBuilderComponent,
        ExpressionConstraintNodeComponent,
        AttributeSetEditorComponent,
        AttributeEditorComponent,
        ConceptPickerComponent,
        ConstraintOperatorSelectComponent,
        AutocompleteBindingComponent
      ],
      imports: [
        BrowserAnimationsModule,
        NoopAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientTestingModule,
        MatDialogModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatIconModule,
        MatAutocompleteModule,
        MatProgressSpinnerModule
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { ecl: '' } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: EclBuilderService, useValue: eclBuilderServiceSpy },
        { provide: TerminologyService, useValue: terminologyServiceSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EclBuilderDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
