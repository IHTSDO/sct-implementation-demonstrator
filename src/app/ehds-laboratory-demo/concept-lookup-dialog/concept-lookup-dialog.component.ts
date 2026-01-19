import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { TerminologyService } from '../../services/terminology.service';

@Component({
  selector: 'app-concept-lookup-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, CommonModule],
  templateUrl: './concept-lookup-dialog.component.html',
  styleUrls: ['./concept-lookup-dialog.component.css']
})
export class ConceptLookupDialogComponent implements OnInit {
  isLoading: boolean = true;
  hasError: boolean = false;
  errorMessage: string = '';
  conceptData: any = null;
  attributes: any[] = []; // Attributes from normal form
  
  private terminologyService: TerminologyService = inject(TerminologyService);

  constructor(
    public dialogRef: MatDialogRef<ConceptLookupDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { system: string; code: string; display?: string; loincCode?: string | null; fhirBase?: string }
  ) {}

  ngOnInit(): void {
    this.loadConceptData();
  }

  loadConceptData(): void {
    this.isLoading = true;
    this.hasError = false;
    
    // Use provided fhirBase or default to LOINC SNOMED server for LOINC codes
    let fhirBase = this.data.fhirBase;
    if (!fhirBase) {
      if (this.data.system === 'http://loinc.org') {
        fhirBase = 'https://browser.loincsnomed.org/fhir';
      } else {
        fhirBase = 'https://snowstorm.ihtsdotools.org/fhir';
      }
    }
    
    // Use the new lookupConceptFromServer method
    this.terminologyService.lookupConceptFromServer(fhirBase, this.data.system, this.data.code).subscribe({
      next: (response: any) => {
        this.conceptData = response;
        this.extractAttributes(response);
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading concept data:', error);
        this.hasError = true;
        this.errorMessage = error.message || 'Failed to load concept information';
        this.isLoading = false;
      }
    });
  }

  extractAttributes(response: any): void {
    this.attributes = [];
    
    // Extract normal form from response
    const normalFormString = this.terminologyService.getNormalForm(response);
    
    if (normalFormString) {
      // Parse the normal form to get relationships (attributes)
      const normalForm = this.terminologyService.parseNormmalForm(normalFormString);
      
      // Flatten all relationship groups into a single array of attributes
      normalForm.groups.forEach((group: any[]) => {
        group.forEach((relationship: any) => {
          this.attributes.push({
            type: relationship.type,
            target: relationship.target
          });
        });
      });
    }
  }

  getDisplayName(): string {
    if (this.data.display) {
      return this.data.display;
    }
    
    if (this.conceptData && this.conceptData.parameter) {
      const displayParam = this.conceptData.parameter.find((p: any) => p.name === 'display');
      if (displayParam) {
        return displayParam.valueString || '';
      }
    }
    
    return this.data.code;
  }

}
