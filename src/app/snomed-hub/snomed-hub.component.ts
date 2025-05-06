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
    { label: 'AAP/EPF Periodontal', type: 'content', title: false },
    { label: 'GMDN devices', type: 'content', title: true },
    { label: 'ADA SNODENT', type: 'content', title: false },
    { label: 'EDQM dose forms', type: 'content', title: false },
    { label: 'ICD‑10', refsetIds: ['447562003'], type: 'map', title: false },
    { label: 'ICD‑11 MMS', type: 'map', title: false },
    { label: 'ICD‑O', type: 'map', title: true },
    { label: 'HPO', type: 'map', title: false }
  ];

  leftCol: SnomedBox[] = [
    { label: 'AJCC Cancer Staging', type: 'content', title: false },
    { label: 'Convergent Medical Terminology', type: 'content', title: false },
    { label: 'ICNP nursing', type: 'content', title: false },
    { label: 'INSERM Orphanet rare disease', type: 'content', title: false },
    { label: 'ILAE Epilepsy', type: 'content', title: false },
    { label: 'IDDSI Diet', type: 'content', title: false }
  ];

  rightCol: SnomedBox[] = [
    { label: 'MedDRA', refsetIds: ['816210007', '1193497006'], type: 'map', title: false },
    { label: 'Orphanet', type: 'map', title: false },
    { label: 'DICOM', refsetIds: ['1119410008'], type: 'map', title: false },
    { label: 'IHE Profiles', type: 'map', title: false },
    { label: 'Dentistry Odontogram', type: 'map', title: false }
  ];

  bottomRow: SnomedBox[] = [
    { label: 'LOINC Extension', type: 'extension', title: false },
    { label: 'GMDN equivalency file', type: 'extension', title: true },
    { label: 'NCPT', type: 'refset', title: false },
    { label: 'ERA', type: 'refset', title: false },
    { label: 'GP/FP', refsetIds: ['450970008'], type: 'refset', title: true },
    { label: 'ICNP', type: 'refset', title: false },
    { label: 'HL7 IPS', refsetIds: ['816080008'], type: 'refset', title: false },
    { label: 'Dentistry Diagnosis', type: 'refset', title: false }
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
    this.selectedCodeTerm = code.display;
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

  getCalloutMessage(type: string): string {
    switch (type) {
      case 'content':
        return 'Part of project';
      case 'map':
        return 'Member of map';
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
}
