import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { Subject, takeUntil, switchMap, of, forkJoin, Observable, catchError, debounceTime, distinctUntilChanged, combineLatest, skip } from 'rxjs';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { instance, type Viz } from '@viz-js/viz';

interface ModuleDependency {
  id: string;
  moduleId: string;
  moduleDisplay?: string;
  referencedComponentId: string;
  targetModuleDisplay?: string;
  sourceEffectiveTime?: string;
  targetEffectiveTime?: string;
  active?: boolean;
}

interface DependencyRow {
  sourceCode: string;
  sourceDisplay: string;
  targetCode: string;
  targetDisplay: string;
  sourceEffectiveTime?: string;
  targetEffectiveTime?: string;
  level: number; // For indentation/styling
}

interface Module {
  code: string;
  display: string;
}

@Component({
  selector: 'app-mdrs-viewer',
  templateUrl: './mdrs-viewer.component.html',
  styleUrl: './mdrs-viewer.component.css',
  standalone: false
})
export class MdrsViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  
  @ViewChild('dependencyGraph', { static: false }) graphContainer!: ElementRef;
  
  private destroy$ = new Subject<void>();
  
  // Data source mode
  dataSourceMode: 'server' | 'upload' = 'server';
  
  // Module selection
  moduleControl = new FormControl<string | null>({ value: null, disabled: true });
  availableModules: Module[] = [];
  selectedModule: Module | null = null;
  loadingModules = false;
  
  // File upload
  uploadedFile: File | null = null;
  uploadingFile = false;
  
  // MDRS data in memory
  mdrsMembers: any[] = []; // Store all MDRS members in memory
  mdrsLoading = false;
  
  // Code system mapping
  codeSystemMapping: Array<{
    fhirVersion: string;
    nativeBranchPath: string;
  }> = [];
  
  // Flags to prevent multiple simultaneous loads
  private isLoadingMapping = false;
  private isLoadingMDRS = false;
  private initialLoadComplete = false;
  
  // Dependencies data
  dependencies: ModuleDependency[] = [];
  dependencyRows: DependencyRow[] = [];
  loading = false;
  error: string | null = null;
  
  // Graph visualization
  private viz: Viz | null = null;
  private graphWidth = 1200;
  private graphHeight = 800;
  
  // Module Dependency Reference Set ID
  readonly MDRS_REFERENCE_SET_ID = '900000000000534007';
  
  constructor(
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Load code system mapping first, then MDRS (only if server mode)
    if (this.dataSourceMode === 'server') {
      this.loadCodeSystemMapping();
    }
    
    // Combine both observables and debounce together to avoid multiple loads
    // Only subscribe to changes after initial load is complete
    combineLatest([
      this.terminologyService.snowstormFhirBase$.pipe(distinctUntilChanged()),
      this.terminologyService.fhirUrlParam$.pipe(distinctUntilChanged())
    ]).pipe(
      debounceTime(500), // Wait 500ms after last change before executing
      takeUntil(this.destroy$)
    ).subscribe(([fhirBase, fhirUrlParam]) => {
      // Only react to changes after initial load is complete
      if (!this.initialLoadComplete) {
        return;
      }
      
      // If in upload mode, reset to server mode when FHIR URI changes
      if (this.dataSourceMode === 'upload') {
        this.dataSourceMode = 'server';
        this.uploadedFile = null;
      }
      
      // Only proceed if in server mode
      if (this.dataSourceMode !== 'server') {
        return;
      }
      
      // Clear selection and table when server or edition changes
      this.clearSelection();
      this.dependencyRows = [];
      // Clear available modules immediately
      this.availableModules = [];
      this.loadCodeSystemMapping();
    });
  }

  ngAfterViewInit(): void {
    // Initialize graph after view is ready
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load the entire Module Dependency Reference Set into memory using native API
   * Uses the code system mapping to find the correct branchPath for the active FHIR version
   */
  loadMDRS(): void {
    // Prevent multiple simultaneous loads
    if (this.isLoadingMDRS) {
      return;
    }
    
    this.isLoadingMDRS = true;
    this.mdrsLoading = true;
    this.loadingModules = true;
    this.mdrsMembers = [];
    this.availableModules = [];
    // Disable the select while loading
    this.moduleControl.disable();
    
    // Get the active FHIR version
    const activeFhirVersion = this.terminologyService.getFhirUrlParam();
    
    // Find the corresponding native branchPath from the mapping
    // Try exact match first, then try to find a version that starts with the active version
    let mappingEntry = this.codeSystemMapping.find(m => m.fhirVersion === activeFhirVersion);
    
    // If no exact match, try to find a version that starts with the active version (for cases where activeFhirVersion is just the base URL)
    if (!mappingEntry && activeFhirVersion === 'http://snomed.info/sct') {
      // Find the most recent version (last in array, assuming they're sorted)
      mappingEntry = this.codeSystemMapping.length > 0 ? this.codeSystemMapping[this.codeSystemMapping.length - 1] : undefined;
    } else if (!mappingEntry) {
      // Try to find a version that contains the active version
      mappingEntry = this.codeSystemMapping.find(m => m.fhirVersion.startsWith(activeFhirVersion));
    }
    
    if (!mappingEntry) {
      // If no mapping found, wait for mapping to be loaded or show error
      this.isLoadingMDRS = false;
      this.mdrsLoading = false;
      this.loadingModules = false;
      this.moduleControl.enable();
      this.snackBar.open('Code system mapping not available for active FHIR version', 'Close', { duration: 3000 });
      return;
    }
    
    const branchPath = mappingEntry.nativeBranchPath;
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    
    // Use Snowstorm native API to get all refset members with additional fields
    const snowstormBase = fhirBase.replace('/fhir', '/snowstorm/snomed-ct');
    const requestUrl = `${snowstormBase}/${branchPath}/members?referenceSet=${this.MDRS_REFERENCE_SET_ID}&active=true&limit=10000`;
    
    const headers = new HttpHeaders({
      'Accept-Language': this.terminologyService.getLang()
    });
    
    this.http.get<any>(requestUrl, { headers }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response?.items && response.items.length > 0) {
          // Store all MDRS members in memory with their additional fields
          this.mdrsMembers = response.items;
          
          // Extract unique moduleIds (source modules) and referencedComponentIds (target modules) from the refset members
          const moduleIdSet = new Set<string>();
          const referencedComponentIdSet = new Set<string>();
          response.items.forEach((item: any) => {
            if (item.moduleId) {
              moduleIdSet.add(item.moduleId.toString());
            }
            if (item.referencedComponentId) {
              referencedComponentIdSet.add(item.referencedComponentId.toString());
            }
          });
          
          // Combine both sets to get all unique module IDs (both sources and targets)
          const allModuleIds = new Set([...moduleIdSet, ...referencedComponentIdSet]);
          const uniqueModuleIds = Array.from(allModuleIds);
          
          if (uniqueModuleIds.length === 0) {
            this.isLoadingMDRS = false;
            this.mdrsLoading = false;
            this.loadingModules = false;
            this.moduleControl.enable();
            return;
          }
          
          // Build a single ECL query combining all module IDs with OR operator
          const ecl = uniqueModuleIds.join(' OR ');
          
          // Single request to get all module displays at once
          this.terminologyService.expandValueSetFromServer(
            this.terminologyService.getSnowstormFhirBase(),
            this.terminologyService.getFhirUrlParam(),
            ecl,
            '',
            0,
            10000 // High limit to get all modules
          ).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: (response: any) => {
              const modules: Module[] = [];
              
              if (response?.expansion?.contains) {
                // Map each concept from the expansion to a Module object
                response.expansion.contains.forEach((item: any) => {
                  if (item.code) {
                    modules.push({
                      code: item.code,
                      display: item.display || item.code
                    });
                  }
                });
              }
              
              this.availableModules = modules;
              // Sort modules by display name for better UX
              this.availableModules.sort((a, b) => a.display.localeCompare(b.display));
              
              this.isLoadingMDRS = false;
              this.mdrsLoading = false;
              this.loadingModules = false;
              // Enable the select after loading
              this.moduleControl.enable();
              
              // Mark initial load as complete
              this.initialLoadComplete = true;
            },
            error: (err) => {
              this.isLoadingMDRS = false;
              this.mdrsLoading = false;
              this.loadingModules = false;
              this.moduleControl.enable();
              console.error('[MDRS] Error loading module displays:', err);
              // Mark initial load as complete even on error
              this.initialLoadComplete = true;
            }
          });
        } else {
          this.isLoadingMDRS = false;
          this.mdrsLoading = false;
          this.loadingModules = false;
          this.moduleControl.enable();
          // Mark initial load as complete even if no items
          this.initialLoadComplete = true;
        }
      },
      error: (err) => {
        this.isLoadingMDRS = false;
        this.mdrsLoading = false;
        this.loadingModules = false;
        // Enable the select even if there's an error
        this.moduleControl.enable();
        console.error('[MDRS] Error loading MDRS:', err);
        this.snackBar.open('Error loading Module Dependency Reference Set', 'Close', { duration: 5000 });
        // Mark initial load as complete even on error
        this.initialLoadComplete = true;
      }
    });
  }

  onModuleSelectionChange(event: any): void {
    const moduleCode = event.value;
    if (!moduleCode) {
      this.clearSelection();
      return;
    }
    
    const module = this.availableModules.find(m => m.code === moduleCode);
    if (module) {
      this.selectModule(module);
    }
  }

  selectModule(module: Module): void {
    // Clear previous table data
    this.dependencyRows = [];
    this.selectedModule = module;
    this.buildDependencyTable(module.code);
    // Render graph after a short delay to ensure table is built
    setTimeout(() => {
      this.renderGraph();
    }, 100);
  }

  /**
   * Build dependency table showing MDRS lines chained sequentially
   * Each line connects to the next: targetEffectiveTime of one becomes sourceEffectiveTime of the next
   */
  buildDependencyTable(moduleCode: string): void {
    this.dependencyRows = [];
    const processedChains = new Set<string>();
    
    // Get module display name
    const moduleDisplay = this.availableModules.find(m => m.code === moduleCode)?.display || moduleCode;
    
    // Find all MDRS members where the selected module is the source (moduleId)
    // These are the starting points of the chain
    const startingMembers = this.mdrsMembers.filter((member: any) => {
      const sourceId = member.moduleId?.toString() || member.moduleId;
      return sourceId === moduleCode;
    });
    
    // Process each starting member to build chains
    startingMembers.forEach((member: any) => {
      // Extract effective times - normalize to string
      const sourceEffectiveTime = this.normalizeEffectiveTime(
        member.additionalFields?.sourceEffectiveTime || member.sourceEffectiveTime
      );
      const targetEffectiveTime = this.normalizeEffectiveTime(
        member.additionalFields?.targetEffectiveTime || member.targetEffectiveTime
      );
      const targetModuleId = member.referencedComponentId?.toString() || member.referencedComponentId || '';
      const targetModule = this.availableModules.find(m => m.code === targetModuleId);
      const targetDisplay = targetModule?.display || targetModuleId || '';
      
      console.log(`[Starting] Processing member:`, {
        source: moduleCode,
        sourceEffectiveTime,
        target: targetModuleId,
        targetEffectiveTime,
        member: member
      });
      
      // Create chain key to avoid duplicates
      const chainKey = `${moduleCode}:${sourceEffectiveTime}:${targetModuleId}:${targetEffectiveTime}`;
      if (processedChains.has(chainKey)) {
        return;
      }
      processedChains.add(chainKey);
      
      // Add the first row in the chain
      this.dependencyRows.push({
        sourceCode: moduleCode,
        sourceDisplay: moduleDisplay || moduleCode,
        targetCode: targetModuleId,
        targetDisplay: targetDisplay,
        sourceEffectiveTime: sourceEffectiveTime,
        targetEffectiveTime: targetEffectiveTime,
        level: 0
      });
      
      // Continue the chain: find next members where target becomes source with matching effective time
      if (targetModuleId && targetEffectiveTime) {
        this.addChainedRows(targetModuleId, targetEffectiveTime, processedChains, 1);
      }
    });
    
    // Log the complete tree structure for debugging
    console.log('=== Dependency Chain Structure ===');
    console.log('Selected Module:', { code: moduleCode, display: moduleDisplay });
    console.log('Starting Members found:', startingMembers.length);
    console.log('=== ALL MDRS MEMBERS ===');
    console.log('Total MDRS members:', this.mdrsMembers.length);
    console.log('All MDRS members:', JSON.parse(JSON.stringify(this.mdrsMembers.map((m: any) => ({
      moduleId: m.moduleId,
      referencedComponentId: m.referencedComponentId,
      additionalFields: m.additionalFields,
      sourceEffectiveTime: m.additionalFields?.sourceEffectiveTime || m.sourceEffectiveTime || m.additionalFields?.['900000000000536009'],
      targetEffectiveTime: m.additionalFields?.targetEffectiveTime || m.targetEffectiveTime || m.additionalFields?.['900000000000537000'],
      active: m.active,
      effectiveTime: m.effectiveTime,
      fullMember: m
    })))));
    console.log('MDRS Members Sample (first 5):', this.mdrsMembers.slice(0, 5));
    const coreMembers = this.mdrsMembers.filter((m: any) => {
      const sourceId = m.moduleId?.toString() || m.moduleId;
      return sourceId === '900000000000207008';
    });
    console.log('All MDRS members for core module (900000000000207008):', coreMembers.length);
    coreMembers.forEach((m: any, index: number) => {
      console.log(`Core member ${index + 1}:`, {
        moduleId: m.moduleId,
        referencedComponentId: m.referencedComponentId,
        sourceEffectiveTime_raw: m.additionalFields?.sourceEffectiveTime || m.sourceEffectiveTime,
        sourceEffectiveTime_normalized: this.normalizeEffectiveTime(m.additionalFields?.sourceEffectiveTime || m.sourceEffectiveTime),
        targetEffectiveTime_raw: m.additionalFields?.targetEffectiveTime || m.targetEffectiveTime,
        targetEffectiveTime_normalized: this.normalizeEffectiveTime(m.additionalFields?.targetEffectiveTime || m.targetEffectiveTime),
        additionalFields: m.additionalFields,
        fullMember: JSON.parse(JSON.stringify(m)) // Deep clone to avoid circular references
      });
    });
    console.log('Dependency Rows:', this.dependencyRows);
    
    // Render graph after building table
    setTimeout(() => {
      this.renderGraph();
    }, 100);
  }

  /**
   * Normalize effective time to string format (handles numbers, dates, etc.)
   */
  private normalizeEffectiveTime(effectiveTime: any): string {
    if (!effectiveTime) return '';
    // Convert to string and remove any non-numeric characters except for date separators
    const str = effectiveTime.toString().trim();
    // If it's a date format like "2025-06-01", convert to "20250601"
    if (str.includes('-')) {
      return str.replace(/-/g, '');
    }
    return str;
  }

  /**
   * Recursively add chained dependency rows
   * Finds MDRS members where the given module and effective time match as source
   */
  private addChainedRows(moduleCode: string, sourceEffectiveTime: string, processedChains: Set<string>, level: number): void {
    // Avoid infinite loops and limit depth
    if (level > 20) {
      return;
    }
    
    const moduleDisplay = this.availableModules.find(m => m.code === moduleCode)?.display || moduleCode;
    
    // Find MDRS members where this module is the source AND sourceEffectiveTime matches
    const chainedMembers = this.mdrsMembers.filter((member: any) => {
      const memberSourceId = member.moduleId?.toString() || member.moduleId;
      
      // Extract sourceEffectiveTime with multiple fallback options
      let memberSourceEffectiveTime = member.additionalFields?.sourceEffectiveTime || member.sourceEffectiveTime;
      if (member.additionalFields && typeof member.additionalFields === 'object') {
        memberSourceEffectiveTime = memberSourceEffectiveTime || 
          member.additionalFields['900000000000536009'] || 
          member.additionalFields.sourceEffectiveTime;
      }
      
      memberSourceEffectiveTime = this.normalizeEffectiveTime(memberSourceEffectiveTime);
      const normalizedSearchTime = this.normalizeEffectiveTime(sourceEffectiveTime);
      
      const matches = memberSourceId === moduleCode && memberSourceEffectiveTime === normalizedSearchTime;
      
      if (matches) {
        let memberTargetEffectiveTime = member.additionalFields?.targetEffectiveTime || member.targetEffectiveTime;
        if (member.additionalFields && typeof member.additionalFields === 'object') {
          memberTargetEffectiveTime = memberTargetEffectiveTime || 
            member.additionalFields['900000000000537000'] || 
            member.additionalFields.targetEffectiveTime;
        }
        
        console.log(`[Chain Level ${level}] Found matching member:`, {
          source: memberSourceId,
          sourceEffectiveTime: memberSourceEffectiveTime,
          target: member.referencedComponentId,
          targetEffectiveTime: this.normalizeEffectiveTime(memberTargetEffectiveTime),
          member: member,
          additionalFields: member.additionalFields
        });
      }
      
      return matches;
    });
    
    // Log all members for this module to see what we have
    const allMembersForModule = this.mdrsMembers.filter((m: any) => {
      const memberSourceId = m.moduleId?.toString() || m.moduleId;
      return memberSourceId === moduleCode;
    });
    console.log(`[Chain Level ${level}] All members for module ${moduleCode}:`, allMembersForModule.length);
    allMembersForModule.forEach((m: any, idx: number) => {
      let memberSourceEffectiveTime = m.additionalFields?.sourceEffectiveTime || m.sourceEffectiveTime;
      if (m.additionalFields && typeof m.additionalFields === 'object') {
        memberSourceEffectiveTime = memberSourceEffectiveTime || 
          m.additionalFields['900000000000536009'] || 
          m.additionalFields.sourceEffectiveTime;
      }
      const normalized = this.normalizeEffectiveTime(memberSourceEffectiveTime);
      console.log(`[Chain Level ${level}] Member ${idx + 1} for ${moduleCode}:`, {
        moduleId: m.moduleId,
        referencedComponentId: m.referencedComponentId,
        sourceEffectiveTime_raw: memberSourceEffectiveTime,
        sourceEffectiveTime_normalized: normalized,
        searchFor: sourceEffectiveTime,
        matches: normalized === this.normalizeEffectiveTime(sourceEffectiveTime),
        additionalFields: m.additionalFields
      });
    });
    
    console.log(`[Chain Level ${level}] Looking for chains from ${moduleCode} with sourceEffectiveTime ${sourceEffectiveTime}, found ${chainedMembers.length} members`);
    if (chainedMembers.length > 0) {
      console.log(`[Chain Level ${level}] Chained members:`, chainedMembers.map((m: any) => ({
        source: m.moduleId,
        sourceEffectiveTime: m.additionalFields?.sourceEffectiveTime || m.sourceEffectiveTime,
        target: m.referencedComponentId,
        targetEffectiveTime: m.additionalFields?.targetEffectiveTime || m.targetEffectiveTime
      })));
    }
    
    // For each chained member, add a row and continue the chain
    chainedMembers.forEach((member: any) => {
      const targetModuleId = member.referencedComponentId?.toString() || member.referencedComponentId || '';
      const targetModule = this.availableModules.find(m => m.code === targetModuleId);
      const targetDisplay = targetModule?.display || targetModuleId || '';
      
      // Extract targetEffectiveTime with multiple fallback options
      let targetEffectiveTime = member.additionalFields?.targetEffectiveTime || member.targetEffectiveTime;
      if (member.additionalFields && typeof member.additionalFields === 'object') {
        targetEffectiveTime = targetEffectiveTime || 
          member.additionalFields['900000000000537000'] || 
          member.additionalFields.targetEffectiveTime;
      }
      targetEffectiveTime = this.normalizeEffectiveTime(targetEffectiveTime);
      
      // Create chain key to avoid duplicates
      const chainKey = `${moduleCode}:${sourceEffectiveTime}:${targetModuleId}:${targetEffectiveTime}`;
      if (processedChains.has(chainKey)) {
        console.log(`[Chain Level ${level}] Skipping duplicate chain: ${chainKey}`);
        return;
      }
      processedChains.add(chainKey);
      
      // Add row: source module -> target module
      this.dependencyRows.push({
        sourceCode: moduleCode,
        sourceDisplay: moduleDisplay || moduleCode,
        targetCode: targetModuleId,
        targetDisplay: targetDisplay,
        sourceEffectiveTime: sourceEffectiveTime,
        targetEffectiveTime: targetEffectiveTime,
        level: level
      });
      
      console.log(`[Chain Level ${level}] Added row: ${moduleCode}(${sourceEffectiveTime}) -> ${targetModuleId}(${targetEffectiveTime})`);
      
      // Continue the chain: find next members where target becomes source with matching effective time
      if (targetModuleId && targetEffectiveTime) {
        this.addChainedRows(targetModuleId, targetEffectiveTime, processedChains, level + 1);
      } else {
        console.log(`[Chain Level ${level}] Chain ends: no targetModuleId or targetEffectiveTime`);
      }
    });
  }

  /**
   * Load both FHIR CodeSystems and Native CodeSystems and create a mapping
   * Matches: nativeCodeSystem.name === fhirCodeSystem.title
   * Maps: fhirCodeSystem.version (without date) -> nativeCodeSystem.branchPath
   */
  loadCodeSystemMapping(): void {
    // Prevent multiple simultaneous loads
    if (this.isLoadingMapping) {
      return;
    }
    
    this.isLoadingMapping = true;
    
    forkJoin({
      fhirCodeSystems: this.terminologyService.getFhirCodeSystems(),
      nativeCodeSystems: this.terminologyService.getNativeCodeSystems()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        const fhirCodeSystems = result.fhirCodeSystems?.entry || [];
        const nativeCodeSystems = result.nativeCodeSystems?.items || [];
        
        // Create mapping with only two columns
        const mapping: Array<{
          fhirVersion: string;
          nativeBranchPath: string;
        }> = [];
        
        // Process FHIR CodeSystems
        fhirCodeSystems.forEach((entry: any) => {
          const resource = entry.resource;
          if (resource && resource.version && resource.title) {
            // Keep FHIR version URI as original (without formatting the date)
            const versionUri = resource.version;
            
            // Extract date from version URI and format it with separators for native branchPath
            // Format: 20250820 -> 2025-08-20
            const dateMatch = versionUri.match(/\/version\/(\d{8})$/);
            let formattedDate = '';
            if (dateMatch && dateMatch[1]) {
              const dateStr = dateMatch[1]; // YYYYMMDD
              formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            }
            
            const fhirTitle = resource.title || '';
            
            // Find matching native code system by name matching fhir title
            const matchingNative = nativeCodeSystems.find((native: any) => {
              const nativeName = native.name || '';
              return nativeName === fhirTitle;
            });
            
            if (matchingNative) {
              // Use the date from fhirVersion to construct the native branchPath
              let branchPathWithDate = matchingNative.branchPath || '';
              if (formattedDate) {
                branchPathWithDate = `${matchingNative.branchPath}/${formattedDate}`;
              }
              
              mapping.push({
                fhirVersion: versionUri, // Keep original format
                nativeBranchPath: branchPathWithDate
              });
            }
          }
        });
        
        // Store mapping in memory for later use
        this.codeSystemMapping = mapping;
        this.isLoadingMapping = false;
        
        // After mapping is loaded, load MDRS
        this.loadMDRS();
      },
      error: (err) => {
        this.isLoadingMapping = false;
      }
    });
  }

  /**
   * Load Module Dependency Reference Set members for the selected module
   * Uses Snowstorm native API to get refset members with additional fields
   */
  loadModuleDependencies(moduleId: string): void {
    this.loading = true;
    this.error = null;
    this.dependencies = [];
    
    // First, try using Snowstorm native API (more reliable for refset members with additional fields)
    this.loadDependenciesFromSnowstormAPI(moduleId);
  }

  /**
   * Load dependencies using Snowstorm native API
   */
  private loadDependenciesFromSnowstormAPI(moduleId: string): void {
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const editionUri = this.terminologyService.getFhirUrlParam();
    
    // Extract edition and version from URI if available
    // Format: http://snomed.info/sct/[edition]/version/[date]
    let snowstormPath = 'MAIN';
    let version = '';
    
    if (editionUri.includes('/version/')) {
      const parts = editionUri.split('/version/');
      if (parts.length > 1) {
        version = parts[1];
      }
      if (parts[0].includes('/')) {
        const editionParts = parts[0].split('/');
        if (editionParts.length > 1) {
          snowstormPath = editionParts[editionParts.length - 1];
        }
      }
    }
    
    // Use Snowstorm native API: /snowstorm/snomed-ct/{branch}/members?referenceSet={refsetId}&moduleId={moduleId}
    const snowstormBase = fhirBase.replace('/fhir', '/snowstorm/snomed-ct');
    const branch = version ? `${snowstormPath}/${version}` : snowstormPath;
    const requestUrl = `${snowstormBase}/${branch}/members?referenceSet=${this.MDRS_REFERENCE_SET_ID}&moduleId=${moduleId}&active=true&limit=1000`;
    
    const headers = new HttpHeaders({
      'Accept-Language': this.terminologyService.getLang()
    });
    
    this.http.get<any>(requestUrl, { headers }).pipe(
      takeUntil(this.destroy$),
      switchMap((response: any) => {
        if (response?.items && response.items.length > 0) {
          // Process members with additionalFields
          const processedDependencies = response.items.map((item: any) => {
            const dep: ModuleDependency = {
              id: item.id || '',
              moduleId: item.moduleId || moduleId,
              referencedComponentId: item.referencedComponentId || '',
              sourceEffectiveTime: item.additionalFields?.sourceEffectiveTime,
              targetEffectiveTime: item.additionalFields?.targetEffectiveTime,
              active: item.active !== false
            };
            
            // If additionalFields come as a string, parse it
            if (!dep.sourceEffectiveTime && item.additionalFields) {
              // Check if there's a string field with all data
              const fieldsString = item.additionalFields.value || item.additionalFields.additionalFields;
              if (fieldsString && typeof fieldsString === 'string') {
                const parsed = this.parseAdditionalFieldsString(fieldsString);
                dep.sourceEffectiveTime = parsed.sourceEffectiveTime;
                dep.targetEffectiveTime = parsed.targetEffectiveTime;
                if (!dep.referencedComponentId) {
                  dep.referencedComponentId = parsed.referencedComponentId || '';
                }
              }
            }
            
            return dep;
          }).filter((dep: ModuleDependency) => dep.referencedComponentId);
          
          // Get display names for target modules
          const targetModuleIds = [...new Set(processedDependencies.map((d: ModuleDependency) => d.referencedComponentId))];
          
          if (targetModuleIds.length === 0) {
            return of({ dependencies: processedDependencies, modules: {} });
          }
          
          // Fetch display names for target modules
          const moduleLookups = targetModuleIds.map(id => 
            this.terminologyService.expandValueSet(
              `^${id}`,
              '',
              0,
              1
            ).pipe(
              switchMap((response: any) => {
                const display = response?.expansion?.contains?.[0]?.display || id;
                return of({ id, display });
              }),
              catchError(() => of({ id, display: id }))
            )
          );
          
          return forkJoin(moduleLookups).pipe(
            switchMap((results: any[]) => {
              const moduleMap: Record<string, string> = {};
              results.forEach(r => {
                moduleMap[r.id] = r.display;
              });
              return of({ dependencies: processedDependencies, modules: moduleMap });
            })
          );
        } else {
          // Fallback to FHIR expand if native API doesn't work
          return this.loadDependenciesFromExpand(moduleId);
        }
      }),
      catchError((err) => {
        console.warn('Snowstorm API failed, trying FHIR expand:', err);
        // Fallback to FHIR expand
        return this.loadDependenciesFromExpand(moduleId);
      })
    ).subscribe({
      next: (result: any) => {
        this.dependencies = result.dependencies.map((dep: ModuleDependency) => ({
          ...dep,
          targetModuleDisplay: result.modules[dep.referencedComponentId] || dep.referencedComponentId
        }));
        this.loading = false;
        
        if (this.dependencies.length === 0) {
          this.snackBar.open('No dependencies found for this module', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Error loading dependencies:', err);
        this.error = 'Error loading module dependencies';
        this.loading = false;
        this.snackBar.open('Error loading module dependencies', 'Close', { duration: 5000 });
      }
    });
  }

  /**
   * Fallback: Load dependencies using FHIR expand (to test how additional columns are returned)
   */
  private loadDependenciesFromExpand(moduleId: string): Observable<any> {
    const ecl = `^${this.MDRS_REFERENCE_SET_ID} |Module dependency reference set|`;
    
    return this.terminologyService.expandValueSetFromServer(
      this.terminologyService.getSnowstormFhirBase(),
      this.terminologyService.getFhirUrlParam(),
      ecl,
      '',
      0,
      1000
    ).pipe(
      switchMap((data) => {
        if (data?.expansion?.contains) {
          // Process members to extract additional columns from expand response
          const processedDependencies = this.processRefsetMembersFromExpand(data.expansion.contains, moduleId);
          
          // Get display names for target modules
          const targetModuleIds = [...new Set(processedDependencies.map(d => d.referencedComponentId))];
          
          if (targetModuleIds.length === 0) {
            return of({ dependencies: [], modules: {} });
          }
          
          // Fetch display names for target modules
          const moduleLookups = targetModuleIds.map(id => 
            this.terminologyService.expandValueSet(
              `^${id}`,
              '',
              0,
              1
            ).pipe(
              switchMap((response: any) => {
                const display = response?.expansion?.contains?.[0]?.display || id;
                return of({ id, display });
              }),
              catchError(() => of({ id, display: id }))
            )
          );
          
          return forkJoin(moduleLookups).pipe(
            switchMap((results: any[]) => {
              const moduleMap: Record<string, string> = {};
              results.forEach(r => {
                moduleMap[r.id] = r.display;
              });
              return of({ dependencies: processedDependencies, modules: moduleMap });
            })
          );
        }
        return of({ dependencies: [], modules: {} });
      })
    );
  }

  /**
   * Parse additional fields from a string (as mentioned by user)
   */
  private parseAdditionalFieldsString(fieldsString: string): { referencedComponentId?: string; sourceEffectiveTime?: string; targetEffectiveTime?: string } {
    // Try different delimiters: pipe, comma, tab, semicolon
    const delimiters = ['|', ',', '\t', ';'];
    let parts: string[] = [];
    
    for (const delimiter of delimiters) {
      if (fieldsString.includes(delimiter)) {
        parts = fieldsString.split(delimiter);
        break;
      }
    }
    
    if (parts.length === 0) {
      parts = [fieldsString];
    }
    
    return {
      referencedComponentId: parts[0]?.trim(),
      sourceEffectiveTime: parts[1]?.trim(),
      targetEffectiveTime: parts[2]?.trim()
    };
  }


  /**
   * Process refset members from expand response to extract additional columns
   * According to spec, additional columns come as strings that need to be parsed
   */
  private processRefsetMembersFromExpand(members: any[], sourceModuleId: string): ModuleDependency[] {
    return members.map((member: any) => {
      const dependency: ModuleDependency = {
        id: member.code || '',
        moduleId: sourceModuleId,
        referencedComponentId: '',
        sourceEffectiveTime: undefined,
        targetEffectiveTime: undefined,
        active: true
      };
      
      // Extract referencedComponentId (target module) - this is the code in the expand response
      dependency.referencedComponentId = member.code || '';
      
      // Extract additional columns from properties or extension
      // According to user, these come as strings to be separated
      if (member.extension) {
        for (const ext of member.extension) {
          if (ext.url && ext.url.includes('sourceEffectiveTime')) {
            dependency.sourceEffectiveTime = ext.valueString || ext.valueDate;
          }
          if (ext.url && ext.url.includes('targetEffectiveTime')) {
            dependency.targetEffectiveTime = ext.valueString || ext.valueDate;
          }
          if (ext.url && ext.url.includes('referencedComponentId')) {
            dependency.referencedComponentId = ext.valueString || ext.valueCode || ext.valueReference?.reference;
          }
        }
      }
      
      // Check if there's a property with the additional data
      if (member.property) {
        for (const prop of member.property) {
          if (prop.code === 'sourceEffectiveTime' || prop.code === '900000000000536009') {
            dependency.sourceEffectiveTime = prop.valueString || prop.valueDate;
          }
          if (prop.code === 'targetEffectiveTime' || prop.code === '900000000000537000') {
            dependency.targetEffectiveTime = prop.valueString || prop.valueDate;
          }
          if (prop.code === 'referencedComponentId' || prop.code === '900000000000535008') {
            dependency.referencedComponentId = prop.valueString || prop.valueCode;
          }
        }
      }
      
      // Check if there's a designation or other field with delimited string values
      // The user mentioned columns come as strings to be separated
      if (member.designation) {
        for (const designation of member.designation) {
          if (designation.use?.code === '900000000000550004') { // Refset member additional attribute
            // Parse the value if it contains multiple fields
            const value = designation.value;
            if (value && typeof value === 'string') {
              const parsed = this.parseAdditionalFieldsString(value);
              if (parsed.referencedComponentId && !dependency.referencedComponentId) {
                dependency.referencedComponentId = parsed.referencedComponentId;
              }
              if (parsed.sourceEffectiveTime && !dependency.sourceEffectiveTime) {
                dependency.sourceEffectiveTime = parsed.sourceEffectiveTime;
              }
              if (parsed.targetEffectiveTime && !dependency.targetEffectiveTime) {
                dependency.targetEffectiveTime = parsed.targetEffectiveTime;
              }
            }
          }
        }
      }
      
      // Also check if there's a display or other field that might contain the delimited data
      if (member.display && typeof member.display === 'string' && member.display.includes('|')) {
        const parsed = this.parseAdditionalFieldsString(member.display);
        if (parsed.referencedComponentId && !dependency.referencedComponentId) {
          dependency.referencedComponentId = parsed.referencedComponentId;
        }
        if (parsed.sourceEffectiveTime && !dependency.sourceEffectiveTime) {
          dependency.sourceEffectiveTime = parsed.sourceEffectiveTime;
        }
        if (parsed.targetEffectiveTime && !dependency.targetEffectiveTime) {
          dependency.targetEffectiveTime = parsed.targetEffectiveTime;
        }
      }
      
      return dependency;
    }).filter(dep => dep.referencedComponentId && dep.referencedComponentId !== sourceModuleId); // Filter out invalid entries and self-references
  }

  formatEffectiveTime(effectiveTime?: string): string {
    if (!effectiveTime) return 'N/A';
    // Format YYYYMMDD to YYYY-MM-DD
    if (effectiveTime.length === 8 && /^\d+$/.test(effectiveTime)) {
      return `${effectiveTime.substring(0, 4)}-${effectiveTime.substring(4, 6)}-${effectiveTime.substring(6, 8)}`;
    }
    return effectiveTime;
  }

  clearSelection(): void {
    this.selectedModule = null;
    this.moduleControl.setValue(null);
    this.dependencies = [];
    this.dependencyRows = [];
    this.error = null;
    // Clear graph
    if (this.graphContainer) {
      this.graphContainer.nativeElement.innerHTML = '';
    }
  }

  /**
   * Handle data source mode change
   */
  onDataSourceModeChange(): void {
    // Clear everything when switching modes
    this.clearSelection();
    this.availableModules = [];
    this.mdrsMembers = [];
    this.uploadedFile = null;
    this.moduleControl.disable();
    
    if (this.dataSourceMode === 'server') {
      // Load from server
      this.loadCodeSystemMapping();
    } else {
      // Upload mode - wait for file upload
    }
  }

  /**
   * Handle file selection for MDRS snapshot upload
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.uploadedFile = file;
    this.uploadingFile = true;
    this.error = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        this.parseMDRSSnapshotFile(content);
      } catch (error: any) {
        this.error = 'Error parsing file: ' + (error.message || 'Unknown error');
        this.uploadingFile = false;
        this.snackBar.open('Error parsing MDRS snapshot file', 'Close', { duration: 5000 });
      }
    };

    reader.onerror = () => {
      this.error = 'Error reading file';
      this.uploadingFile = false;
      this.snackBar.open('Error reading file', 'Close', { duration: 5000 });
    };

    reader.readAsText(file);
  }

  /**
   * Parse MDRS snapshot TSV file
   */
  private parseMDRSSnapshotFile(content: string): void {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      throw new Error('File must contain at least a header row and one data row');
    }

    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split('\t').map(h => h.trim());
    
    // Expected columns: id, effectiveTime, active, moduleId, refsetId, referencedComponentId, sourceEffectiveTime, targetEffectiveTime
    const expectedColumns = ['id', 'effectiveTime', 'active', 'moduleId', 'refsetId', 'referencedComponentId', 'sourceEffectiveTime', 'targetEffectiveTime'];
    
    // Validate headers
    const missingColumns = expectedColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Parse data rows
    const members: any[] = [];
    const moduleIds = new Set<string>();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split('\t');
      
      if (values.length !== headers.length) {
        continue; // Skip malformed rows
      }

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      // Only process active members
      if (row.active === '1') {
        const member: any = {
          id: row.id,
          effectiveTime: row.effectiveTime,
          active: row.active === '1',
          moduleId: row.moduleId,
          refsetId: row.refsetId,
          referencedComponentId: row.referencedComponentId,
          sourceEffectiveTime: row.sourceEffectiveTime,
          targetEffectiveTime: row.targetEffectiveTime,
          additionalFields: {
            sourceEffectiveTime: row.sourceEffectiveTime,
            targetEffectiveTime: row.targetEffectiveTime
          }
        };

        members.push(member);
        
        // Collect unique module IDs
        if (member.moduleId) {
          moduleIds.add(member.moduleId);
        }
        if (member.referencedComponentId) {
          moduleIds.add(member.referencedComponentId);
        }
      }
    }

    // Store MDRS members
    this.mdrsMembers = members;
    this.uploadingFile = false;

    // Extract unique modules and load their display names
    this.extractAndLoadModuleDisplays(Array.from(moduleIds));
  }

  /**
   * Extract unique modules from MDRS and load their display names
   */
  private extractAndLoadModuleDisplays(moduleIds: string[]): void {
    if (moduleIds.length === 0) {
      this.availableModules = [];
      this.loadingModules = false;
      this.moduleControl.disable();
      return;
    }

    this.loadingModules = true;
    this.moduleControl.disable();
    
    // Build ECL query: id1 OR id2 OR id3 ...
    const eclQuery = moduleIds.join(' OR ');
    
    this.terminologyService.expandValueSet(eclQuery, '', 0, moduleIds.length).subscribe({
      next: (response: any) => {
        const modules: Module[] = [];
        const contains = response?.expansion?.contains || [];
        
        contains.forEach((item: any) => {
          modules.push({
            code: item.code || '',
            display: item.display || item.code || ''
          });
        });

        // Ensure all module IDs have entries (even if display name not found)
        moduleIds.forEach(id => {
          if (!modules.find(m => m.code === id)) {
            modules.push({
              code: id,
              display: id
            });
          }
        });

        this.availableModules = modules.sort((a, b) => 
          (a.display || a.code).localeCompare(b.display || b.code)
        );
        this.loadingModules = false;
        this.moduleControl.enable();
        this.snackBar.open('Modules successfully loaded from MDRS file', 'Close', { duration: 3000 });
      },
      error: (error) => {
        // If expand fails, just use module IDs as display names
        this.availableModules = moduleIds.map(id => ({
          code: id,
          display: id
        })).sort((a, b) => a.code.localeCompare(b.code));
        this.loadingModules = false;
        this.moduleControl.enable();
        this.snackBar.open('Warning: Could not load module display names', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Render dependency graph using Graphviz (viz.js)
   */
  async renderGraph(): Promise<void> {
    if (!this.graphContainer || !this.selectedModule || this.dependencyRows.length === 0) {
      return;
    }

    // Clear previous graph
    this.graphContainer.nativeElement.innerHTML = '';

    // Create root node from selected module
    const root = {
      code: this.selectedModule.code,
      display: this.selectedModule.display
    };

    // Generate DOT code directly from dependency rows
    const dotCode = this.generateDotCode(root);

    try {
      // Initialize viz if not already done
      if (!this.viz) {
        this.viz = await instance();
      }

      // Render DOT to SVG string with size constraints
      const svgString = this.viz.renderString(dotCode, { 
        format: 'svg', 
        engine: 'dot',
        graphAttributes: {
          size: '12,10', // Maximum size in inches (width, height)
          ratio: 'auto' // Auto ratio to fit content
        }
      });
      
      // Insert SVG into container
      this.graphContainer.nativeElement.innerHTML = svgString;
      
      // Make SVG responsive but maintain aspect ratio and center it
      const svgElement = this.graphContainer.nativeElement.querySelector('svg');
      if (svgElement) {
        // Get container width
        const containerWidth = this.graphContainer.nativeElement.offsetWidth || 1200;
        
        // Get SVG dimensions from viewBox
        const viewBox = svgElement.getAttribute('viewBox');
        let svgWidth = 0;
        let svgHeight = 0;
        
        if (viewBox) {
          const [x, y, width, height] = viewBox.split(' ').map(Number);
          svgWidth = width;
          svgHeight = height;
        } else {
          // Fallback to width/height attributes if viewBox not available
          svgWidth = parseFloat(svgElement.getAttribute('width') || '0');
          svgHeight = parseFloat(svgElement.getAttribute('height') || '0');
        }
        
        // Calculate scale to prevent it from being too large
        // Maximum width should be 80% of container, with a minimum scale of 0.3
        const maxWidth = containerWidth * 0.8;
        const scaleFactor = Math.max(0.3, Math.min(1, maxWidth / svgWidth));
        
        // Apply scaling
        const scaledWidth = svgWidth * scaleFactor;
        const scaledHeight = svgHeight * scaleFactor;
        
        svgElement.setAttribute('width', `${scaledWidth}px`);
        svgElement.setAttribute('height', `${scaledHeight}px`);
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgElement.style.display = 'block';
        svgElement.style.margin = '0 auto'; // Center horizontally
        svgElement.style.maxWidth = '80%'; // Prevent horizontal expansion
        svgElement.style.background = '#ffffff';
        
        // Remove any native title elements that Graphviz might have added
        const titleElements = svgElement.querySelectorAll('title');
        titleElements.forEach((title: Element) => title.remove());
        
        // Add tooltips to edges using JavaScript
        this.addTooltipsToEdges(svgElement);
      }
    } catch (error) {
      console.error('Error rendering graph:', error);
      this.graphContainer.nativeElement.innerHTML = '<p style="color: red;">Error rendering graph</p>';
    }
  }

  /**
   * Build tree structure from dependency rows
   */
  private buildTreeStructure(): any {
    if (!this.selectedModule || this.dependencyRows.length === 0) {
      return null;
    }

    // Create root node
    const root: any = {
      code: this.selectedModule.code,
      display: this.selectedModule.display,
      children: []
    };

    // Build tree by level
    const nodesByLevel = new Map<number, Map<string, any>>();
    nodesByLevel.set(0, new Map([[root.code, root]]));

    // Process each dependency row
    this.dependencyRows.forEach(row => {
      const level = row.level;
      const targetCode = row.targetCode;
      const targetDisplay = row.targetDisplay;

      if (!targetCode) {
        return; // Skip rows without target
      }

      // Get or create parent level
      const parentLevel = level - 1;
      const parentNodes = nodesByLevel.get(parentLevel);
      
      if (!parentNodes) {
        return;
      }

      // Find parent node (source of this row)
      const parentCode = row.sourceCode;
      const parentNode = parentNodes.get(parentCode);

      if (!parentNode) {
        return;
      }

      // Get or create current level
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, new Map());
      }
      const currentLevelNodes = nodesByLevel.get(level)!;

      // Check if node already exists
      if (!currentLevelNodes.has(targetCode)) {
        const newNode: any = {
          code: targetCode,
          display: targetDisplay,
          children: []
        };
        currentLevelNodes.set(targetCode, newNode);
        parentNode.children.push(newNode);
      }
    });

    return root;
  }

  /**
   * Generate DOT code from dependency rows
   * Each row creates a source->target edge, reusing nodes when they appear multiple times
   */
  private generateDotCode(root: any): string {
    const lines: string[] = [];
    lines.push('digraph G {');
    lines.push('  rankdir=BT;'); // Bottom to top
    lines.push('  node [shape=box, style=rounded, fontname="Arial"];');
    lines.push('  edge [arrowhead=vee, color="#999", penwidth=3];'); // Thicker edges
    lines.push('');

    // Collect all unique nodes from dependency rows
    const nodes = new Map<string, { code: string; display: string; isRoot: boolean }>();
    const edges: Array<{ from: string; to: string; tooltip: string }> = [];

    // First, identify the root node (selected module)
    const rootId = this.escapeDotId(root.code);
    nodes.set(rootId, {
      code: root.code,
      display: root.display || root.code,
      isRoot: true
    });

    // Process each dependency row to collect all nodes and edges
    this.dependencyRows.forEach(row => {
      const sourceId = this.escapeDotId(row.sourceCode);
      const targetId = this.escapeDotId(row.targetCode);

      // Add source node if not already present
      if (!nodes.has(sourceId)) {
        nodes.set(sourceId, {
          code: row.sourceCode,
          display: row.sourceDisplay || row.sourceCode,
          isRoot: sourceId === rootId
        });
      }

      // Add target node if not already present
      if (row.targetCode && !nodes.has(targetId)) {
        nodes.set(targetId, {
          code: row.targetCode,
          display: row.targetDisplay || row.targetCode,
          isRoot: targetId === rootId
        });
      }

      // Add edge from source to target with tooltip
      if (row.targetCode) {
        const sourceEffectiveTime = row.sourceEffectiveTime || 'N/A';
        const targetEffectiveTime = row.targetEffectiveTime || 'N/A';
        const tooltip = `Source Effective Time: ${sourceEffectiveTime}\\nTarget Effective Time: ${targetEffectiveTime}`;
        edges.push({ from: sourceId, to: targetId, tooltip });
      }
    });

    // Add root node with special styling
    const rootLabel = this.escapeDotLabel(`${root.display}\\n(${root.code})`);
    lines.push(`  "${rootId}" [label="${rootLabel}", fillcolor="#1976d2", fontcolor="white", style="rounded,filled"];`);
    lines.push('');

    // Add other nodes
    nodes.forEach((node, nodeId) => {
      if (nodeId !== rootId) {
        const label = this.escapeDotLabel(`${node.display}\\n(${node.code})`);
        lines.push(`  "${nodeId}" [label="${label}", fillcolor="#43a047", fontcolor="white", style="rounded,filled"];`);
      }
    });
    lines.push('');

    // Add edges without tooltip attribute (we'll add custom tooltips via JavaScript)
    edges.forEach(edge => {
      lines.push(`  "${edge.from}" -> "${edge.to}";`);
    });

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Escape special characters for DOT node IDs
   */
  private escapeDotId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Escape special characters for DOT labels
   */
  private escapeDotLabel(label: string): string {
    return label.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Add tooltips to edges in the SVG using JavaScript
   */
  private addTooltipsToEdges(svgElement: SVGElement): void {
    // Find all edges (paths) in the SVG
    const edges = svgElement.querySelectorAll('g.edge path, g.edge polygon');
    
    // Create a map of edge IDs to tooltip data from dependencyRows
    const edgeTooltips = new Map<string, string>();
    
    this.dependencyRows.forEach(row => {
      const sourceId = this.escapeDotId(row.sourceCode);
      const targetId = this.escapeDotId(row.targetCode);
      const edgeKey = `${sourceId}-${targetId}`;
      
      const sourceEffectiveTime = row.sourceEffectiveTime || 'N/A';
      const targetEffectiveTime = row.targetEffectiveTime || 'N/A';
      const tooltip = `Source: ${sourceEffectiveTime}\nTarget: ${targetEffectiveTime}`;
      
      edgeTooltips.set(edgeKey, tooltip);
    });
    
    // Add tooltips to edges
    edges.forEach((edge, index) => {
      const parentGroup = edge.closest('g.edge');
      if (!parentGroup) return;
      
      // Try to find the edge ID from the parent group's class or ID
      const edgeId = parentGroup.getAttribute('id') || parentGroup.getAttribute('class') || '';
      
      // Find matching tooltip - we'll use the first matching row for this edge
      let tooltipText = '';
      for (const [key, tooltip] of edgeTooltips.entries()) {
        if (edgeId.includes(key.split('-')[0]) && edgeId.includes(key.split('-')[1])) {
          tooltipText = tooltip;
          break;
        }
      }
      
      // If no match found, try to get from the first dependency row
      if (!tooltipText && this.dependencyRows.length > 0) {
        const row = this.dependencyRows[index % this.dependencyRows.length];
        const sourceEffectiveTime = row.sourceEffectiveTime || 'N/A';
        const targetEffectiveTime = row.targetEffectiveTime || 'N/A';
        tooltipText = `Source: ${sourceEffectiveTime}\nTarget: ${targetEffectiveTime}`;
      }
      
      if (tooltipText) {
        // Add mouse events for custom tooltip only (no native title element)
        parentGroup.addEventListener('mouseenter', (e: Event) => {
          if (e instanceof MouseEvent) {
            this.showCustomTooltip(e, tooltipText);
          }
        });
        
        parentGroup.addEventListener('mouseleave', () => {
          this.hideCustomTooltip();
        });
        
        parentGroup.addEventListener('mousemove', (e: Event) => {
          if (e instanceof MouseEvent && document.getElementById('mdrs-edge-tooltip')) {
            this.updateTooltipPosition(e);
          }
        });
      }
    });
  }

  /**
   * Show custom tooltip
   */
  private showCustomTooltip(event: MouseEvent, text: string): void {
    // Remove existing tooltip if any
    this.hideCustomTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.id = 'mdrs-edge-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '10000';
    tooltip.style.whiteSpace = 'pre-line';
    tooltip.style.maxWidth = '300px';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip near cursor
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
  }

  /**
   * Hide custom tooltip
   */
  private hideCustomTooltip(): void {
    const tooltip = document.getElementById('mdrs-edge-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Update tooltip position
   */
  private updateTooltipPosition(event: MouseEvent): void {
    const tooltip = document.getElementById('mdrs-edge-tooltip');
    if (tooltip) {
      tooltip.style.left = (event.pageX + 10) + 'px';
      tooltip.style.top = (event.pageY + 10) + 'px';
    }
  }

}

