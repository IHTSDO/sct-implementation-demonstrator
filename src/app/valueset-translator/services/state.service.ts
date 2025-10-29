import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { 
  ValueSetTranslatorState, 
  initialState, 
  FileState, 
  ProcessingState, 
  ValueSetState, 
  TranslationState, 
  UIState 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ValueSetTranslatorStateService {
  private state$ = new BehaviorSubject<ValueSetTranslatorState>(initialState);

  getState(): Observable<ValueSetTranslatorState> {
    return this.state$.asObservable();
  }

  getCurrentState(): ValueSetTranslatorState {
    return this.state$.value;
  }

  updateState(updates: Partial<ValueSetTranslatorState>): void {
    const currentState = this.state$.value;
    const newState = { ...currentState, ...updates };
    this.state$.next(newState);
  }

  updateFileState(updates: Partial<FileState>): void {
    const currentState = this.state$.value;
    const newFileState = { ...currentState.file, ...updates };
    this.updateState({ file: newFileState });
  }

  updateProcessingState(updates: Partial<ProcessingState>): void {
    const currentState = this.state$.value;
    const newProcessingState = { ...currentState.processing, ...updates };
    this.updateState({ processing: newProcessingState });
  }

  updateValueSetState(updates: Partial<ValueSetState>): void {
    const currentState = this.state$.value;
    const newValueSetState = { ...currentState.valueSet, ...updates };
    this.updateState({ valueSet: newValueSetState });
  }

  updateTranslationState(updates: Partial<TranslationState>): void {
    const currentState = this.state$.value;
    const newTranslationState = { ...currentState.translation, ...updates };
    this.updateState({ translation: newTranslationState });
  }

  updateUIState(updates: Partial<UIState>): void {
    const currentState = this.state$.value;
    const newUIState = { ...currentState.ui, ...updates };
    this.updateState({ ui: newUIState });
  }

  // Selectors
  selectFileState(): Observable<FileState> {
    return this.state$.pipe(map(state => state.file));
  }

  selectProcessingState(): Observable<ProcessingState> {
    return this.state$.pipe(map(state => state.processing));
  }

  selectValueSetState(): Observable<ValueSetState> {
    return this.state$.pipe(map(state => state.valueSet));
  }

  selectTranslationState(): Observable<TranslationState> {
    return this.state$.pipe(map(state => state.translation));
  }

  selectUIState(): Observable<UIState> {
    return this.state$.pipe(map(state => state.ui));
  }

  // Specific selectors
  selectFile(): Observable<File | null> {
    return this.state$.pipe(map(state => state.file.file));
  }

  selectProcessingResult(): Observable<any> {
    return this.state$.pipe(map(state => state.file.processingResult));
  }

  selectIsLoading(): Observable<boolean> {
    return this.state$.pipe(map(state => 
      state.processing.isFileLoading || 
      state.processing.isTranslationLoading || 
      state.processing.isProcessing
    ));
  }

  selectError(): Observable<string | null> {
    return this.state$.pipe(map(state => 
      state.file.error || state.processing.error
    ));
  }

  selectSelectedAction(): Observable<string | null> {
    return this.state$.pipe(map(state => state.translation.selectedAction));
  }

  selectShowPreview(): Observable<boolean> {
    return this.state$.pipe(map(state => state.ui.showPreview));
  }

  selectShowEclInput(): Observable<boolean> {
    return this.state$.pipe(map(state => state.ui.showEclInput));
  }

  // Reset methods
  resetFileState(): void {
    this.updateFileState({
      file: null,
      processingResult: null,
      columnConfig: {
        codeColumn: null,
        displayColumn: null,
        skipHeader: true
      },
      isLoading: false,
      error: null
    });
  }

  resetProcessingState(): void {
    this.updateProcessingState({
      isFileLoading: false,
      isTranslationLoading: false,
      isProcessing: false,
      isUploading: false,
      error: null,
      successMessage: null
    });
  }

  resetTranslationState(): void {
    this.updateTranslationState({
      selectedAction: null,
      context: {
        edition: '',
        language: '',
        terminologyService: ''
      },
      result: null,
      previewData: []
    });
  }

  resetUIState(): void {
    this.updateUIState({
      showPreview: false,
      showEclInput: false,
      showIndicators: true,
      showFhirOptions: false,
      showValueSetMetadata: true,
      showFhirServerUpload: false,
      fhirServerUrl: '',
      instructionTab: 'download'
    });
  }

  resetAllState(): void {
    this.state$.next(initialState);
  }
}
