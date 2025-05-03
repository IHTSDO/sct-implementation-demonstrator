import { Component } from '@angular/core';

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

  topRow: SnomedBox[] = [
    { label: 'AAP/EPF Periodontal', type: 'content', title: false },
    { label: 'GMDN devices', type: 'content', title: true },
    { label: 'ADA SNODENT', type: 'content', title: false },
    { label: 'EDQM dose forms', type: 'content', title: false },
    { label: 'ICD‑10', type: 'map', title: false },
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
    { label: 'MedDRA', type: 'map', title: false },
    { label: 'Orphanet', type: 'map', title: false },
    { label: 'DICOM', type: 'map', title: false },
    { label: 'IHE Profiles', type: 'map', title: false },
    { label: 'Dentistry Odontogram', type: 'map', title: false }
  ];

  bottomRow: SnomedBox[] = [
    { label: 'LOINC Extension', type: 'extension', title: false },
    { label: 'GMDN equivalency file', type: 'extension', title: true },
    { label: 'NCPT', type: 'refset', title: false },
    { label: 'ERA', type: 'refset', title: false },
    { label: 'GP/FP', type: 'refset', title: true },
    { label: 'ICNP', type: 'refset', title: false },
    { label: 'HL7 IPS', type: 'refset', title: false },
    { label: 'Dentistry Diagnosis', type: 'refset', title: false }
  ];

  getMiddleBoxIndex(content: any[]): number {
    // Adjust based on your slice: slice(1, topRow.length - 1) ⇒ real index range = 1 to length - 2
    const length = content.length - 2;
    return Math.floor((length - 1) / 2);
  }

  codeSelected(code: any) {
    this.selectedCodeTerm = code.display;
    this.selectedCode = code;
    console.log('Selected code:', code);
  }
}

export interface SnomedBox {
  label: string;
  type: 'content' | 'map' | 'extension' | 'refset';
  title: boolean
}
