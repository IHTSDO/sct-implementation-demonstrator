import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TerminologyService } from '../services/terminology.service';
import { 
  FileProcessingService, 
  ValueSetService, 
  TranslationService, 
  ValueSetTranslatorStateService 
} from './services';
import { 
  FileProcessingResult, 
  ValueSetMetadata, 
  TerminologyContext, 
  CodeItem,
  FHIRValueSet,
  FHIRPackage,
  PreviewData
} from './models';

@Component({
  selector: 'app-valueset-translator-refactored',
  templateUrl: './valueset-translator-refactored.component.html',
  styleUrls: ['./valueset-translator-refactored.component.scss']
})
export class ValuesetTranslatorRefactoredComponent implements OnInit, OnDestroy {
  // Form
  importForm: FormGroup;

  // State observables
  file$ = this.stateService.selectFile();
  processingResult$ = this.stateService.selectProcessingResult();
  isLoading$ = this.stateService.selectIsLoading();
  error$ = this.stateService.selectError();
  selectedAction$ = this.stateService.selectSelectedAction();
  showPreview$ = this.stateService.selectShowPreview();
  showEclInput$ = this.stateService.selectShowEclInput();

  // Additional state
  eclExpression = '';
  terminologyContext: TerminologyContext = {
    fhirUrlParam: '',
    language: '',
    editionName: ''
  };
  editionsDetails: any[] = [];
  languages: string[] = [];
  contexts: any[] = [];
  languageRefsets: any[] = [];
  selectedContext: any = null;
  selectedLanguageDisplayLabel = 'Language';
  selectedLanRefsetConcept: any = null;
  targetPreviewData: PreviewData[] = [];
  isTranslationLoading = false;
  valueSetMetadata: ValueSetMetadata = {
    uri: '',
    name: '',
    version: '1.0.0',
    sourceSystemUri: ''
  };
  mapBetweenValueSets = false;
  targetValueSet: FHIRValueSet | null = null;
  sourceValueSet: FHIRValueSet | null = null;
  generatedPackage: FHIRPackage | null = null;
  fhirServerUrl = '';
  isUploading = false;
  showFhirServerUpload = false;
  instructionTab = 'download';

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private terminologyService: TerminologyService,
    private fileProcessingService: FileProcessingService,
    private valueSetService: ValueSetService,
    private translationService: TranslationService,
    private stateService: ValueSetTranslatorStateService,
    private snackBar: MatSnackBar
  ) {
    this.importForm = this.fb.group({
      codeColumn: ['', Validators.required],
      displayColumn: [''],
      skipHeader: [true]
    });
  }

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadTerminologyData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeSubscriptions(): void {
    // Terminology context subscription
    this.subscriptions.add(
      combineLatest([
        this.terminologyService.fhirUrlParam$,
        this.terminologyService.lang$,
        this.terminologyService.languageRefsetConcept$,
        this.terminologyService.context$,
        this.terminologyService.editionName$
      ]).subscribe(([fhirUrlParam, lang, languageRefsetConcept, context, editionName]) => {
        this.terminologyContext = {
          fhirUrlParam,
          language: this.terminologyService.getComputedLanguageContext(),
          editionName
        };
        this.selectedContext = context;
        this.selectedLanRefsetConcept = languageRefsetConcept;
        this.updateSelectedLanguageLabel();
      })
    );

    // Terminology data subscriptions
    this.subscriptions.add(
      this.terminologyService.editionsDetails$.subscribe(editions => {
        this.editionsDetails = editions;
      })
    );

    this.subscriptions.add(
      this.terminologyService.languages$.subscribe(langs => {
        this.languages = langs;
      })
    );

    this.subscriptions.add(
      this.terminologyService.contexts$.subscribe(contexts => {
        this.contexts = contexts;
      })
    );

    if ((this.terminologyService as any).languageRefsets) {
      this.languageRefsets = (this.terminologyService as any).languageRefsets;
    }
  }

  private loadTerminologyData(): void {
    // Load initial terminology data if needed
  }

  private updateSelectedLanguageLabel(): void {
    const activeLanguage = this.terminologyService.getComputedLanguageContext();
    if (activeLanguage && typeof activeLanguage === 'string') {
      if (!activeLanguage.includes('-X-')) {
        this.selectedLanguageDisplayLabel = activeLanguage;
      } else {
        const languageParts = activeLanguage.split('-X-');
        this.selectedLanguageDisplayLabel = languageParts[0] + '*';
      }
    } else if (activeLanguage && typeof activeLanguage === 'object') {
      this.selectedLanguageDisplayLabel = activeLanguage['name'];
    }
  }

  // File handling methods
  async onFileSelected(file: File): Promise<void> {
    this.stateService.updateProcessingState({ isFileLoading: true, error: null });
    
    try {
      const result = await this.fileProcessingService.processFile(file);
      this.stateService.updateFileState({ 
        file, 
        processingResult: result,
        error: null 
      });
      
      // Auto-configure columns based on file type detection
      if (result.suggestedColumns) {
        this.importForm.patchValue(result.suggestedColumns);
      }
      
      this.stateService.updateUIState({ showPreview: true });
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error processing file: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isFileLoading: false });
    }
  }

  onEclInputToggle(): void {
    const currentState = this.stateService.getCurrentState();
    this.stateService.updateUIState({ 
      showEclInput: !currentState.ui.showEclInput 
    });
    
    if (currentState.ui.showEclInput) {
      this.eclExpression = '';
      this.stateService.resetFileState();
    }
  }

  onEclExpressionChange(expression: string): void {
    this.eclExpression = expression;
  }

  async onEclExpand(): Promise<void> {
    if (!this.eclExpression.trim()) return;

    this.stateService.updateProcessingState({ 
      isTranslationLoading: true, 
      error: null 
    });

    try {
      const expandedValueSet = await this.terminologyService.expandValueSet(
        this.eclExpression, 
        '', 
        0, 
        1000
      ).toPromise();

      const total = expandedValueSet?.expansion?.total || 0;
      const matchCount = expandedValueSet?.expansion?.contains?.length || 0;

      if (total > 1000) {
        this.stateService.updateProcessingState({ 
          error: `Found ${total} matching concepts. This tool currently supports a maximum of 1000 concepts. Please refine your ECL expression to return fewer results.` 
        });
        return;
      }

      if (matchCount > 0) {
        this.targetValueSet = expandedValueSet;
        
        // Create preview data
        const first5 = expandedValueSet.expansion.contains.slice(0, 5).map((c: any) => [
          c.code || '',
          c.display || '',
          c.system || ''
        ]);
        
        const previewData = [
          ['Code', 'Display', 'System'],
          ...first5
        ];

        const columns = [
          { header: 'Code', index: 0 },
          { header: 'Display', index: 1 },
          { header: 'System', index: 2 }
        ];

        const processingResult: FileProcessingResult = {
          type: 'json' as any,
          data: previewData,
          columns,
          metadata: {
            name: 'ECL Result',
            size: 0,
            type: 'json' as any,
            lastModified: new Date()
          },
          isMap: false,
          isRf2Refset: false,
          isValueSetFile: true,
          isEclResult: true
        };

        this.stateService.updateFileState({ 
          processingResult,
          error: null 
        });
        
        this.importForm.patchValue({
          codeColumn: 0,
          displayColumn: 1,
          skipHeader: true
        });
        
        this.stateService.updateUIState({ showPreview: true });
        this.stateService.updateProcessingState({ 
          successMessage: `Successfully expanded ECL expression. Found ${matchCount} matching concepts.` 
        });
      } else {
        this.stateService.updateProcessingState({ 
          error: 'No concepts found for the given ECL expression' 
        });
      }
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error expanding ECL: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isTranslationLoading: false });
    }
  }

  // Form handling
  onFormValueChange(field: string, value: any): void {
    this.importForm.patchValue({ [field]: value });
  }

  // Action handling
  onActionSelect(action: string): void {
    this.stateService.updateTranslationState({ selectedAction: action });
    this.targetPreviewData = [];
    this.targetValueSet = null;
  }

  async onExecuteAction(): Promise<void> {
    const currentState = this.stateService.getCurrentState();
    const action = currentState.translation.selectedAction;
    
    if (!action) return;

    switch (action) {
      case 'translate':
        await this.executeTranslation();
        break;
      case 'source-valueset':
        await this.executeSourceValueSet();
        break;
      case 'target-valueset':
        await this.executeTargetValueSet();
        break;
      case 'translate-target':
        await this.executeTranslateTarget();
        break;
      case 'fhir-package':
        await this.executeFHIRPackage();
        break;
    }
  }

  private async executeTranslation(): Promise<void> {
    this.stateService.updateProcessingState({ isTranslationLoading: true, error: null });
    
    try {
      const currentState = this.stateService.getCurrentState();
      const codes = this.extractCodesFromCurrentState();
      
      if (codes.length === 0) {
        this.stateService.updateProcessingState({ 
          error: 'No codes found to translate' 
        });
        return;
      }

      const result = await this.translationService.translateConcepts(
        codes, 
        this.terminologyContext
      ).toPromise();

      this.targetValueSet = result as any; // Type assertion for compatibility
      this.targetPreviewData = result.preview;
      
      this.stateService.updateTranslationState({ 
        result: result as any,
        previewData: result.preview 
      });
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error generating translation: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isTranslationLoading: false });
    }
  }

  private async executeSourceValueSet(): Promise<void> {
    this.stateService.updateProcessingState({ isLoading: true, error: null });
    
    try {
      const codes = this.extractCodesFromCurrentState();
      const valueSet = this.valueSetService.createValueSet(
        codes, 
        this.valueSetMetadata, 
        this.terminologyContext
      );
      
      this.sourceValueSet = valueSet.parameter[0].resource;
      this.targetValueSet = this.sourceValueSet;
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error generating source ValueSet: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isLoading: false });
    }
  }

  private async executeTargetValueSet(): Promise<void> {
    this.stateService.updateProcessingState({ isLoading: true, error: null });
    
    try {
      const codes = this.extractCodesFromCurrentState();
      const valueSet = this.valueSetService.createValueSet(
        codes, 
        this.valueSetMetadata, 
        this.terminologyContext
      );
      
      const expandedValueSet = await this.valueSetService.expandValueSet(valueSet).toPromise();
      this.targetValueSet = expandedValueSet;
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error generating target ValueSet: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isLoading: false });
    }
  }

  private async executeTranslateTarget(): Promise<void> {
    this.stateService.updateProcessingState({ isLoading: true, error: null });
    
    try {
      const currentState = this.stateService.getCurrentState();
      if (!currentState.file.file) return;

      const data = await this.fileProcessingService.readExcelFile(currentState.file.file);
      const translatedData = await this.translationService.translateMapFile(
        data, 
        this.terminologyContext
      );
      
      // Handle the translated data (this would typically trigger a download)
      this.snackBar.open('Map file translated successfully', 'OK', { duration: 3000 });
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error translating target column: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isLoading: false });
    }
  }

  private async executeFHIRPackage(): Promise<void> {
    this.stateService.updateProcessingState({ isLoading: true, error: null });
    
    try {
      const currentState = this.stateService.getCurrentState();
      if (!currentState.file.file) return;

      const data = await this.fileProcessingService.readExcelFile(currentState.file.file);
      const { source, snomed } = this.extractConceptsFromMapData(data);
      
      this.generatedPackage = this.valueSetService.generateFHIRPackage(
        source, 
        snomed, 
        this.valueSetMetadata,
        this.mapBetweenValueSets
      );
      
      this.snackBar.open('FHIR package generated successfully!', 'OK', { duration: 3000 });
    } catch (error: any) {
      this.stateService.updateProcessingState({ 
        error: `Error generating FHIR package: ${error.message}` 
      });
    } finally {
      this.stateService.updateProcessingState({ isLoading: false });
    }
  }

  // Translation context methods
  onEditionChange(editionName: string): void {
    const editionObj = this.editionsDetails.find(e => e.editionName === editionName);
    if (editionObj && editionObj.editions && editionObj.editions.length > 0) {
      this.terminologyService.setFhirUrlParam(editionObj.editions[0].resource.version);
    }
  }

  onLanguageChange(language: string): void {
    this.terminologyService.setLang(language);
  }

  onContextChange(context: any): void {
    this.terminologyService.setContext(context);
  }

  onLanguageRefsetChange(langRefset: any): void {
    this.terminologyService.setLanguageRefsetConcept(langRefset);
  }

  // Metadata methods
  onMetadataChange(field: string, value: string): void {
    this.valueSetMetadata = { ...this.valueSetMetadata, [field]: value };
  }

  // Download methods
  onDownloadTargetValueSet(): void {
    if (this.targetValueSet) {
      this.valueSetService.downloadValueSet(this.targetValueSet, 'target-valueset.json');
    }
  }

  onDownloadTargetAsExcel(): void {
    if (this.targetValueSet) {
      // Implementation for Excel download
      this.snackBar.open('Excel download functionality to be implemented', 'OK', { duration: 3000 });
    }
  }

  onDownloadSourceValueSet(): void {
    if (this.sourceValueSet) {
      this.valueSetService.downloadValueSet(this.sourceValueSet, 'source-valueset.json');
    }
  }

  onDownloadTranslatedFile(): void {
    // Implementation for translated file download
    this.snackBar.open('Translated file download functionality to be implemented', 'OK', { duration: 3000 });
  }

  async onGenerateFHIRPackage(): Promise<void> {
    if (this.generatedPackage) {
      await this.valueSetService.downloadFHIRPackage(this.generatedPackage, `${this.valueSetMetadata.name}.tgz`);
    }
  }

  // FHIR server methods
  onFhirServerUrlChange(url: string): void {
    this.fhirServerUrl = url;
  }

  onFhirServerUploadToggle(): void {
    this.showFhirServerUpload = !this.showFhirServerUpload;
  }

  onUploadToFhirServer(): void {
    // Implementation for FHIR server upload
    this.snackBar.open('FHIR server upload functionality to be implemented', 'OK', { duration: 3000 });
  }

  onInstructionTabChange(tab: string): void {
    this.instructionTab = tab;
  }

  // Utility methods
  private extractCodesFromCurrentState(): CodeItem[] {
    const currentState = this.stateService.getCurrentState();
    const processingResult = currentState.file.processingResult;
    const columnConfig = currentState.file.columnConfig;
    
    if (!processingResult) return [];
    
    return this.fileProcessingService.extractCodesFromData(
      processingResult.data, 
      columnConfig
    );
  }

  private extractConceptsFromMapData(data: any[]): { source: CodeItem[], snomed: CodeItem[] } {
    const headers = Object.keys(data[0]);
    const sourceCodeCol = headers.find(h => h.toLowerCase().includes('source code'))!;
    const sourceDisplayCol = headers.find(h => h.toLowerCase().includes('source display'))!;
    const targetCodeCol = headers.find(h => h.toLowerCase().includes('target code'))!;
    const targetDisplayCol = headers.find(h => h.toLowerCase().includes('target display'))!;
    
    const pairedConcepts = data.map(row => ({
      source: {
        code: String(row[sourceCodeCol] || '').trim(),
        display: String(row[sourceDisplayCol] || '').trim()
      },
      snomed: {
        code: String(row[targetCodeCol] || '').trim(),
        display: String(row[targetDisplayCol] || '').trim()
      }
    })).filter(pair => 
      pair.source.code && 
      pair.source.display && 
      pair.snomed.code && 
      pair.snomed.display
    );

    return {
      source: pairedConcepts.map(pair => pair.source),
      snomed: pairedConcepts.map(pair => pair.snomed)
    };
  }

  // Computed properties for template
  get canExecuteAction(): boolean {
    const currentState = this.stateService.getCurrentState();
    const processingResult = currentState.file.processingResult;
    const columnConfig = currentState.file.columnConfig;
    
    if (!processingResult) return false;
    
    if (processingResult.isValueSetFile) {
      return true;
    }
    
    if (processingResult.isMap || processingResult.isRf2Refset) {
      return processingResult.data.length > 0;
    }
    
    return columnConfig.codeColumn !== null && this.importForm.valid;
  }
}
