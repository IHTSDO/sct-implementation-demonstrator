import { AfterViewInit, Component, ElementRef, HostListener, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-snomed-hub',
  templateUrl: './snomed-hub.component.html',
  styleUrls: ['./snomed-hub.component.scss'],
  standalone: false
})
export class SnomedHubComponent implements AfterViewInit {

  @ViewChild('lines',   { static: true })  svg!: ElementRef<SVGSVGElement>;
  @ViewChild('diagram', { static: true })  host!: ElementRef<HTMLElement>;

  @ViewChild('centerColumn', { static: true })
  centerCol!: ElementRef<HTMLElement>;

  @ViewChildren('cardLabel', { read: ElementRef })
  cardLabels!: QueryList<ElementRef<HTMLElement>>;

  searchBinding = { ecl: '*', title: 'Search a SNOMED CT concept...' };
  selectedCode: any = null;
  selectedCodeTerm = "";
  searching = false;
  searchCompleted = false;

  topRow: SnomedBox[] = [
    { label: 'AAP/EPF Periodontal', refsetIds: ['787444003'], type: 'content', title: false },
    { label: 'GMDN devices', refsetIds: ['467614008'], type: 'content', title: true },
    { label: 'ADA SNODENT', refsetIds: ['721144007', '721145008'], type: 'content', title: false },
    { label: 'EDQM dose forms', refsetIds: ['1237627005'], type: 'map', title: false },
    { label: 'ICD‑10', refsetIds: ['447562003'], type: 'map', title: false },
    { label: 'ICD‑11 MMS', type: 'map', title: false },
    { label: 'ICD‑O', refsetIds: ['446608001'], type: 'map', title: true },
    { label: 'HPO', type: 'map', title: false }
  ];

  leftCol: SnomedBox[] = [
    { label: 'AJCC Cancer Staging', annotationValue:'American College of Surgeons, Chicago, Illinois: https://www.facs.org/quality-programs/cancer/ajcc/cancer-staging', type: 'content', title: false },
    { label: 'Union for International Cancer Control', annotationValue: 'Union for International Cancer Control: https://www.uicc.org/who-we-are/about-uicc/uicc-and-tnm',type: 'content', title: false },
    { label: 'Convergent Medical Terminology', type: 'content', title: false },
    { label: 'ICNP nursing', refsetIds: ['711112009', '712505008'], type: 'content', title: false },
    { label: 'INSERM Orphanet rare disease', annotationValue: 'Inserm Orphanet', type: 'content', title: false },
    { label: 'ILAE Epilepsy', type: 'content', title: false },
    { label: 'IDDSI Diet', type: 'content', title: false }
  ];

  rightCol: SnomedBox[] = [
    { label: 'MedDRA', refsetIds: ['816210007', '1193497006'], type: 'map', title: false },
    { label: 'Orphanet', refsetIds: ['784008009'], type: 'map', title: false },
    { label: 'DICOM', refsetIds: ['1119410008'], type: 'refset', title: false },
    { label: 'IHE Profiles', type: 'refset', title: false },
    { label: 'Dentistry Odontogram', refsetIds: ['721145008'], type: 'refset', title: false }
  ];

  bottomRow: SnomedBox[] = [
    { label: 'LOINC Extension', type: 'extension', title: false },
    { label: 'GMDN equivalency file', type: 'extension', title: true },
    { label: 'NCPT', refsetIds: ['1303957004'], type: 'refset', title: false },
    { label: 'ERA', type: 'refset', title: false },
    { label: 'GP/FP', refsetIds: ['450970008'], type: 'refset', title: false },
    { label: 'ICNP', type: 'refset', title: false },
    { label: 'HL7 IPS', refsetIds: ['816080008'], type: 'refset', title: true },
    { label: 'Dentistry Diagnosis', refsetIds: ['721144007'], type: 'refset', title: false }
  ];

  // GPS 787778008

  constructor(private terminologyService: TerminologyService) {
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
    this.searching = true;
    this.searchCompleted = false;
    // Combine all card arrays
    const allBoxes = [...this.topRow, ...this.leftCol, ...this.rightCol, ...this.bottomRow];
    // Clear previous results
    allBoxes.forEach(box => box.results = []);
    this.selectedCodeTerm = code.display + ' - SCTID: ' + code.code;
    this.selectedCode = code;
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
                        box.results.push(membership.referencedComponentId);
                    }
                }
            });
        });
        this.searching = false;
        this.searchCompleted = true;
    });
  }

  reset() {
    this.searching = false;
    this.searchCompleted = false;
    this.selectedCode = null;
    this.selectedCodeTerm = "";
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

  boxClicked(box: SnomedBox) {
    console.log('Box clicked:', box);
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
}

export interface SnomedBox {
  label: string;
  type: 'content' | 'map' | 'extension' | 'refset';
  title: boolean;
  refsetIds?: string[];
  term?: string;
  results?: any;
  annotationValue?: string;
  mapTargets?: string[];
  mapSources?: string[];
}
