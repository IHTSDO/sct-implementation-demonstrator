import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { PatientService } from '../services/patient.service';
import { PatientDataTransformerService } from '../services/patient-data-transformer.service';
import { PatientSimulationService } from '../services/patient-simulation.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription, firstValueFrom, forkJoin, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BatchPatientDialogComponent } from './batch-patient-dialog/batch-patient-dialog.component';
import { ConfirmationDialogComponent } from '../questionnaires/confirmation-dialog/confirmation-dialog.component';
import { catchError, delay } from 'rxjs/operators';
import { DeathRegistrationDialogComponent } from './death-registration-dialog/death-registration-dialog.component';
import { filter } from 'rxjs/operators';
import { FhirService } from '../services/fhir.service';
import { FhirServerDialogComponent } from './fhir-server-dialog/fhir-server-dialog.component';
import { PatientBookmarkService } from '../services/patient-bookmark.service';
import { CdsHooksServersDialogComponent } from './cds-hooks-servers-dialog/cds-hooks-servers-dialog.component';
import { CdsHooksServerConfigService } from '../services/cds-hooks-server-config.service';
import type { Patient } from '../model';
import type { PatientPaginationState, PersistenceMode } from '../services/patient-storage.types';

@Component({
  selector: 'app-benefits-demo',
  templateUrl: './benefits-demo.component.html',
  styleUrls: ['./benefits-demo.component.css'],
  standalone: false
})
export class BenefitsDemoComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  searchTerm: string = '';
  selectedPatient: Patient | null = null;
  showAnalytics = false;
  analyticsMode: 'regular' | 'icd10' = 'regular';
  persistenceMode: PersistenceMode = 'local';
  patientPagination: PatientPaginationState = {
    hasNext: false,
    hasPrevious: false,
    nextUrl: null,
    previousUrl: null,
    loading: false,
    pageSize: 20,
    total: null
  };
  readonly patientSkeletonRows = Array.from({ length: 6 }, (_, index) => index);
  currentFhirServer = '';
  activeCdsServerCount = 0;
  bookmarkedPatientIds = new Set<string>();
  isCreatingPatient = false;
  creatingPatientMessage = 'Creating patient...';
  isDeletingPatient = false;
  isOpeningDeathDialog = false;
  isSearchingPatients = false;
  remoteSearchTotal: number | null = null;
  private subscriptions: Subscription[] = [];
  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private activeSearchRequestId = 0;

  constructor(
    private patientService: PatientService,
    private patientDataTransformer: PatientDataTransformerService,
    private patientSimulationService: PatientSimulationService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fhirService: FhirService,
    private patientBookmarkService: PatientBookmarkService,
    private cdsHooksServerConfigService: CdsHooksServerConfigService
  ) { }

  ngOnInit(): void {
    this.syncViewModeWithUrl();

    this.subscriptions.push(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.syncViewModeWithUrl())
    );

    // Subscribe to patients list
    this.subscriptions.push(
      this.patientService.getPatients().subscribe(patients => {
        this.patients = this.sortPatientsByRecency(this.mergeBookmarkedPatients(patients));
        if (this.isRemoteSearchActive()) {
          return;
        }
        this.filterPatients();
      })
    );

    // Subscribe to selected patient
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.selectedPatient = patient;
      })
    );

    this.subscriptions.push(
      this.patientService.getPersistenceMode().subscribe(mode => {
        this.persistenceMode = mode;
        this.loadBookmarkedPatients();
      })
    );

    this.subscriptions.push(
      this.patientService.getPatientPagination().subscribe(state => {
        this.patientPagination = state;
      })
    );

    this.subscriptions.push(
      this.fhirService.baseUrl$.subscribe(url => {
        this.currentFhirServer = url;
        this.loadBookmarkedPatients();
        if (this.isRemoteSearchActive()) {
          this.onSearchChange();
        }
      })
    );

    this.subscriptions.push(
      this.cdsHooksServerConfigService.servers$.subscribe((servers) => {
        this.activeCdsServerCount = servers.filter((server) => server.active).length;
      })
    );

    this.loadBookmarkedPatients();
  }

  filterPatients(): void {
    if (this.isRemoteSearchActive()) {
      return;
    }

    if (!this.searchTerm.trim()) {
      this.filteredPatients = this.patients;
      return;
    }

    const searchLower = this.searchTerm.toLowerCase().trim();
    this.filteredPatients = this.patients.filter(patient => {
      if (patient.name && patient.name.length > 0) {
        const name = patient.name[0];
        
        // Check family name (last name)
        if (name.family && name.family.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Check given names (first name, middle names, etc.)
        if (name.given) {
          const givenMatches = name.given.some(givenName => 
            givenName.toLowerCase().includes(searchLower)
          );
          if (givenMatches) {
            return true;
          }
        }
        
        // Check full text name if available
        if (name.text && name.text.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
      
      return false;
    });
  }

  onSearchChange(): void {
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = null;
    }

    if (!this.isFhirMode()) {
      this.resetRemoteSearchState();
      this.filterPatients();
      return;
    }

    if (!this.searchTerm.trim()) {
      this.resetRemoteSearchState();
      this.filterPatients();
      return;
    }

    const requestId = ++this.activeSearchRequestId;
    this.isSearchingPatients = true;
    this.searchDebounceHandle = setTimeout(() => {
      void this.runRemotePatientSearch(this.searchTerm.trim(), requestId);
    }, 300);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.resetRemoteSearchState();
    this.filterPatients();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  selectPatient(patient: Patient): void {
    this.patientService.addOrUpdatePatientInMemory(patient);
    this.patientService.selectPatient(patient);
  }

  clearSelection(): void {
    this.patientService.selectPatient(null);
  }

  async onPersistenceModeChange(mode: PersistenceMode): Promise<void> {
    if (this.persistenceMode === mode) {
      return;
    }

    await this.patientService.setPersistenceMode(mode);
    this.loadBookmarkedPatients();
    this.searchTerm = '';
    this.resetRemoteSearchState();
    this.filterPatients();
  }

  async loadNextPatientsPage(): Promise<void> {
    await this.patientService.loadNextPatientsPage();
  }

  async loadPreviousPatientsPage(): Promise<void> {
    await this.patientService.loadPreviousPatientsPage();
  }

  async refreshPatientList(): Promise<void> {
    if (!this.isFhirMode() || this.patientPagination.loading || this.isSearchingPatients || this.isCreatingPatient || this.isDeletingPatient) {
      return;
    }

    await this.patientService.refreshPatients();
  }

  isFhirMode(): boolean {
    return this.persistenceMode === 'fhir';
  }

  async switchToLocalMode(): Promise<void> {
    await this.onPersistenceModeChange('local');
  }

  async switchToFhirMode(): Promise<void> {
    await this.onPersistenceModeChange('fhir');
  }

  openFhirServerSettings(): void {
    const dialogRef = this.dialog.open(FhirServerDialogComponent, {
      width: '540px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === 'save' && this.isFhirMode()) {
        await this.patientService.refreshPatients();
      }
    });
  }

  openCdsHooksServersSettings(): void {
    this.dialog.open(CdsHooksServersDialogComponent, {
      width: '680px',
      maxWidth: '95vw'
    });
  }

  getActiveCdsServerLabel(): string {
    if (this.activeCdsServerCount === 0) {
      return 'No active CDS servers configured';
    }

    return `${this.activeCdsServerCount} active CDS server${this.activeCdsServerCount === 1 ? '' : 's'}`;
  }

  showPatientListSkeleton(): boolean {
    return this.isFhirMode() && this.patientPagination.loading && this.patients.length === 0;
  }

  showPatientListOverlay(): boolean {
    return this.isCreatingPatient || (this.isFhirMode() && ((this.patientPagination.loading && this.patients.length > 0) || this.isSearchingPatients));
  }

  getPatientCountLabel(): string {
    if (this.searchTerm.trim()) {
      const total = this.isFhirMode()
        ? (this.remoteSearchTotal ?? this.filteredPatients.length)
        : (this.patientPagination.total ?? this.patients.length);
      return `${this.filteredPatients.length} of ${total} patients`;
    }

    if (this.isFhirMode() && this.patientPagination.total !== null) {
      return `${this.patients.length} of ${this.patientPagination.total} patients`;
    }

    return `${this.patients.length} patients`;
  }

  isPatientTotalLoading(): boolean {
    return this.isFhirMode() && this.patientPagination.loading && this.patientPagination.total === null;
  }

  private async runRemotePatientSearch(term: string, requestId: number): Promise<void> {
    try {
      const page = await this.patientService.searchPatients(term);
      if (requestId !== this.activeSearchRequestId) {
        return;
      }

      page.patients.forEach((patient) => {
        this.patientBookmarkService.upsertBookmarkSnapshot(patient, this.persistenceMode, this.currentFhirServer);
      });

      this.remoteSearchTotal = page.total;
      this.filteredPatients = this.sortPatientsByRecency([...page.patients]);
    } catch (error) {
      if (requestId !== this.activeSearchRequestId) {
        return;
      }

      console.error('Error searching patients on FHIR server:', error);
      this.remoteSearchTotal = 0;
      this.filteredPatients = [];
      this.snackBar.open('Unable to search patients on the FHIR server right now.', 'Close', {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      if (requestId === this.activeSearchRequestId) {
        this.isSearchingPatients = false;
      }
    }
  }

  private resetRemoteSearchState(): void {
    this.activeSearchRequestId += 1;
    this.isSearchingPatients = false;
    this.remoteSearchTotal = null;

    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = null;
    }
  }

  getPatientListOverlayLabel(): string {
    if (this.isCreatingPatient) {
      return this.creatingPatientMessage;
    }

    return this.isSearchingPatients ? 'Searching FHIR server...' : 'Refreshing patient list...';
  }

  isRemoteSearchActive(): boolean {
    return this.isFhirMode() && !!this.searchTerm.trim();
  }

  isPatientBookmarked(patient: Patient | null): boolean {
    return !!patient && this.bookmarkedPatientIds.has(patient.id);
  }

  togglePatientBookmark(patient: Patient): void {
    const isBookmarked = this.patientBookmarkService.toggleBookmark(
      patient,
      this.persistenceMode,
      this.currentFhirServer
    );
    this.patientBookmarkService.upsertBookmarkSnapshot(patient, this.persistenceMode, this.currentFhirServer);
    this.loadBookmarkedPatients();
    this.patients = this.sortPatientsByRecency(this.mergeBookmarkedPatients(this.patients));
    if (this.isRemoteSearchActive()) {
      this.filteredPatients = this.sortPatientsByRecency([...this.filteredPatients]);
    } else {
      this.filterPatients();
    }

    this.snackBar.open(
      isBookmarked ? 'Patient bookmarked at the top of this list.' : 'Patient removed from bookmarks.',
      undefined,
      { duration: 2500, horizontalPosition: 'center', verticalPosition: 'top' }
    );
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

  private sortPatientsByRecency(patients: Patient[]): Patient[] {
    const bookmarkedOrder = this.getBookmarkedOrderMap();

    return patients.sort((a, b) => {
      const bookmarkedIndexA = bookmarkedOrder.get(a.id);
      const bookmarkedIndexB = bookmarkedOrder.get(b.id);
      const isBookmarkedA = bookmarkedIndexA !== undefined;
      const isBookmarkedB = bookmarkedIndexB !== undefined;

      if (isBookmarkedA && isBookmarkedB) {
        return bookmarkedIndexA - bookmarkedIndexB;
      }

      if (isBookmarkedA) {
        return -1;
      }

      if (isBookmarkedB) {
        return 1;
      }

      const timestampA = this.getPatientSortTimestamp(a);
      const timestampB = this.getPatientSortTimestamp(b);
      return timestampB - timestampA;
    });
  }

  private getPatientSortTimestamp(patient: Patient): number {
    const metaTimestamp = patient.meta?.lastUpdated ? new Date(patient.meta.lastUpdated).getTime() : 0;
    if (!Number.isNaN(metaTimestamp) && metaTimestamp > 0) {
      return metaTimestamp;
    }

    return this.getTimestampFromPatientId(patient.id);
  }

  private getTimestampFromPatientId(id: string): number {
    const parts = id.split('-');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1], 10);
      return isNaN(timestamp) ? 0 : timestamp;
    }

    return 0;
  }

  getPatientRecordDateLabel(patient: Patient): string {
    return patient.meta?.lastUpdated ? 'Updated' : 'Created';
  }

  getPatientRecordDate(patient: Patient): string | null {
    if (patient.meta?.lastUpdated) {
      return this.formatPatientDateTime(patient.meta.lastUpdated);
    }

    const timestamp = this.getTimestampFromPatientId(patient.id);
    if (timestamp > 0) {
      return this.formatPatientDateTime(new Date(timestamp).toISOString());
    }

    return null;
  }

  private formatPatientDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  private loadBookmarkedPatients(): void {
    const bookmarkedSnapshots = this.patientBookmarkService.getBookmarkedPatients(this.persistenceMode, this.currentFhirServer);
    this.bookmarkedPatientIds = new Set(bookmarkedSnapshots.map((item) => item.id));
    this.patients = this.sortPatientsByRecency(this.mergeBookmarkedPatients(this.patients));
    if (this.isRemoteSearchActive()) {
      this.filteredPatients = this.sortPatientsByRecency([...this.filteredPatients]);
      return;
    }

    this.filterPatients();
  }

  private mergeBookmarkedPatients(patients: Patient[]): Patient[] {
    const bookmarkedSnapshots = this.patientBookmarkService.getBookmarkedPatients(this.persistenceMode, this.currentFhirServer);
    const patientsById = new Map<string, Patient>();
    const mergedPatients: Patient[] = [];

    patients.forEach((patient) => {
      patientsById.set(patient.id, patient);
      this.patientBookmarkService.upsertBookmarkSnapshot(patient, this.persistenceMode, this.currentFhirServer);
    });

    bookmarkedSnapshots.forEach((snapshot) => {
      const patient = patientsById.get(snapshot.id) || snapshot.patient;
      if (!mergedPatients.some((item) => item.id === patient.id)) {
        mergedPatients.push(patient);
      }
      patientsById.delete(snapshot.id);
    });

    patients.forEach((patient) => {
      if (patientsById.has(patient.id)) {
        mergedPatients.push(patient);
      }
    });

    return mergedPatients;
  }

  private getBookmarkedOrderMap(): Map<string, number> {
    const bookmarkedSnapshots = this.patientBookmarkService.getBookmarkedPatients(this.persistenceMode, this.currentFhirServer);
    return new Map(bookmarkedSnapshots.map((snapshot, index) => [snapshot.id, index]));
  }

  async openClinicalRecord(): Promise<void> {
    if (!this.selectedPatient) {
      return;
    }

    if (this.isFhirMode()) {
      const refreshedPatient = await this.patientService.refreshPatient(this.selectedPatient.id);
      if (refreshedPatient) {
        this.patientService.selectPatient(refreshedPatient);
        this.patientBookmarkService.upsertBookmarkSnapshot(refreshedPatient, this.persistenceMode, this.currentFhirServer);
      }
    }

    this.router.navigate(['/clinical-record', this.selectedPatient.id]);
  }

  async openDeathRegistration(): Promise<void> {
    if (!this.selectedPatient || this.isOpeningDeathDialog) {
      return;
    }

    this.isOpeningDeathDialog = true;
    try {
      await this.patientService.ensureConditionsAndDeathRecordLoaded(this.selectedPatient.id);
    } finally {
      this.isOpeningDeathDialog = false;
    }

    const existingRecord = this.patientService.getPatientDeathRecord(this.selectedPatient.id);
    const conditions = this.patientService.getPatientConditions(this.selectedPatient.id);

    const dialogRef = this.dialog.open(DeathRegistrationDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        patient: this.selectedPatient,
        conditions,
        existingRecord
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.patient) {
        return;
      }

      this.patientService.selectPatient(result.patient);

      const message = result.deleted
        ? 'Death certification record deleted. Patient revived.'
        : existingRecord
          ? 'Death registration updated successfully.'
          : 'Death registration saved successfully.';

      this.snackBar.open(
        message,
        undefined,
        {
          duration: 3500,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        }
      );
    });
  }

  async deleteSelectedPatient(): Promise<void> {
    if (!this.selectedPatient) {
      return;
    }

    const patientName = this.getPatientDisplayName(this.selectedPatient);
    const confirmation = await firstValueFrom(this.dialog.open(ConfirmationDialogComponent, {
      width: '520px',
      data: {
        title: 'Delete Patient',
        message:
          `Are you sure you want to permanently delete "${patientName}"?\n\n` +
          'This will remove the patient record and all related clinical data, including conditions, procedures, medications, allergies, encounters, observations, forms, and other linked records.\n\n' +
          'This action cannot be undone.',
        confirmLabel: 'Delete Patient',
        cancelLabel: 'Cancel',
        confirmColor: 'warn'
      }
    }).afterClosed());

    if (confirmation) {
      try {
        this.isDeletingPatient = true;
        await this.patientService.deletePatientRecord(this.selectedPatient.id);
        this.patientService.selectPatient(null);
        if (this.isFhirMode()) {
          if (this.patientPagination.total !== null) {
            this.patientPagination = {
              ...this.patientPagination,
              total: Math.max(0, this.patientPagination.total - 1)
            };
          }
        }
        this.snackBar.open(`Patient "${patientName}" has been deleted successfully.`, 'Close', {
          duration: 3500,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      } catch (error) {
        console.error('Error deleting patient:', error);
        this.snackBar.open('Error deleting patient. Please try again.', 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      } finally {
        this.isDeletingPatient = false;
      }
    }
  }

  isPatientDeceased(patient: Patient | null): boolean {
    return !!(patient?.deceasedBoolean || patient?.deceasedDateTime);
  }

  getDeathActionLabel(patient: Patient | null): string {
    return this.isPatientDeceased(patient) ? 'Update Death Record' : 'Register Death';
  }

  getPatientDeceasedSummary(patient: Patient | null): string {
    if (!patient?.deceasedDateTime) {
      return 'Recorded as deceased';
    }

    return `Deceased on ${new Date(patient.deceasedDateTime).toLocaleString()}`;
  }

  createNewPatient(): void {
    this.router.navigate(['/create-patient']);
  }

  async createRandomPatient(): Promise<void> {
    const randomPatient = this.patientSimulationService.generateRandomPatient();
    this.isCreatingPatient = true;
    this.creatingPatientMessage = 'Creating patient...';

    try {
      const savedPatient = await this.patientService.addPatient(randomPatient);
      this.patientService.selectPatient(savedPatient);
      this.router.navigate(['/clinical-record', savedPatient.id]);
    } catch (error) {
      console.error('Error creating random patient:', error);
      this.snackBar.open('Unable to create patient right now.', 'Close', {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      this.isCreatingPatient = false;
      this.creatingPatientMessage = 'Creating patient...';
    }
  }

  createRandomPatientWithDiagnoses(): void {
    this.patientSimulationService.generateRandomPatientWithDiagnoses().subscribe({
      next: async (result) => {
        this.isCreatingPatient = true;
        this.creatingPatientMessage = 'Creating patient with diagnoses...';
        
        try {
          const savedPackage = await this.patientService.addPatientWithConditions(result.patient, result.diagnoses);
          this.patientService.selectPatient(savedPackage.patient);
          this.router.navigate(['/clinical-record', savedPackage.patient.id]);
        } catch (error) {
          console.error('Error creating patient with diagnoses:', error);
          alert('Error generating patient with diagnoses. Please try again.');
        } finally {
          this.isCreatingPatient = false;
          this.creatingPatientMessage = 'Creating patient...';
        }
      },
      error: (error) => {
        console.error('Error generating patient with diagnoses:', error);
        alert('Error generating patient with diagnoses. Please try again.');
      }
    });
  }

  createBatchPatients(): void {
    const dialogRef = this.dialog.open(BatchPatientDialogComponent, {
      width: '80vw',
      maxWidth: '1400px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.generateMultiplePatients(
          result.numberOfPatients, 
          result.timeframeYears,
          result.includeDiagnoses,
          result.minDiagnoses,
          result.maxDiagnoses,
          result.genderDistribution,
          result.ageDistribution
        );
      }
    });
  }

  private async generateMultiplePatients(
    count: number, 
    timeframeYears: number = 2,
    includeDiagnoses: boolean, 
    minDiagnoses: number = 1, 
    maxDiagnoses: number = 4, 
    genderDistribution: number = 0.5,
    ageDistribution?: { children: number; adults: number; elderly: number }
  ): Promise<void> {
    this.isCreatingPatient = true;
    this.creatingPatientMessage = `Generating 0 of ${count} patients...`;
    let completed = 0;
    let lastPatientId: string | null = null;

    try {
      for (let i = 0; i < count; i++) {
        if (includeDiagnoses) {
          // Generate patient with diagnoses
          await new Promise<void>((resolve, reject) => {
            this.patientSimulationService.generateRandomPatientWithDiagnoses(minDiagnoses, maxDiagnoses, genderDistribution, ageDistribution, timeframeYears)
              .pipe(
                catchError(error => {
                  console.error(`Error generating patient ${i + 1}:`, error);
                  return of(null);
                })
              )
              .subscribe({
                next: async (result) => {
                  if (result) {
                    this.creatingPatientMessage = `Generating ${completed + 1} of ${count} patients...`;
                    const savedPackage = await this.patientService.addPatientWithConditions(
                      result.patient,
                      result.diagnoses,
                      {
                        refreshPatients: false,
                        skipConditionEnrichment: !this.isFhirMode()
                      }
                    );
                    lastPatientId = savedPackage.patient.id;
                  }
                  completed++;
                  resolve();
                },
                error: reject
              });
          });
        } else {
          // Generate simple random patient with gender and age distribution
          const gender = this.patientSimulationService.getRandomGenderWithDistribution(genderDistribution);
          
          let randomPatient: Patient;
          if (ageDistribution) {
            const [minAge, maxAge] = this.patientSimulationService.getRandomAgeGroupWithDistribution(ageDistribution);
            randomPatient = this.patientSimulationService.generateRandomPatientWithAgeRange(minAge, maxAge);
            // Set gender after age generation
            randomPatient.gender = gender;
            // Update name to match gender
            const firstName = this.patientSimulationService.getRandomFirstNameForGender(gender as 'male' | 'female');
            if (randomPatient.name && randomPatient.name.length > 0) {
              randomPatient.name[0].given = [firstName];
            }
          } else {
            randomPatient = this.patientSimulationService.generateRandomPatientWithGender(gender as 'male' | 'female');
          }
          
          this.creatingPatientMessage = `Generating ${completed + 1} of ${count} patients...`;
          const savedPatient = await this.patientService.addPatient(randomPatient, { refreshPatients: false });
          lastPatientId = savedPatient.id;
          completed++;
        }

        if (this.isFhirMode()) {
          // In FHIR mode we keep a tiny pause so the progress overlay remains readable.
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      if (this.isFhirMode()) {
        this.creatingPatientMessage = 'Finishing generation and refreshing patient list...';
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.patientService.refreshPatients();
      }

      // Show success message
      this.snackBar.open(`Successfully generated ${completed} patients!`, 'Close', {
        duration: 5000,
        panelClass: ['success-snackbar']
      });

      // Select the last created patient if available
      if (lastPatientId) {
        const lastPatient = this.patients.find(p => p.id === lastPatientId);
        if (lastPatient) {
          this.patientService.selectPatient(lastPatient);
        }
      }
    } catch (error) {
      console.error('Error in batch patient generation:', error);
      this.snackBar.open('Error generating patients. Some patients may not have been created.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isCreatingPatient = false;
      this.creatingPatientMessage = 'Creating patient...';
    }
  }

  openAnalytics(): void {
    this.router.navigate(['/ehr-lab/analytics']);
  }

  openIcd10Analytics(): void {
    this.router.navigate(['/ehr-lab/analytics'], { queryParams: { mode: 'icd10' } });
  }

  hasAnalyticsData(): boolean {
    if (this.isFhirMode()) {
      return false;
    }

    return this.patientDataTransformer.hasPatientData(false);
  }

  hasIcd10AnalyticsData(): boolean {
    if (this.isFhirMode()) {
      return false;
    }

    return this.patientDataTransformer.hasPatientData(true);
  }

  getAnalyticsDataSummary(): { patients: number, conditions: number, procedures: number, medications: number } {
    if (this.isFhirMode()) {
      return { patients: this.patients.length, conditions: 0, procedures: 0, medications: 0 };
    }

    return this.patientDataTransformer.getDataSummary(false);
  }

  getIcd10AnalyticsDataSummary(): { patients: number, conditions: number, procedures: number, medications: number } {
    if (this.isFhirMode()) {
      return { patients: this.patients.length, conditions: 0, procedures: 0, medications: 0 };
    }

    return this.patientDataTransformer.getDataSummary(true);
  }

  closeAnalytics(): void {
    this.router.navigate(['/ehr-lab']);
  }

  openInteroperability(): void {
    this.router.navigate(['/interoperability']);
  }

  openSmartHealthLinks(): void {
    this.router.navigate(['/ehr-lab/smart-health-links']);
  }

  private syncViewModeWithUrl(): void {
    const currentPath = this.router.url.split('?')[0];
    this.showAnalytics = currentPath.endsWith('/ehr-lab/analytics');
    this.analyticsMode = this.route.snapshot.queryParamMap.get('mode') === 'icd10' ? 'icd10' : 'regular';
  }

  async downloadPatientsAsZip(): Promise<void> {
    try {
      await this.patientService.downloadPatientsZip();
    } catch (error) {
      console.error('Error downloading patients ZIP:', error);
      alert('Error generating export file. Please try again.');
    }
  }

  triggerFileUpload(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please select a ZIP file.');
      return;
    }

    try {
      const result = await this.patientService.importPatientsFromZip(file);
      
      if (result.success) {
        alert(result.message);
        // Clear the file input
        input.value = '';
      } else {
        alert(`Import failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error importing patients:', error);
      alert('Error importing patient data. Please try again.');
    }
  }

  clearAllData(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '560px',
      data: {
        title: 'Clear All Patient Data',
        message: 'Are you sure you want to permanently delete all patient records and all related clinical data, including conditions, procedures, medications, allergies, encounters, observations, forms, openEHR compositions, service requests, lab orders, and death certificate bundles? This action cannot be undone.'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      try {
        this.patientService.clearAllPatientsAndClinicalData();
        this.snackBar.open(
          'All patient data has been cleared successfully.',
          undefined,
          {
            duration: 3500,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          }
        );
      } catch (error) {
        console.error('Error clearing patient data:', error);
        this.snackBar.open(
          'Error clearing patient data. Please try again.',
          undefined,
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          }
        );
      }
    });
  }
}
