import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Patient, Condition, Procedure, MedicationStatement, PatientService } from '../../services/patient.service';

interface DetectedEntity {
  id: string;
  name: string;
  type: 'condition' | 'procedure' | 'medication';
  confidence: number;
  detectedText: string;
  conceptId?: string;
  alreadyExists?: boolean;
  existingEntityId?: string;
}

@Component({
  selector: 'app-ai-assisted-entry',
  templateUrl: './ai-assisted-entry.component.html',
  styleUrls: ['./ai-assisted-entry.component.css'],
  standalone: false
})
export class AiAssistedEntryComponent implements OnInit {
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

  constructor(
    private patientService: PatientService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Component initialization
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
      this.performMockDetection();
      this.applyHighlights();
      this.isProcessing = false;
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

  private performMockDetection(): void {
    // Reset detected entities
    this.detectedConditions = [];
    this.detectedProcedures = [];
    this.detectedMedications = [];

    if (!this.clinicalText || this.clinicalText.trim().length === 0) {
      return;
    }

    const text = this.clinicalText.toLowerCase();

    // Mock detection for "asthma"
    if (text.includes('asthma')) {
      const asthmaEntity: DetectedEntity = {
        id: 'detected-asthma-' + Date.now(),
        name: 'Asthma',
        type: 'condition',
        confidence: 95,
        detectedText: this.extractDetectedText('asthma'),
        conceptId: '195967001' // SNOMED CT code for asthma
      };
      this.detectedConditions.push(this.checkForExistingEntity(asthmaEntity));
    }

    // Additional mock detections for conditions
    if (text.includes('diabetes')) {
      const diabetesEntity: DetectedEntity = {
        id: 'detected-diabetes-' + Date.now(),
        name: 'Diabetes mellitus',
        type: 'condition',
        confidence: 92,
        detectedText: this.extractDetectedText('diabetes'),
        conceptId: '73211009'
      };
      this.detectedConditions.push(this.checkForExistingEntity(diabetesEntity));
    }

    if (text.includes('hypertension') || text.includes('high blood pressure')) {
      const hypertensionEntity: DetectedEntity = {
        id: 'detected-hypertension-' + Date.now(),
        name: 'Hypertension',
        type: 'condition',
        confidence: 90,
        detectedText: this.extractDetectedText('hypertension|high blood pressure'),
        conceptId: '38341003'
      };
      this.detectedConditions.push(this.checkForExistingEntity(hypertensionEntity));
    }

    // Mock detections for procedures
    if (text.includes('surgery') || text.includes('operation') || text.includes('appendectomy')) {
      const surgeryEntity: DetectedEntity = {
        id: 'detected-surgery-' + Date.now(),
        name: 'Appendectomy',
        type: 'procedure',
        confidence: 88,
        detectedText: this.extractDetectedText('surgery|operation|appendectomy'),
        conceptId: '80146002'
      };
      this.detectedProcedures.push(this.checkForExistingEntity(surgeryEntity));
    }

    if (text.includes('x-ray') || text.includes('radiography') || text.includes('chest x-ray')) {
      const xrayEntity: DetectedEntity = {
        id: 'detected-xray-' + Date.now(),
        name: 'Chest X-ray',
        type: 'procedure',
        confidence: 95,
        detectedText: this.extractDetectedText('x-ray|radiography|chest x-ray'),
        conceptId: '399208008'
      };
      this.detectedProcedures.push(this.checkForExistingEntity(xrayEntity));
    }

    if (text.includes('biopsy')) {
      const biopsyEntity: DetectedEntity = {
        id: 'detected-biopsy-' + Date.now(),
        name: 'Tissue biopsy',
        type: 'procedure',
        confidence: 90,
        detectedText: this.extractDetectedText('biopsy'),
        conceptId: '86273004'
      };
      this.detectedProcedures.push(this.checkForExistingEntity(biopsyEntity));
    }

    // Mock detections for medications
    if (text.includes('aspirin') || text.includes('acetylsalicylic acid')) {
      const aspirinEntity: DetectedEntity = {
        id: 'detected-aspirin-' + Date.now(),
        name: 'Aspirin',
        type: 'medication',
        confidence: 96,
        detectedText: this.extractDetectedText('aspirin|acetylsalicylic acid'),
        conceptId: '387458008'
      };
      this.detectedMedications.push(this.checkForExistingEntity(aspirinEntity));
    }

    if (text.includes('insulin')) {
      const insulinEntity: DetectedEntity = {
        id: 'detected-insulin-' + Date.now(),
        name: 'Insulin',
        type: 'medication',
        confidence: 94,
        detectedText: this.extractDetectedText('insulin'),
        conceptId: '412210000'
      };
      this.detectedMedications.push(this.checkForExistingEntity(insulinEntity));
    }

    if (text.includes('ibuprofen') || text.includes('advil') || text.includes('motrin')) {
      const ibuprofenEntity: DetectedEntity = {
        id: 'detected-ibuprofen-' + Date.now(),
        name: 'Ibuprofen',
        type: 'medication',
        confidence: 93,
        detectedText: this.extractDetectedText('ibuprofen|advil|motrin'),
        conceptId: '387207008'
      };
      this.detectedMedications.push(this.checkForExistingEntity(ibuprofenEntity));
    }
    
    // Initialize encounter form with default selections after detection
    this.initializeEncounterForm();
  }

  private extractDetectedText(searchTerm: string): string {
    const terms = searchTerm.split('|');
    const text = this.clinicalText.toLowerCase();
    
    for (const term of terms) {
      const index = text.indexOf(term);
      if (index !== -1) {
        // Extract context around the found term, preserving word boundaries
        let start = Math.max(0, index - 15);
        let end = Math.min(text.length, index + term.length + 15);
        
        // Adjust start to avoid cutting words in half
        if (start > 0) {
          const spaceIndex = this.clinicalText.lastIndexOf(' ', start + 5);
          if (spaceIndex > start - 10 && spaceIndex < start + 5) {
            start = spaceIndex + 1;
          }
        }
        
        // Adjust end to avoid cutting words in half
        if (end < text.length) {
          const spaceIndex = this.clinicalText.indexOf(' ', end - 5);
          if (spaceIndex > end - 5 && spaceIndex < end + 10) {
            end = spaceIndex;
          }
        }
        
        const extractedText = this.clinicalText.substring(start, end).trim();
        return this.truncateWithEllipsis(extractedText, 30); // Increased to 30 characters
      }
    }
    return searchTerm;
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
        break;
      case 'procedure':
        this.detectedProcedures = this.detectedProcedures.filter(p => p.id !== entity.id);
        break;
      case 'medication':
        this.detectedMedications = this.detectedMedications.filter(m => m.id !== entity.id);
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
      "Patient presents with chronic asthma and type 2 diabetes. Recent surgery performed last month. Currently taking aspirin 81mg daily and insulin as needed. Patient reports shortness of breath and requires chest X-ray. Scheduled for cardiac procedure next week.",
      "The patient has a history of hypertension and underwent appendectomy two years ago. Currently prescribed ibuprofen for pain management and insulin for diabetes control. Needs follow-up biopsy to rule out malignancy.",
      "Clinical assessment reveals asthma exacerbation. Patient scheduled for endoscopic procedure. Current medications include aspirin for cardiovascular protection. Blood pressure monitoring shows hypertension requiring adjustment of current treatment plan."
    ];

    const randomSample = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    
    // Clear previous detections
    this.detectedConditions = [];
    this.detectedProcedures = [];
    this.detectedMedications = [];
    
    // Clear existing content and add sample text
    this.clinicalText = randomSample;
    
    // Update the editable div content
    if (this.editableDiv && this.editableDiv.nativeElement) {
      this.editableDiv.nativeElement.textContent = randomSample;
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
      const searchTerms = this.getSearchTerms(detection);
      const colorClass = this.getHighlightClass(detection.type);
      
      searchTerms.forEach(term => {
        termMap.set(term.toLowerCase(), colorClass);
      });
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

  private getSearchTerms(detection: DetectedEntity): string[] {
    // Map detection names to search terms
    const termMap: { [key: string]: string[] } = {
      'Asthma': ['asthma'],
      'Diabetes mellitus': ['diabetes'],
      'Hypertension': ['hypertension', 'high blood pressure'],
      'Appendectomy': ['surgery', 'operation', 'appendectomy'],
      'Chest X-ray': ['x-ray', 'radiography', 'chest x-ray'],
      'Tissue biopsy': ['biopsy'],
      'Aspirin': ['aspirin', 'acetylsalicylic acid'],
      'Insulin': ['insulin'],
      'Ibuprofen': ['ibuprofen', 'advil', 'motrin']
    };
    
    return termMap[detection.name] || [detection.name.toLowerCase()];
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
  private checkForExistingEntity(entity: DetectedEntity): DetectedEntity {
    const existingEntity = this.findExistingEntity(entity);
    if (existingEntity) {
      entity.alreadyExists = true;
      entity.existingEntityId = existingEntity.id;
    } else {
      entity.alreadyExists = false;
      entity.existingEntityId = undefined;
    }
    return entity;
  }

  private findExistingEntity(entity: DetectedEntity): any {
    switch (entity.type) {
      case 'condition':
        return this.conditions.find(condition => 
          this.isEntityMatch(condition, entity)
        );
      case 'procedure':
        return this.procedures.find(procedure => 
          this.isEntityMatch(procedure, entity)
        );
      case 'medication':
        return this.medications.find(medication => 
          this.isEntityMatch(medication, entity)
        );
      default:
        return null;
    }
  }

  private isEntityMatch(existingEntity: any, detectedEntity: DetectedEntity): boolean {
    // Check by concept ID first (most reliable)
    if (detectedEntity.conceptId && existingEntity.code?.coding) {
      const existingCode = existingEntity.code.coding.find((coding: any) => 
        coding.system === 'http://snomed.info/sct' && coding.code === detectedEntity.conceptId
      );
      if (existingCode) return true;
    }

    // Check by display name (fallback)
    const existingDisplay = this.getEntityDisplayName(existingEntity);
    if (existingDisplay && existingDisplay.toLowerCase() === detectedEntity.name.toLowerCase()) {
      return true;
    }

    return false;
  }

  private getEntityDisplayName(entity: any): string {
    if (entity.code?.text) return entity.code.text;
    if (entity.code?.coding?.[0]?.display) return entity.code.coding[0].display;
    if (entity.medicationCodeableConcept?.text) return entity.medicationCodeableConcept.text;
    if (entity.medicationCodeableConcept?.coding?.[0]?.display) return entity.medicationCodeableConcept.coding[0].display;
    return '';
  }

  // Get display text for existing entity status
  getExistingStatusText(entity: DetectedEntity): string {
    if (entity.alreadyExists) {
      return `Already exists in problems list`;
    }
    return '';
  }

  // Check if entity can be saved (not already existing)
  canSaveEntity(entity: DetectedEntity): boolean {
    return !entity.alreadyExists;
  }
}
