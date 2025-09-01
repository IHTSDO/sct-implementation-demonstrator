import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService, Patient, Condition, Procedure, MedicationRequest } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { ClinicalEntryComponent } from '../clinical-entry/clinical-entry.component';
import { Subscription, forkJoin, of, delay } from 'rxjs';

export interface AnchorPoint {
  id: string;
  name: string;
  x: number; // Percentage (0-100) from left
  y: number; // Percentage (0-100) from top
  ecl: string; // Expression Constraint Language for SNOMED CT concepts
  description: string;
  anatomicalSystem?: string;
  defaultColor?: string;
}

@Component({
  selector: 'app-clinical-record',
  templateUrl: './clinical-record.component.html',
  styleUrls: ['./clinical-record.component.css'],
  standalone: false
})
export class ClinicalRecordComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('conditionEntry') conditionEntry!: ClinicalEntryComponent;
  @ViewChild('procedureEntry') procedureEntry!: ClinicalEntryComponent;
  @ViewChild('medicationEntry') medicationEntry!: ClinicalEntryComponent;

  patient: Patient | null = null;
  conditions: Condition[] = [];
  procedures: Procedure[] = [];
  medications: MedicationRequest[] = [];
  currentDate = new Date();
  private subscriptions: Subscription[] = [];
  
  // ECL expansion results for anchor point mapping
  private anchorPointMappings = new Map<string, string[]>(); // anchorPointId -> array of concept IDs
  
  // Loading state for ECL mapping
  isLoadingMapping = false;

  // No separate cache needed - we'll add location directly to the clinical events

  // Anchor points for clinical event mapping - simplified list
  anchorPoints: AnchorPoint[] = [
    {
      id: 'head',
      name: 'Head',
      x: 48,
      y: 11,
      ecl: '<< 69536005 |Head structure| OR << 25238003 |Cranial structure|',
      description: 'Brain, skull, face, neurological and head-related conditions',
      anatomicalSystem: 'head',
      defaultColor: '#FF6B6B'
    },
    {
      id: 'neck',
      name: 'Neck',
      x: 48,
      y: 18,
      ecl: '<< 45048000 |Neck structure| OR << 54066008 |Pharyngeal structure| OR << 69748006 |Thyroid structure|',
      description: 'Neck, throat, thyroid, cervical spine conditions',
      anatomicalSystem: 'neck',
      defaultColor: '#82E0AA'
    },
    {
      id: 'thorax',
      name: 'Thorax',
      x: 48,
      y: 25,
      ecl: '<< 51185008 |Thoracic structure|',
      description: 'Chest, lungs, heart, respiratory and cardiovascular conditions',
      anatomicalSystem: 'thorax',
      defaultColor: '#45B7D1'
    },
    {
      id: 'abdomen',
      name: 'Abdomen',
      x: 48,
      y: 39,
      ecl: '<< 818983003 |Abdomen structure|',
      description: 'Abdominal organs, digestive system, liver, kidneys conditions',
      anatomicalSystem: 'abdomen',
      defaultColor: '#BB8FCE'
    },
    {
      id: 'pelvis',
      name: 'Pelvis',
      x: 48,
      y: 48,
      ecl: '<< 12921003 |Pelvis structure| OR 21514008 |Structure of genitourinary system (body structure)|',
      description: 'Pelvic organs, reproductive system, bladder, hip conditions',
      anatomicalSystem: 'pelvis',
      defaultColor: '#F8C471'
    },
    {
      id: 'arms',
      name: 'Arms',
      x: 73,
      y: 40,
      ecl: '<< 53120007 |Upper limb structure (body structure)|',
      description: 'Arms, shoulders, hands, upper extremity conditions',
      anatomicalSystem: 'arms',
      defaultColor: '#85C1E9'
    },
    {
      id: 'legs',
      name: 'Legs',
      x: 60,
      y: 78,
      ecl: '<< 61685007 |Lower limb structure (body structure)|',
      description: 'Legs, knees, feet, lower extremity conditions',
      anatomicalSystem: 'legs',
      defaultColor: '#85C1E9'
    },
    {
      id: 'systemic',
      name: 'Systemic',
      x: 70,
      y: 12,
      ecl: '',
      description: 'General systemic conditions, multiple system disorders, skin conditions',
      anatomicalSystem: 'systemic',
      defaultColor: '#AED6F1'
    }
  ];

  constructor(
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private terminologyService: TerminologyService
  ) { }

  ngOnInit(): void {
    // Subscribe to selected patient
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.patient = patient;
        if (patient) {
          this.loadClinicalData(patient.id);
        } else {
          this.router.navigate(['/benefits-demo']);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngAfterViewInit(): void {
    // Connection lines are now handled dynamically via hover events
  }

  goBack(): void {
    this.router.navigate(['/benefits-demo']);
  }

  getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) {
        return name.text;
      }
      if (name.given && name.family) {
        return `${name.given.join(' ')} ${name.family}`;
      }
      if (name.family) {
        return name.family;
      }
    }
    return `Patient ${patient.id}`;
  }

  getPatientAge(birthDate: string | undefined): string {
    if (!birthDate) return 'Unknown';
    
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return `${age - 1} years`;
    }
    return `${age} years`;
  }

  getPatientIdentifier(patient: Patient): string {
    if (patient.identifier && patient.identifier.length > 0) {
      return patient.identifier[0].value;
    }
    return patient.id;
  }

  getBodyModelImage(gender: string | undefined): string {
    if (gender === 'female') {
      return 'assets/img/body-model-female.png';
    } else if (gender === 'male') {
      return 'assets/img/body-model-male.png';
    } else {
      // Default to male model if gender is unknown
      return 'assets/img/body-model-male.png';
    }
  }

  loadClinicalData(patientId: string): void {
    // Try to load cached data first, fallback to service if not found
    this.conditions = this.loadCachedOrFreshData('conditions', patientId, () => this.patientService.getPatientConditions(patientId));
    this.procedures = this.loadCachedOrFreshData('procedures', patientId, () => this.patientService.getPatientProcedures(patientId));
    this.medications = this.loadCachedOrFreshData('medications', patientId, () => this.patientService.getPatientMedications(patientId));
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  }

  getConditionStatus(condition: Condition): string {
    if (condition.clinicalStatus?.text) {
      return condition.clinicalStatus.text;
    }
    if (condition.clinicalStatus?.coding && condition.clinicalStatus.coding.length > 0) {
      return condition.clinicalStatus.coding[0].display || condition.clinicalStatus.coding[0].code || 'Unknown';
    }
    return 'Unknown';
  }

  getProcedureStatus(procedure: Procedure): string {
    return procedure.status || 'Unknown';
  }

  getMedicationStatus(medication: MedicationRequest): string {
    return medication.status || 'Unknown';
  }

  toggleConditionEntry(): void {
    this.conditionEntry.toggleAddForm();
  }

  onConditionAdded(event: any): void {
    this.loadClinicalData(this.patient!.id);
  }

  toggleProcedureEntry(): void {
    this.procedureEntry.toggleAddForm();
  }

  onProcedureAdded(event: any): void {
    this.loadClinicalData(this.patient!.id);
  }

  toggleMedicationEntry(): void {
    this.medicationEntry.toggleAddForm();
  }

  onMedicationAdded(event: any): void {
    this.loadClinicalData(this.patient!.id);
  }

  // Legacy connection line methods removed - now using dynamic hover-based connections

  getConceptId(resource: any): string {
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].code;
    }
    return '';
  }

  deleteCondition(conditionId: string): void {
    if (!this.patient) return;
    
    const condition = this.conditions.find(c => c.id === conditionId);
    if (condition && confirm(`Are you sure you want to delete the condition "${condition.code.text}"?`)) {
      this.patientService.deletePatientCondition(this.patient.id, conditionId);
      this.loadClinicalData(this.patient.id);
    }
  }

  deleteProcedure(procedureId: string): void {
    if (!this.patient) return;
    
    const procedure = this.procedures.find(p => p.id === procedureId);
    if (procedure && confirm(`Are you sure you want to delete the procedure "${procedure.code.text}"?`)) {
      this.patientService.deletePatientProcedure(this.patient.id, procedureId);
      this.loadClinicalData(this.patient.id);
    }
  }

  deleteMedication(medicationId: string): void {
    if (!this.patient) return;
    
    const medication = this.medications.find(m => m.id === medicationId);
    if (medication && confirm(`Are you sure you want to delete the medication "${medication.medicationCodeableConcept?.text}"?`)) {
      this.patientService.deletePatientMedication(this.patient.id, medicationId);
      this.loadClinicalData(this.patient.id);
    }
  }

  /**
   * Get anchor points filtered by anatomical system
   */
  getAnchorPointsBySystem(system?: string): AnchorPoint[] {
    if (!system) {
      return this.anchorPoints;
    }
    return this.anchorPoints.filter(point => point.anatomicalSystem === system);
  }

  /**
   * Find the best matching anchor point for a clinical event based on SNOMED CT concept
   * Uses ECL expansion results if available, otherwise defaults to systemic
   */
  findBestAnchorPointForConcept(conceptId: string): AnchorPoint | null {
    // First check if any clinical event has a cached location for this concept
    const cachedLocation = this.getCachedLocationForConcept(conceptId);
    if (cachedLocation) {
      return this.anchorPoints.find(p => p.id === cachedLocation) || null;
    }
    
    // If ECL expansion has been performed and we have mappings, use them
    if (this.anchorPointMappings.size > 0) {
      return this.findBestAnchorPointForConceptUsingEcl(conceptId);
    }
    
    // Default assignment: all conditions go to systemic category
    // This is used before ECL expansion is performed
    return this.anchorPoints.find(p => p.id === 'systemic') || null;
  }

  /**
   * Get all clinical events with their mapped anchor points
   */
  getClinicalEventsWithAnchorPoints(): Array<{event: any, anchorPoint: AnchorPoint | null, type: string}> {
    const eventsWithAnchors: Array<{event: any, anchorPoint: AnchorPoint | null, type: string}> = [];
    
    // Map conditions
    this.conditions.forEach(condition => {
      const conceptId = this.getConceptId(condition);
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: condition,
        anchorPoint: anchorPoint,
        type: 'condition'
      });
    });

    // Map procedures  
    this.procedures.forEach(procedure => {
      const conceptId = this.getConceptId(procedure);
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: procedure,
        anchorPoint: anchorPoint,
        type: 'procedure'
      });
    });

    // Map medications
    this.medications.forEach(medication => {
      const conceptId = this.getConceptId(medication);
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: medication,
        anchorPoint: anchorPoint,
        type: 'medication'
      });
    });

    return eventsWithAnchors;
  }

  /**
   * Get anchor points that have clinical events mapped to them
   */
  getActiveAnchorPoints(): AnchorPoint[] {
    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    const activeAnchorIds = new Set(
      clinicalEvents
        .filter(item => item.anchorPoint !== null)
        .map(item => item.anchorPoint!.id)
    );
    
    return this.anchorPoints.filter(point => activeAnchorIds.has(point.id));
  }

  /**
   * Get the count of clinical events for a specific anchor point
   */
  getEventCountForAnchorPoint(anchorPointId: string): number {
    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    return clinicalEvents.filter(item => 
      item.anchorPoint && item.anchorPoint.id === anchorPointId
    ).length;
  }

  /**
   * Get all anatomical systems that have anchor points
   */
  getAnatomicalSystems(): string[] {
    const systems = new Set(this.anchorPoints.map(point => point.anatomicalSystem).filter(Boolean));
    return Array.from(systems) as string[];
  }

  /**
   * Handle condition hover - show connection line to anchor point
   */
  onConditionHover(condition: any, event: MouseEvent): void {
    const conceptId = this.getConceptId(condition);
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      // Use currentTarget to get the element that has the event listener
      const conditionElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(conditionElement, anchorPoint);
    }
  }

  /**
   * Handle condition hover end - hide connection line
   */
  onConditionHoverEnd(): void {
    this.hideConnectionLine();
  }

  /**
   * Handle procedure hover - show connection line to anchor point
   */
  onProcedureHover(procedure: any, event: MouseEvent): void {
    const conceptId = this.getConceptId(procedure);
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      const procedureElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(procedureElement, anchorPoint);
    }
  }

  /**
   * Handle medication hover - show connection line to anchor point
   */
  onMedicationHover(medication: any, event: MouseEvent): void {
    const conceptId = this.getConceptId(medication);
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      const medicationElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(medicationElement, anchorPoint);
    }
  }

  /**
   * Handle anchor point hover - show all connections and highlight related events
   */
  onAnchorPointHover(anchorPoint: AnchorPoint, event: MouseEvent): void {
    this.showAllConnectionsForAnchorPoint(anchorPoint);
    this.highlightRelatedClinicalEvents(anchorPoint);
  }

  /**
   * Handle anchor point hover end - hide all connections and remove highlights
   */
  onAnchorPointHoverEnd(): void {
    this.hideAllConnections();
    this.removeAllEventHighlights();
  }

  /**
   * Show connection line from condition to anchor point
   */
  private showConnectionLine(conditionElement: HTMLElement, anchorPoint: AnchorPoint): void {
    // Find the anchor point element on the body model
    const anchorElement = document.querySelector(`[data-anchor-id="${anchorPoint.id}"]`) as HTMLElement;
    if (!anchorElement) return;

    // Get or create the connection line element
    let connectionLine = document.getElementById('hover-connection-line');
    if (!connectionLine) {
      connectionLine = document.createElement('div');
      connectionLine.id = 'hover-connection-line';
      connectionLine.className = 'hover-connection-line';
      document.body.appendChild(connectionLine);
    }

    // Calculate positions
    const conditionRect = conditionElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();

    // Calculate line position and angle - start from right edge of anchor point to left border of condition box
    const startX = anchorRect.left + anchorRect.width;
    const startY = anchorRect.top + anchorRect.height / 2;
    const endX = conditionRect.left;
    const endY = conditionRect.top + conditionRect.height / 2;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Apply styles to the connection line
    connectionLine.style.display = 'block';
    connectionLine.style.position = 'fixed';
    connectionLine.style.left = `${startX}px`;
    connectionLine.style.top = `${startY}px`;
    connectionLine.style.width = `${distance}px`;
    connectionLine.style.height = '1px';
    connectionLine.style.backgroundColor = '#ff0000';
    connectionLine.style.transformOrigin = '0 50%';
    connectionLine.style.transform = `rotate(${angle}deg)`;
    connectionLine.style.zIndex = '10000';
    connectionLine.style.pointerEvents = 'none';
    connectionLine.style.opacity = '1';
    connectionLine.style.boxShadow = '0 0 8px rgba(255,0,0,0.6)';
    connectionLine.style.borderRadius = '2px';

    // Add discrete scaling to anchor point
    anchorElement.classList.add('scaled');
  }

  /**
   * Hide connection line
   */
  private hideConnectionLine(): void {
    const connectionLine = document.getElementById('hover-connection-line');
    if (connectionLine) {
      connectionLine.style.display = 'none';
    }

    // Remove scaling from all anchor points
    const anchorElements = document.querySelectorAll('[data-anchor-id]');
    anchorElements.forEach(element => {
      element.classList.remove('scaled');
    });
  }

  /**
   * Show all connection lines for a specific anchor point
   */
  private showAllConnectionsForAnchorPoint(anchorPoint: AnchorPoint): void {
    const anchorElement = document.querySelector(`[data-anchor-id="${anchorPoint.id}"]`) as HTMLElement;
    if (!anchorElement) return;

    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    const relatedEvents = clinicalEvents.filter(item => 
      item.anchorPoint && item.anchorPoint.id === anchorPoint.id
    );

    relatedEvents.forEach((eventItem, index) => {
      // Find the corresponding element in the summary
      const eventElements = document.querySelectorAll('.hoverable-summary-condition');
      let eventElement: HTMLElement | null = null;

      // Match the event with its DOM element
      if (eventItem.type === 'condition') {
        const conditionIndex = this.conditions.findIndex(c => c.id === eventItem.event.id);
        if (conditionIndex >= 0 && conditionIndex < 6) { // Only first 6 are shown in summary
          eventElement = eventElements[conditionIndex] as HTMLElement;
        }
      } else if (eventItem.type === 'procedure') {
        const procedureIndex = this.procedures.findIndex(p => p.id === eventItem.event.id);
        const conditionsCount = Math.min(this.conditions.length, 6);
        if (procedureIndex >= 0 && procedureIndex < 4) { // Only first 4 are shown
          eventElement = eventElements[conditionsCount + procedureIndex] as HTMLElement;
        }
      } else if (eventItem.type === 'medication') {
        const medicationIndex = this.medications.findIndex(m => m.id === eventItem.event.id);
        const conditionsCount = Math.min(this.conditions.length, 6);
        const proceduresCount = Math.min(this.procedures.length, 4);
        if (medicationIndex >= 0 && medicationIndex < 4) { // Only first 4 are shown
          eventElement = eventElements[conditionsCount + proceduresCount + medicationIndex] as HTMLElement;
        }
      }

      if (eventElement) {
        this.createConnectionLine(eventElement, anchorElement, `anchor-connection-${index}`);
      }
    });

    // Add scaling effect to the anchor point
    anchorElement.classList.add('scaled');
  }

  /**
   * Create a named connection line
   */
  private createConnectionLine(startElement: HTMLElement, endElement: HTMLElement, lineId: string): void {
    // Remove existing line with this ID
    const existingLine = document.getElementById(lineId);
    if (existingLine) {
      existingLine.remove();
    }

    // Calculate positions
    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();

    const startX = endRect.left + endRect.width;
    const startY = endRect.top + endRect.height / 2;
    const endX = startRect.left;
    const endY = startRect.top + startRect.height / 2;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Create connection line
    const connectionLine = document.createElement('div');
    connectionLine.id = lineId;
    connectionLine.className = 'anchor-connection-line';
    document.body.appendChild(connectionLine);

    // Apply styles
    connectionLine.style.display = 'block';
    connectionLine.style.position = 'fixed';
    connectionLine.style.left = `${startX}px`;
    connectionLine.style.top = `${startY}px`;
    connectionLine.style.width = `${distance}px`;
    connectionLine.style.height = '1px';
    connectionLine.style.backgroundColor = '#ff0000';
    connectionLine.style.transformOrigin = '0 50%';
    connectionLine.style.transform = `rotate(${angle}deg)`;
    connectionLine.style.zIndex = '10000';
    connectionLine.style.pointerEvents = 'none';
    connectionLine.style.opacity = '1';
    connectionLine.style.boxShadow = '0 0 4px rgba(255, 0, 0, 0.4)';
    connectionLine.style.borderRadius = '0.5px';
  }

  /**
   * Hide all connection lines
   */
  private hideAllConnections(): void {
    // Remove all anchor connection lines
    const anchorLines = document.querySelectorAll('.anchor-connection-line');
    anchorLines.forEach(line => line.remove());

    // Hide single hover connection line
    this.hideConnectionLine();
  }

  /**
   * Highlight all clinical events related to an anchor point
   */
  private highlightRelatedClinicalEvents(anchorPoint: AnchorPoint): void {
    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    const relatedEvents = clinicalEvents.filter(item => 
      item.anchorPoint && item.anchorPoint.id === anchorPoint.id
    );

    relatedEvents.forEach((eventItem) => {
      const eventElements = document.querySelectorAll('.hoverable-summary-condition');
      let eventElement: HTMLElement | null = null;

      // Find the corresponding DOM element
      if (eventItem.type === 'condition') {
        const conditionIndex = this.conditions.findIndex(c => c.id === eventItem.event.id);
        if (conditionIndex >= 0 && conditionIndex < 6) {
          eventElement = eventElements[conditionIndex] as HTMLElement;
        }
      } else if (eventItem.type === 'procedure') {
        const procedureIndex = this.procedures.findIndex(p => p.id === eventItem.event.id);
        const conditionsCount = Math.min(this.conditions.length, 6);
        if (procedureIndex >= 0 && procedureIndex < 4) {
          eventElement = eventElements[conditionsCount + procedureIndex] as HTMLElement;
        }
      } else if (eventItem.type === 'medication') {
        const medicationIndex = this.medications.findIndex(m => m.id === eventItem.event.id);
        const conditionsCount = Math.min(this.conditions.length, 6);
        const proceduresCount = Math.min(this.procedures.length, 4);
        if (medicationIndex >= 0 && medicationIndex < 4) {
          eventElement = eventElements[conditionsCount + proceduresCount + medicationIndex] as HTMLElement;
        }
      }

      if (eventElement) {
        eventElement.classList.add('anchor-highlighted');
      }
    });
  }

  /**
   * Remove highlights from all clinical events
   */
  private removeAllEventHighlights(): void {
    const highlightedElements = document.querySelectorAll('.anchor-highlighted');
    highlightedElements.forEach(element => {
      element.classList.remove('anchor-highlighted');
    });

    // Remove scaling from anchor points
    const anchorElements = document.querySelectorAll('[data-anchor-id]');
    anchorElements.forEach(element => {
      element.classList.remove('scaled');
    });
  }

  /**
   * Perform ECL expansion for all anchor points to determine proper condition and procedure mappings
   */
  async performAnchorPointEclExpansion(): Promise<void> {
    if ((!this.conditions || this.conditions.length === 0) && (!this.procedures || this.procedures.length === 0)) {
      console.log('No conditions or procedures to process');
      return;
    }

    // Set loading state
    this.isLoadingMapping = true;

    try {
      // Filter out systemic anchor point - it should not be processed
      const anchorPointsToProcess = this.anchorPoints.filter(ap => ap.id !== 'systemic');
      
      // Process each anchor point with iterative removal of mapped events
      for (const anchorPoint of anchorPointsToProcess) {
        try {
          // Get currently unmapped events for this iteration
          const unmappedEvents = this.getUnmappedEvents();
          
          // Get concept IDs from unmapped conditions and procedures
          const unmappedConditionIds = unmappedEvents.conditions.map(condition => this.getConceptId(condition)).filter(id => id);
          const unmappedProcedureIds = unmappedEvents.procedures.map(procedure => this.getConceptId(procedure)).filter(id => id);
          
          // Combine both conditions and procedures
          const allUnmappedIds = [...unmappedConditionIds, ...unmappedProcedureIds];
          
          if (allUnmappedIds.length === 0) {
            console.log(`No unmapped events remaining for anchor point: ${anchorPoint.name}`);
            continue;
          }

          // Build the OR clause with all unmapped events (conditions and procedures)
          const eventOrClause = allUnmappedIds.join(' OR ');
          
          console.log(`Processing ${allUnmappedIds.length} unmapped events for anchor point: ${anchorPoint.name}`);
          console.log(`  - Conditions: ${unmappedConditionIds.length}, Procedures: ${unmappedProcedureIds.length}`);

          await this.processAnchorPointEcl(anchorPoint, eventOrClause);
          
          // Wait 1 second before processing the next anchor point
          await this.delay(1000);
        } catch (error) {
          console.error(`Error processing anchor point ${anchorPoint.id}:`, error);
        }
      }

      // Update clinical events with computed locations and save to storage
      this.updateEventsWithComputedLocations();
      this.saveUpdatedEventsToStorage();
    } finally {
      // Always clear loading state, even if there's an error
      this.isLoadingMapping = false;
    }
  }

  /**
   * Process ECL expansion for a single anchor point
   */
  private async processAnchorPointEcl(anchorPoint: AnchorPoint, eventOrClause: string): Promise<void> {
    // Find conditions and procedures that have finding sites or procedure sites related to this anchor point
    const ecl = `(${eventOrClause}) : ((363698007 |Finding site (attribute)| = (${anchorPoint.ecl})) OR (<< 363704007 |Procedure site (attribute)| = (${anchorPoint.ecl})))`;
    
    console.log(`Processing anchor point: ${anchorPoint.name}`);
    console.log(`ECL query: ${ecl}`);
    


    return new Promise((resolve, reject) => {
      this.terminologyService.expandValueSet(ecl, '', 0, 1000).subscribe({
        next: (response) => {
          try {
            const conceptIds = this.extractConceptIdsFromExpansion(response);
            
            // Filter to only include concepts that are actually in our patient data (conditions and procedures)
            const patientConditionIds = this.conditions.map(c => this.getConceptId(c)).filter(id => id);
            const patientProcedureIds = this.procedures.map(p => this.getConceptId(p)).filter(id => id);
            const allPatientEventIds = [...patientConditionIds, ...patientProcedureIds];
            
            const matchingEventIds = conceptIds.filter(id => allPatientEventIds.includes(id));
            
            // Store the matching event IDs for this anchor point
            const existingMappings = this.anchorPointMappings.get(anchorPoint.id) || [];
            const combinedMappings = [...new Set([...existingMappings, ...matchingEventIds])];
            this.anchorPointMappings.set(anchorPoint.id, combinedMappings);
            
            console.log(`  -> Mapped ${matchingEventIds.length} events to ${anchorPoint.name}`);
            
            // Immediately update the computedLocation for matched events to remove them from future iterations
            this.updateEventLocationsForAnchorPoint(anchorPoint, matchingEventIds);
            

            
            resolve();
          } catch (error) {
            console.error(`Error processing response for ${anchorPoint.name}:`, error);
            resolve(); // Continue with other anchor points even if one fails
          }
        },
        error: (error) => {
          console.error(`ECL expansion failed for ${anchorPoint.name}:`, error);
          resolve(); // Continue with other anchor points even if one fails
        }
      });
    });
  }

  /**
   * Update computedLocation for events that match an anchor point
   */
  private updateEventLocationsForAnchorPoint(anchorPoint: AnchorPoint, matchingEventIds: string[]): void {
    // Update conditions
    this.conditions.forEach(condition => {
      const conceptId = this.getConceptId(condition);
      if (conceptId && matchingEventIds.includes(conceptId)) {
        (condition as any).computedLocation = anchorPoint;
      }
    });

    // Update procedures
    this.procedures.forEach(procedure => {
      const conceptId = this.getConceptId(procedure);
      if (conceptId && matchingEventIds.includes(conceptId)) {
        (procedure as any).computedLocation = anchorPoint;
      }
    });
  }

  /**
   * Extract concept IDs from ECL expansion response
   */
  private extractConceptIdsFromExpansion(response: any): string[] {
    const conceptIds: string[] = [];
    
    if (response?.expansion?.contains) {
      response.expansion.contains.forEach((concept: any) => {
        if (concept.code) {
          conceptIds.push(concept.code);
        }
      });
    }
    
    return conceptIds;
  }

  /**
   * Updated method to find best anchor point using ECL expansion results
   */
  findBestAnchorPointForConceptUsingEcl(conceptId: string): AnchorPoint | null {
    // Check each anchor point mapping to see if this concept ID is included
    for (const [anchorPointId, conceptIds] of this.anchorPointMappings.entries()) {
      if (conceptIds.includes(conceptId)) {
        return this.anchorPoints.find(ap => ap.id === anchorPointId) || null;
      }
    }
    
    // Fall back to systemic if no specific mapping found
    return this.anchorPoints.find(p => p.id === 'systemic') || null;
  }

  /**
   * Utility method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Trigger ECL expansion for current conditions (can be called manually for testing)
   */
  triggerEclExpansion(): void {
    this.performAnchorPointEclExpansion();
  }

  /**
   * Clear cached locations for current patient (for testing purposes)
   */
  clearLocationCache(): void {
    const patientId = this.patient?.id || 'default';
    localStorage.removeItem(`conditions_${patientId}`);
    localStorage.removeItem(`procedures_${patientId}`);
    localStorage.removeItem(`medications_${patientId}`);
    
    // Reload fresh data
    this.loadClinicalData(patientId);
    

  }

  /**
   * Update clinical events with computed anchor point locations
   */
  private updateEventsWithComputedLocations(): void {
    // Update conditions
    this.conditions.forEach(condition => {
      const conceptId = this.getConceptId(condition);
      if (conceptId) {
        const anchorPoint = this.findBestAnchorPointForConceptUsingEcl(conceptId);
        if (anchorPoint) {
          (condition as any).computedLocation = anchorPoint.id;
        }
      }
    });

    // Update procedures
    this.procedures.forEach(procedure => {
      const conceptId = this.getConceptId(procedure);
      if (conceptId) {
        const anchorPoint = this.findBestAnchorPointForConceptUsingEcl(conceptId);
        if (anchorPoint) {
          (procedure as any).computedLocation = anchorPoint.id;
        }
      }
    });

    // Update medications
    this.medications.forEach(medication => {
      const conceptId = this.getConceptId(medication);
      if (conceptId) {
        const anchorPoint = this.findBestAnchorPointForConceptUsingEcl(conceptId);
        if (anchorPoint) {
          (medication as any).computedLocation = anchorPoint.id;
        }
      }
    });
  }

  /**
   * Save updated clinical events to browser storage
   */
  private saveUpdatedEventsToStorage(): void {
    // Save to localStorage with patient-specific keys
    const patientId = this.patient?.id || 'default';
    
    if (this.conditions.length > 0) {
      localStorage.setItem(`conditions_${patientId}`, JSON.stringify(this.conditions));
    }
    
    if (this.procedures.length > 0) {
      localStorage.setItem(`procedures_${patientId}`, JSON.stringify(this.procedures));
    }
    
    if (this.medications.length > 0) {
      localStorage.setItem(`medications_${patientId}`, JSON.stringify(this.medications));
    }
    

  }

  /**
   * Get unmapped events (those without computedLocation)
   */
  private getUnmappedEvents(): { conditions: any[], procedures: any[], medications: any[] } {
    const unmappedConditions = this.conditions.filter(c => !(c as any).computedLocation);
    const unmappedProcedures = this.procedures.filter(p => !(p as any).computedLocation);
    const unmappedMedications = this.medications.filter(m => !(m as any).computedLocation);
    
    return {
      conditions: unmappedConditions,
      procedures: unmappedProcedures, 
      medications: unmappedMedications
    };
  }

  /**
   * Load cached data from localStorage or fallback to fresh data from service
   */
  private loadCachedOrFreshData<T>(dataType: string, patientId: string, getFreshData: () => T[]): T[] {
    const cacheKey = `${dataType}_${patientId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return parsed;
      } catch (error) {
        // Parsing failed, fall through to fresh data
      }
    }
    
    // No cached data or parsing failed, get fresh data
    return getFreshData();
  }

  /**
   * Get cached location for a concept from existing clinical events
   */
  private getCachedLocationForConcept(conceptId: string): string | null {
    // Check conditions
    for (const condition of this.conditions) {
      if (this.getConceptId(condition) === conceptId && (condition as any).computedLocation) {
        return (condition as any).computedLocation;
      }
    }
    
    // Check procedures
    for (const procedure of this.procedures) {
      if (this.getConceptId(procedure) === conceptId && (procedure as any).computedLocation) {
        return (procedure as any).computedLocation;
      }
    }
    
    // Check medications
    for (const medication of this.medications) {
      if (this.getConceptId(medication) === conceptId && (medication as any).computedLocation) {
        return (medication as any).computedLocation;
      }
    }
    
    return null;
  }

  /**
   * Check if there are any clinical events that need mapping
   */
  hasEventsRequiringMapping(): boolean {
    const unmappedEvents = this.getUnmappedEvents();
    return unmappedEvents.conditions.length > 0 || 
           unmappedEvents.procedures.length > 0 || 
           unmappedEvents.medications.length > 0;
  }

  /**
   * Check if an anchor point has any associated clinical events
   */
  hasAssociatedEvents(anchorPoint: AnchorPoint): boolean {
    // Check conditions
    const hasConditions = this.conditions.some(condition => {
      const bestAnchorPoint = this.findBestAnchorPointForConcept(this.getConceptId(condition));
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    // Check procedures
    const hasProcedures = this.procedures.some(procedure => {
      const bestAnchorPoint = this.findBestAnchorPointForConcept(this.getConceptId(procedure));
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    // Check medications
    const hasMedications = this.medications.some(medication => {
      const bestAnchorPoint = this.findBestAnchorPointForConcept(this.getConceptId(medication));
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    return hasConditions || hasProcedures || hasMedications;
  }
}
