import { Component } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-snomed-hub',
  templateUrl: './snomed-hub.component.html',
  styleUrls: ['./snomed-hub.component.scss'],
  standalone: false
})
export class SnomedHubComponent {

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
    { label: 'INSERM Orphanet rare disease', refsetIds: ['784008009'], type: 'content', title: false },
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
    console.log('Code selected:', code);
    this.searching = true;
    this.searchCompleted = false;
    // Combine all card arrays
    const allBoxes = [...this.topRow, ...this.leftCol, ...this.rightCol, ...this.bottomRow];
    // Clear previous results
    allBoxes.forEach(box => box.results = []);
    this.selectedCodeTerm = code.display + ' - SCTID: ' + code.code;
    this.selectedCode = code;
    this.terminologyService.getMemberships(code.code).subscribe((memberships: any) => {
        console.log('Memberships:', memberships);
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
