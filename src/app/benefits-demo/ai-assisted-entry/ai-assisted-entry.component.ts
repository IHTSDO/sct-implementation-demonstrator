import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Patient, Condition, Procedure, MedicationStatement, PatientService } from '../../services/patient.service';
import { AiCodingService, DetectedEntity, EntityDetectionResult } from '../../services/ai-coding.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ai-assisted-entry',
  templateUrl: './ai-assisted-entry.component.html',
  styleUrls: ['./ai-assisted-entry.component.css'],
  standalone: false
})
export class AiAssistedEntryComponent implements OnInit, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() conditions: Condition[] = [];
  @Input() procedures: Procedure[] = [];
  @Input() medications: MedicationStatement[] = [];
  
  @Output() conditionAdded = new EventEmitter<any>();
  @Output() procedureAdded = new EventEmitter<any>();
  @Output() medicationAdded = new EventEmitter<any>();
  @Output() encounterAdded = new EventEmitter<any>();
  @ViewChild('editableDiv') editableDiv!: ElementRef;

  clinicalText: string = '';
  isProcessing: boolean = false;
  detectedConditions: DetectedEntity[] = [];
  detectedProcedures: DetectedEntity[] = [];
  detectedMedications: DetectedEntity[] = [];
  
  // Encounter form properties
  selectedReasonForEncounter: DetectedEntity | null = null;
  selectedDiagnosis: DetectedEntity | null = null;
  selectedProcedure: DetectedEntity | null = null;

  private detectionTimeout: any;
  private isUpdatingContent: boolean = false;
  private detectionSubscription?: Subscription;
  private currentSampleIndex: number = 0;

  constructor(
    private patientService: PatientService,
    private snackBar: MatSnackBar,
    private aiCodingService: AiCodingService
  ) { }

  ngOnInit(): void {
    // Component initialization
  }

  ngOnDestroy(): void {
    if (this.detectionSubscription) {
      this.detectionSubscription.unsubscribe();
    }
    if (this.detectionTimeout) {
      clearTimeout(this.detectionTimeout);
    }
  }

  onTextChange(): void {
    // Clear previous timeout
    if (this.detectionTimeout) {
      clearTimeout(this.detectionTimeout);
    }

    // Set processing state
    this.isProcessing = true;

    // Debounce the detection to avoid too many calls
    this.detectionTimeout = setTimeout(() => {
      this.performEntityDetection();
    }, 1000);
  }

  onContentEdit(event: any): void {
    if (this.isUpdatingContent) return;

    // Save cursor position before updating
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const cursorOffset = range ? range.startOffset : 0;
    const cursorNode = range ? range.startContainer : null;

    // Extract plain text from the contenteditable div
    const element = event.target;
    const newText = element.innerText || element.textContent || '';
    
    // Only update if text actually changed
    if (newText !== this.clinicalText) {
      this.clinicalText = newText;
      this.onTextChange();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    
    // Get pasted text and insert as plain text
    const paste = (event.clipboardData || (window as any).clipboardData).getData('text');
    
    // Insert the text at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(paste));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Update our model
    this.clinicalText = this.editableDiv.nativeElement.innerText || '';
    this.onTextChange();
  }

  private performEntityDetection(): void {
    if (!this.clinicalText || this.clinicalText.trim().length === 0) {
      // Reset detected entities if no text
      this.detectedConditions = [];
      this.detectedProcedures = [];
      this.detectedMedications = [];
      this.isProcessing = false;
      return;
    }

    // Cancel previous subscription if exists
    if (this.detectionSubscription) {
      this.detectionSubscription.unsubscribe();
    }

    // Prepare existing entities for duplicate checking
    const existingEntities: DetectedEntity[] = [
      ...this.conditions.map(c => ({
        id: c.id || '',
        name: c.code?.coding?.[0]?.display || '',
        type: 'condition' as const,
        confidence: 100,
        detectedText: '',
        conceptId: c.code?.coding?.[0]?.code || '',
        isExisting: true
      })),
      ...this.procedures.map(p => ({
        id: p.id || '',
        name: p.code?.coding?.[0]?.display || '',
        type: 'procedure' as const,
        confidence: 100,
        detectedText: '',
        conceptId: p.code?.coding?.[0]?.code || '',
        isExisting: true
      })),
      ...this.medications.map(m => ({
        id: m.id || '',
        name: m.medicationCodeableConcept?.coding?.[0]?.display || '',
        type: 'medication' as const,
        confidence: 100,
        detectedText: '',
        conceptId: m.medicationCodeableConcept?.coding?.[0]?.code || '',
        isExisting: true
      }))
    ];

    // Call the AI service for entity detection
    this.detectionSubscription = this.aiCodingService.detectEntities(this.clinicalText, existingEntities)
      .subscribe({
        next: (result: EntityDetectionResult) => {
          // Entities are already sorted by text position from the AI service
          this.detectedConditions = result.conditions;
          this.detectedProcedures = result.procedures;
          this.detectedMedications = result.medications;
          
          // Apply highlights and initialize encounter form
          this.applyHighlights();
          this.initializeEncounterForm();
          this.isProcessing = false;
        },
        error: (error) => {
          this.snackBar.open('Error detecting entities: ' + error.message, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.isProcessing = false;
        }
      });
  }


  private truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Calculate how much text we can show (accounting for ellipsis)
    const ellipsisLength = 6; // "..." at start + "..." at end
    const availableLength = maxLength - ellipsisLength;
    
    if (availableLength <= 0) {
      return '...';
    }
    
    // Split the available length between start and end
    const startLength = Math.floor(availableLength / 2);
    const endLength = availableLength - startLength;
    
    const startText = text.substring(0, startLength);
    const endText = text.substring(text.length - endLength);
    
    return `...${startText}...${endText}`;
  }

  saveAllDetected(): void {
    if (!this.patient) return;

    // Collect selected entities for encounter creation
    const selectedEntities = [
      ...this.detectedConditions.filter(c => this.canSaveEntity(c)).map(c => ({ name: c.name, type: 'condition', conceptId: c.conceptId })),
      ...(this.selectedProcedure && this.canSaveEntity(this.selectedProcedure) ? [{ name: this.selectedProcedure.name, type: 'procedure', conceptId: this.selectedProcedure.conceptId }] : []),
      ...this.detectedMedications.filter(m => this.canSaveEntity(m)).map(m => ({ name: m.name, type: 'medication', conceptId: m.conceptId }))
    ];

    // Create encounter first so we can link procedures to it
    let encounter: any = null;
    if (selectedEntities.length > 0) {
      // Use user-selected values for encounter creation
      const reasonForEncounter = this.selectedReasonForEncounter ? {
        name: this.selectedReasonForEncounter.name,
        conceptId: this.selectedReasonForEncounter.conceptId
      } : null;
      
      const diagnosis = this.selectedDiagnosis ? {
        name: this.selectedDiagnosis.name,
        conceptId: this.selectedDiagnosis.conceptId
      } : null;
      
      encounter = this.patientService.createEncounterFromAISession(
        this.patient.id, 
        this.clinicalText, 
        reasonForEncounter,
        diagnosis
      );
    }

    // Use centralized PatientService methods to create proper FHIR resources
    // Only save entities that don't already exist
    this.detectedConditions
      .filter(condition => this.canSaveEntity(condition))
      .forEach(condition => {
        const newCondition = this.patientService.createConditionFromDetectedEntity(this.patient!.id, condition);
        this.conditionAdded.emit(newCondition);
      });

    // Save procedures - only save the selected procedure if one is selected
    if (this.selectedProcedure && this.canSaveEntity(this.selectedProcedure)) {
      const newProcedure = this.patientService.createProcedureFromDetectedEntity(
        this.patient!.id, 
        this.selectedProcedure,
        encounter ? encounter.id : undefined
      );
      
      // Check if this procedure would be a duplicate before emitting
      const existingProcedures = this.patientService.getPatientProcedures(this.patient!.id);
      const isDuplicate = this.patientService.isDuplicateProcedure(existingProcedures, newProcedure);
      
      if (!isDuplicate) {
        this.procedureAdded.emit(newProcedure);
      } else {
        // Find the existing procedure with the same SNOMED CT code
        const existingProcedure = existingProcedures.find(existing => {
          const existingCode = this.patientService.extractSnomedCode(existing);
          const newCode = this.patientService.extractSnomedCode(newProcedure);
          return existingCode === newCode;
        });
        
        if (existingProcedure && encounter) {
          // Link the existing procedure to the new encounter
          existingProcedure.encounter = {
            reference: `Encounter/${encounter.id}`,
            display: `Encounter ${encounter.id}`
          };
          
          // Update the existing procedure in storage
          this.patientService.updatePatientProcedure(this.patient!.id, existingProcedure.id, existingProcedure);
          
          // Show info message about linking to existing procedure
          this.snackBar.open(
            `Procedure "${this.selectedProcedure.name}" already exists and has been linked to this encounter.`,
            'Close',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['info-snackbar']
            }
          );
        } else {
          // Show warning for duplicate procedure (fallback)
          this.snackBar.open(
            `Procedure "${this.selectedProcedure.name}" already exists for this patient (duplicate SNOMED CT code detected).`,
            'Close',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['warning-snackbar']
            }
          );
        }
      }
    }


    this.detectedMedications
      .filter(medication => this.canSaveEntity(medication))
      .forEach(medication => {
        const newMedication = this.patientService.createMedicationFromDetectedEntity(this.patient!.id, medication);
        this.medicationAdded.emit(newMedication);
      });

    // Emit encounter after all other entities are processed
    if (encounter) {
      this.encounterAdded.emit(encounter);
    }

    // Show success notification
    const totalSaved = selectedEntities.length;
    if (totalSaved > 0) {
      this.snackBar.open(
        `Successfully saved ${totalSaved} clinical entities and created encounter`,
        'Close',
        {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        }
      );
    }

    // Clear all detected entities after saving
    this.detectedConditions = [];
    this.detectedProcedures = [];
    this.detectedMedications = [];
    
    // Clear encounter form selections
    this.selectedReasonForEncounter = null;
    this.selectedDiagnosis = null;
    this.selectedProcedure = null;
  }

  hasDetectedEntities(): boolean {
    return this.detectedConditions.length > 0 || 
           this.detectedProcedures.length > 0 || 
           this.detectedMedications.length > 0;
  }

  // Encounter form methods
  initializeEncounterForm(): void {
    // Use the same automatic selection logic as before
    // First condition is the reason for encounter
    this.selectedReasonForEncounter = this.detectedConditions.length > 0 ? this.detectedConditions[0] : null;
    
    // Second condition is the diagnosis (or same as reason if only one condition)
    this.selectedDiagnosis = this.detectedConditions.length > 1 ? this.detectedConditions[1] : 
                            (this.detectedConditions.length === 1 ? this.detectedConditions[0] : null);
    
    // First procedure is selected by default
    this.selectedProcedure = this.detectedProcedures.length > 0 ? this.detectedProcedures[0] : null;
  }

  onReasonForEncounterChange(selectedEntity: DetectedEntity | null): void {
    this.selectedReasonForEncounter = selectedEntity;
  }

  onDiagnosisChange(selectedEntity: DetectedEntity | null): void {
    this.selectedDiagnosis = selectedEntity;
  }

  onProcedureChange(selectedEntity: DetectedEntity | null): void {
    this.selectedProcedure = selectedEntity;
  }

  removeDetected(entity: DetectedEntity): void {
    switch (entity.type) {
      case 'condition':
        this.detectedConditions = this.detectedConditions.filter(c => c.id !== entity.id);
        // Maintain sorted order by text position
        this.detectedConditions.sort((a, b) => (a.textPosition || 0) - (b.textPosition || 0));
        break;
      case 'procedure':
        this.detectedProcedures = this.detectedProcedures.filter(p => p.id !== entity.id);
        // Maintain sorted order by text position
        this.detectedProcedures.sort((a, b) => (a.textPosition || 0) - (b.textPosition || 0));
        break;
      case 'medication':
        this.detectedMedications = this.detectedMedications.filter(m => m.id !== entity.id);
        // Maintain sorted order by text position
        this.detectedMedications.sort((a, b) => (a.textPosition || 0) - (b.textPosition || 0));
        break;
    }
    
    // Re-apply highlighting to reflect the removal
    this.applyHighlights();
  }

  getTooltipText(detectedText: string): string {
    return `Found: "${detectedText}"`;
  }

  addSampleText(): void {
    const sampleTexts = [
      "Patient presents with acute chest pain. Diagnosed with acute myocardial infarction. Emergency percutaneous coronary angioplasty performed to restore blood flow. Currently prescribed aspirin 81mg daily and metoprolol for cardiac management.",
      "Patient visits for severe abdominal pain in right lower quadrant. Clinical examination and imaging confirm acute appendicitis. Emergency laparoscopic appendectomy performed successfully. Post-operative management includes ibuprofen for pain control and monitoring for complications.",
      "Patient presents with rectal bleeding and change in bowel habits over the past month. Clinical evaluation and colonoscopy reveal adenomatous polyps as the source of bleeding. Colonoscopy with polypectomy performed to remove multiple polyps. Patient prescribed iron supplements for mild anemia and scheduled for surveillance colonoscopy."
    ];

    const selectedSample = sampleTexts[this.currentSampleIndex];
    
    // Move to next sample for next time (cycle back to 0 when reaching the end)
    this.currentSampleIndex = (this.currentSampleIndex + 1) % sampleTexts.length;
    
    // Clear previous detections
    this.detectedConditions = [];
    this.detectedProcedures = [];
    this.detectedMedications = [];
    
    // Clear existing content and add sample text
    this.clinicalText = selectedSample;
    
    // Update the editable div content
    if (this.editableDiv && this.editableDiv.nativeElement) {
      this.editableDiv.nativeElement.textContent = selectedSample;
    }
    
    // Trigger detection
    this.onTextChange();
  }

  getHighlightedText(): string {
    if (!this.clinicalText) return '';
    
    let highlightedText = this.clinicalText;
    const allDetections: DetectedEntity[] = [
      ...this.detectedConditions,
      ...this.detectedProcedures,
      ...this.detectedMedications
    ];

    if (allDetections.length === 0) {
      return highlightedText;
    }

    // Create a map of all terms to highlight with their classes
    const termMap = new Map<string, string>();
    
    allDetections.forEach(detection => {
      // Use the actual detected text (matched keyword) instead of hardcoded terms
      const detectedText = detection.detectedText.toLowerCase();
      const colorClass = this.getHighlightClass(detection.type);
      termMap.set(detectedText, colorClass);
    });

    // Sort terms by length (longest first) to avoid partial replacements
    const sortedTerms = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);

    // Apply highlights
    sortedTerms.forEach(term => {
      const colorClass = termMap.get(term);
      const regex = new RegExp(`\\b(${this.escapeRegExp(term)})\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<span class="${colorClass}">$1</span>`);
    });

    return highlightedText;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private applyHighlights(): void {
    if (!this.editableDiv || this.isUpdatingContent) return;

    this.isUpdatingContent = true;

    // Save current cursor position
    const selection = window.getSelection();
    let cursorPosition = 0;
    let cursorNode: Node | null = null;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPosition = this.getCursorPosition(this.editableDiv.nativeElement);
    }

    // Apply highlights
    const highlightedHTML = this.getHighlightedText();
    this.editableDiv.nativeElement.innerHTML = highlightedHTML;

    // Restore cursor position
    this.setCursorPosition(this.editableDiv.nativeElement, cursorPosition);

    this.isUpdatingContent = false;
  }

  private getCursorPosition(element: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  }

  private setCursorPosition(element: HTMLElement, position: number): void {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    let charCount = 0;
    let node: Node | null = null;
    let offset = 0;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    while (node = walker.nextNode()) {
      const textLength = node.textContent?.length || 0;
      if (charCount + textLength >= position) {
        offset = position - charCount;
        break;
      }
      charCount += textLength;
    }

    if (node) {
      range.setStart(node, offset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }


  private getHighlightClass(type: string): string {
    switch (type) {
      case 'condition': return 'highlight-condition';
      case 'procedure': return 'highlight-procedure';
      case 'medication': return 'highlight-medication';
      default: return 'highlight-default';
    }
  }

  // Check if a detected entity already exists in patient data

  // Get display text for existing entity status
  getExistingStatusText(entity: DetectedEntity): string {
    if (entity.isExisting) {
      return `Already exists in problems list`;
    }
    return '';
  }

  // Check if entity can be saved (not already existing)
  canSaveEntity(entity: DetectedEntity): boolean {
    return !entity.isExisting;
  }
}
