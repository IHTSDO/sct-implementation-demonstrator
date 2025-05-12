import { AfterViewInit, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-snomed-hub',
  templateUrl: './snomed-hub.component.html',
  styleUrls: ['./snomed-hub.component.scss'],
  standalone: false
})
export class SnomedHubComponent implements AfterViewInit, OnInit {

  @ViewChild('lines',   { static: true })  svg!: ElementRef<SVGSVGElement>;
  @ViewChild('diagram', { static: true })  host!: ElementRef<HTMLElement>;

  @ViewChild('centerColumn', { static: true })
  centerCol!: ElementRef<HTMLElement>;

  @ViewChildren('cardLabel', { read: ElementRef })
  cardLabels!: QueryList<ElementRef<HTMLElement>>;

  searchBinding = { ecl: '*', title: 'Search a SNOMED CT concept or click on a collaboration box...' };
  selectedCode: any = null;
  selectedCodeTerm = "";
  searching = false;
  searchCompleted = false;
  examples: any[] = [];
  examplesSource: any;
  resultsNarrative = '';

  /* ---------------  Top row  ------------------------------------------------ */
topRow: SnomedBox[] = [
    {
      label: 'AAP/EPF Periodontal',
      description: 'Joint refset for periodontal terms curated with the American Academy of Periodontology and the European Federation of Periodontology.',
      refsetIds: ['787444003'],
      type: 'content',
      title: false
    },
    {
      label: 'GMDN devices',
      description: 'Global Medical Device Nomenclature concepts aligned to SNOMED CT for consistent device coding.',
      refsetIds: ['467614008'],
      type: 'content',
      title: true
    },
    {
      label: 'ADA SNODENT',
      description: 'American Dental Association’s SNODENT vocabulary integrated into SNOMED CT for oral‑health documentation.',
      refsetIds: ['721144007', '721145008'],
      type: 'content',
      title: false
    },
    {
      label: 'EDQM dose forms',
      description: 'European Directorate for the Quality of Medicines dose‑form terminology mapped to SNOMED medicinal product model.',
      refsetIds: ['1237627005'],
      type: 'map',
      title: false
    },
    {
      label: 'ICD‑10',
      description: 'WHO ICD‑10 to SNOMED CT map supporting statistical reporting and clinical capture.',
      refsetIds: ['447562003'],
      type: 'map',
      title: false
    },
    {
      label: 'ICD‑11 MMS',
      description: 'Authoritative map between SNOMED CT clinical content and ICD‑11 Mortality & Morbidity Statistics.',
      type: 'map',
      title: false
    },
    {
      label: 'ICD‑O',
      description: 'SNOMED CT and  International Classification of Diseases for Oncology tumour morphology alignment.',
      refsetIds: ['446608001'],
      type: 'map',
      title: true
    },
    {
      label: 'HPO',
      description: 'Human Phenotype Ontology terms cross‑linked to SNOMED CT for genomic and rare‑disease applications.',
      type: 'map',
      title: false
    }
  ];

  /* ---------------  Left column  ------------------------------------------- */
  leftCol: SnomedBox[] = [
    {
      label: 'AJCC Cancer Staging',
      description: 'SNOMED CT value sets that encode AJCC TNM cancer‑staging categories.',
      annotationValue: 'American College of Surgeons',
      // annotationValue: 'American College of Surgeons, Chicago, Illinois: https://www.facs.org/quality-programs/cancer/ajcc/cancer-staging',
      type: 'content',
      title: false
    },
    {
      label: 'Union for International Cancer Control',
      description: 'UICC TNM staging elements represented in SNOMED CT for global oncology interoperability.',
      annotationValue: 'Union for International Cancer Control: https://www.uicc.org/who-we-are/about-uicc/uicc-and-tnm',
      type: 'content',
      title: false
    },
    {
      label: 'Convergent Medical Terminology',
      description: 'Kaiser Permanente’s CMT concepts subsumed into SNOMED CT for wider reuse.',
      type: 'content',
      title: false
    },
    {
      label: 'ICNP nursing',
      description: 'International Classification for Nursing Practice subsets mapped to SNOMED CT for nursing documentation.',
      refsetIds: ['711112009', '712505008'],
      type: 'content',
      title: false
    },
    {
      label: 'INSERM Orphanet rare disease',
      description: 'Rare‑disease concepts from Orphanet aligned to SNOMED CT for precision medicine.',
      annotationValue: 'Inserm Orphanet',
      type: 'content',
      title: false
    },
    {
      label: 'ILAE Epilepsy',
      description: 'International League Against Epilepsy seizure & syndrome classifications represented in SNOMED CT.',
      type: 'content',
      title: false
    },
    {
      label: 'IDDSI Diet',
      description: 'International Dysphagia Diet Standardisation Initiative texture levels encoded in SNOMED CT.',
      type: 'content',
      title: false
    }
  ];

  /* ---------------  Right column  ------------------------------------------ */
  rightCol: SnomedBox[] = [
    {
      label: 'MedDRA',
      description: 'SNOMED CT and  MedDRA map for pharmacovigilance and adverse‑event reporting.',
      refsetIds: ['816210007', '1193497006'],
      type: 'map',
      title: false
    },
    {
      label: 'Orphanet',
      description: 'Additional Orphanet rare‑disease identifiers maintained as a SNOMED CT map for research registries.',
      refsetIds: ['784008009'],
      type: 'map',
      title: false
    },
    {
      label: 'DICOM',
      description: 'Value sets for imaging procedure codes shared between DICOM and SNOMED CT.',
      refsetIds: ['1119410008'],
      type: 'refset',
      title: false
    },
    {
      label: 'IHE Profiles',
      description: 'SNOMED CT refsets supporting Integrating‑the‑Healthcare‑Enterprise profiles (e.g., APSR, PaLM).',
      type: 'refset',
      title: false
    },
    {
      label: 'Dentistry Odontogram',
      description: 'Dental odontogram reference set aligning charting symbols with SNOMED CT concepts.',
      refsetIds: ['721145008'],
      type: 'refset',
      title: false
    }
  ];

  /* ---------------  Bottom row  ------------------------------------------- */
  bottomRow: SnomedBox[] = [
    {
      label: 'LOINC Extension',
      description: 'SNOMED CT extension that re‑uses LOINC parts for detailed laboratory and clinical observations.',
      type: 'extension',
      title: false
    },
    {
      label: 'GMDN equivalency file',
      description: 'Equivalency table linking Global Medical Device Nomenclature terms to SNOMED CT concepts.',
      type: 'extension',
      title: true
    },
    {
      label: 'NCPT',
      description: 'Nutrition Care Process Terminology refset for dietetics assessments and interventions.',
      refsetIds: ['1303957004'],
      type: 'refset',
      title: false
    },
    {
      label: 'ERA',
      description: 'Endocrine Rare‑disease Alliance subset (or local “ERA” set) modelled in SNOMED CT.',
      type: 'refset',
      title: false
    },
    {
      label: 'GP/FP',
      description: 'General Practice/Family Practice subset for primary‑care problem‑lists.',
      refsetIds: ['450970008'],
      type: 'refset',
      title: false
    },
    {
      label: 'ICNP',
      description: 'International Nursing refset reused as a diagnostic subset within SNOMED CT.',
      type: 'refset',
      title: false
    },
    {
      label: 'HL7 IPS',
      description: 'Value sets for the HL7 International Patient Summary profile expressed with SNOMED CT codes.',
      refsetIds: ['816080008'],
      type: 'refset',
      title: true
    },
    {
      label: 'Dentistry Diagnosis',
      description: 'Diagnostic subset for common dental conditions, curated with the ADA.',
      refsetIds: ['721144007'],
      type: 'refset',
      title: false
    }
  ];


  // GPS 787778008

  constructor(private terminologyService: TerminologyService) {
  }

  ngOnInit(): void {
      setTimeout(() => this.terminologyService.setFhirUrlParam('http://snomed.info/sct/705115006/version/20250101'), 2000);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.drawSpokes();
    }, 100);
  }

  @HostListener('window:resize')
  onResize() { this.drawSpokes(); }

  private drawSpokes(): void {
    // ── safety net ───────────────────────────────────────────────
    if (!this.host || !this.centerCol) { return; }
  
    // ── 1. clear the SVG ────────────────────────────────────────
    const svg = this.svg.nativeElement as SVGSVGElement;
    svg.innerHTML = '';
  
    // ── 2. reference frame: the .diagram element ────────────────
    const hostRect = this.host.nativeElement.getBoundingClientRect();
  
    // ── 3. hub (centre column) in the SVG’s coordinate space ────
    const hubRect = this.centerCol.nativeElement.getBoundingClientRect();
    const hubX = hubRect.left - hostRect.left + hubRect.width  / 2;
    const hubY = hubRect.top  - hostRect.top  + hubRect.height / 2;
  
    // ── 4. one spoke per card ───────────────────────────────────
    this.cardLabels.forEach(cardRef => {
      const card = cardRef.nativeElement;
      const r = card.getBoundingClientRect();
  
      const spokeX = r.left - hostRect.left + r.width  / 2;
      const spokeY = r.top  - hostRect.top  + r.height / 2;
  
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', hubX.toString());
      line.setAttribute('y1', hubY.toString());
      line.setAttribute('x2', spokeX.toString());
      line.setAttribute('y2', spokeY.toString());
      line.setAttribute('stroke', '#9ca3af');      // grey‑500
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(line);
    });
  
    // ── 5. keep the SVG the same size as the diagram ────────────
    svg.setAttribute('viewBox', `0 0 ${hostRect.width} ${hostRect.height}`);
  }
  

  getMiddleBoxIndex(content: any[]): number {
    // Adjust based on your slice: slice(1, topRow.length - 1) ⇒ real index range = 1 to length - 2
    const length = content.length - 2;
    return Math.floor((length - 1) / 2);
  }

  codeSelected(code: any) {
    if (!code || !code.code) {
        this.searchCompleted = false;
        return;
    }
    this.reset();
    this.searching = true;
    this.searchCompleted = false;
    // Combine all card arrays
    const allBoxes = [...this.topRow, ...this.leftCol, ...this.rightCol, ...this.bottomRow];
    // Clear previous results
    allBoxes.forEach(box => box.results = []);
    this.selectedCodeTerm = code.display + ' - SCTID: ' + code.code;
    this.selectedCode = code;
    this.resultsNarrative = 'The concept is part of SNOMED Integrations with ';
    this.terminologyService.getMemberships(code.code).subscribe((memberships: any) => {
        this.selectedCode.memberships = memberships;
        // Combine all card arrays
        const allBoxes = [...this.topRow, ...this.leftCol, ...this.rightCol, ...this.bottomRow];
        // Clear previous results
        allBoxes.forEach(box => box.results = []);
        // Match each membership
        memberships.items.forEach((membership: any) => {
            allBoxes.forEach(box => {
              if (box.refsetIds?.includes(membership.refsetId)) {
                if (!box.results) {
                    box.results = [];
                }
                box.results.push(membership.referencedComponentId);
                this.resultsNarrative = this.resultsNarrative + box.label + ', ';
                box.mapTargets = [];
                if (membership.additionalFields.mapTarget) {
                    box.mapTargets.push(membership.additionalFields.mapTarget);
                }
                box.mapSources = [];
                if (membership.additionalFields.mapSource) {
                    box.mapSources.push(membership.additionalFields.mapSource);
                }
              }
              if (box.annotationValue && membership.additionalFields.value) {
                  const annotation = membership.additionalFields.value;
                  if (annotation.startsWith(box.annotationValue)) {
                      this.resultsNarrative = this.resultsNarrative + box.label + ', ';
                      box.results.push(membership.referencedComponentId);
                  }
              }
            });
        });
        if (this.resultsNarrative.endsWith(', ')) {
            this.resultsNarrative = this.resultsNarrative.slice(0, -2);
        }
        if (this.resultsNarrative.endsWith('with ')) {
            this.resultsNarrative = '';
        }
        this.searching = false;
        this.searchCompleted = true;
    });
  }

  reset() {
    this.searching = false;
    this.examples = [];
    // set exmaplesSource to undefined
    this.examplesSource = undefined;
    this.searchCompleted = false;
    this.selectedCode = null;
    this.selectedCodeTerm = "";
    this.resultsNarrative = '';
    // Clear all results
    const allBoxes = [...this.topRow, ...this.leftCol, ...this.rightCol, ...this.bottomRow];
    allBoxes.forEach(box => box.results = []);
  }

  getCalloutMessage(box: SnomedBox): string {
    switch (box.type) {
      case 'content':
        return 'Part of project';
      case 'map':
        if (box.mapSources && box.mapSources.length > 0) {
          return 'Maps from ' + box.mapSources.slice(0, 2).join(', ') + (box.mapSources.length > 2 ? '...' : '');
        } else if (box.mapTargets && box.mapTargets.length > 0) {
          return 'Maps to ' + box.mapTargets.slice(0, 2).join(', ') + (box.mapTargets.length > 2 ? '...' : '');
        } else {
          return 'No mapping available';
        }
      case 'extension':
        return 'Part of extension';
      case 'refset':
        return 'Member of Refset';
      default:
        return '';
    }
  }

  rippleColor(type: string): string {
    switch (type) {
      case 'content':   // #6B4FC1
        return 'rgba(107, 79, 193, 0.5)';
      case 'map':       // #D1A14A
        return 'rgba(209, 161,  74, 0.5)';
      case 'refset':    // #1F3346
        return 'rgba( 31,  51,  70, 0.5)';
      case 'extension': // #39A1BE
        return 'rgba( 57, 161, 190, 0.5)';
      default:
        return 'rgba(0, 0, 0, 0.35)';   // keep the grey a bit lighter
    }
  }

  boxClicked(box: SnomedBox) {
    this.setExamples(box);
    this.examplesSource = box;
  }

  setExamples(box: SnomedBox) {
    this.reset();
    if (box.refsetIds) {
      this.searching = true;
      var ecl = box.refsetIds.map(refsetId => {
        return '^ ' + refsetId;
      }).join(' OR ');
      this.performExamplesRequest(ecl, 3);
    } else if (box.annotationValue) {
      //  ^[referencedComponentId, value] 1292992004 
      //  ^ 1292992004 {{ M value = "American College of Surgeons, Chicago, Illinois: https://www.facs.org/quality-programs/cancer/ajcc/cancer-staging" }}
      this.searching = true;
      const ecl = '^ 1292992004 {{ M value = "' + box.annotationValue + '" }}';
      this.performExamplesRequest(ecl, 3);
    }
  }

  performExamplesRequest(ecl: string, count: number) {
    this.searching = true;
    const index = Math.floor(Math.random() * (20 * count)) * count;
    this.terminologyService.expandValueSet(ecl, '', index, count).subscribe((response: any) => {
      this.searching = false;
      if (response?.expansion?.contains?.length > 0) {
        this.examples = response?.expansion?.contains?.map((item: any) => {
          return {
            code: item.code,
            display: item.display
          };
        });
      }
    });
  }
}

export interface SnomedBox {
  label: string;
  type: 'content' | 'map' | 'extension' | 'refset';
  title: boolean;
  description?: string;
  refsetIds?: string[];
  term?: string;
  results?: any;
  annotationValue?: string;
  mapTargets?: string[];
  mapSources?: string[];
}
