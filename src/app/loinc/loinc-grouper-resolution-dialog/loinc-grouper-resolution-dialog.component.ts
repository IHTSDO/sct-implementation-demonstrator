import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TerminologyService } from 'src/app/services/terminology.service';
import { LoincTreeBrowserService } from '../loinc-tree-browser.service';
import type { LoincTreeNode } from '../loinc-tree.types';

type ResultTemplate = {
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
};

type EditableResolvedResult = {
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
  isGrouper: boolean;
};

export type GrouperResolutionDialogResult = {
  coding: Array<{ system?: string; version?: string; code?: string; display?: string }>;
  text: string;
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
};

@Component({
  selector: 'app-loinc-grouper-resolution-dialog',
  templateUrl: './loinc-grouper-resolution-dialog.component.html',
  styleUrl: './loinc-grouper-resolution-dialog.component.css',
  standalone: false
})
export class LoincGrouperResolutionDialogComponent implements OnInit {
  readonly loincAlternateIdentifierScheme = '30051010000102';

  rootNodes: LoincTreeNode[] = [];
  selectedNode: LoincTreeNode | null = null;
  selectedResult: EditableResolvedResult = {
    value: '',
    unitDisplay: '',
    unitCode: '',
    unitSystem: 'http://unitsofmeasure.org',
    referenceLow: '',
    referenceHigh: '',
    isGrouper: false
  };
  selectedCoding: Array<{ system?: string; version?: string; code?: string; display?: string }> = [];
  resolvingSelection = false;
  step: 'tree' | 'editor' = 'tree';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      grouperCode: string;
      grouperDisplay: string;
      activeEditionVersion: string;
      resultTemplatesByLoincCode: Record<string, ResultTemplate>;
    },
    private dialogRef: MatDialogRef<LoincGrouperResolutionDialogComponent>,
    private loincTreeBrowserService: LoincTreeBrowserService,
    private terminologyService: TerminologyService
  ) {}

  ngOnInit() {
    this.rootNodes = [
      this.loincTreeBrowserService.buildNode(this.data.grouperCode, this.data.grouperDisplay, this.data.activeEditionVersion)
    ];
  }

  handleNodeSelected(node: LoincTreeNode) {
    if (node.isGrouper) {
      return;
    }

    this.resolvingSelection = true;
    this.selectedNode = node;

    this.terminologyService.getAlternateIdentifiers(node.code, this.loincTreeBrowserService.loincTerminologyServer)
      .subscribe({
        next: (alternateIdentifiers) => {
          const loincCode = this.getAlternateIdentifierByScheme(alternateIdentifiers, this.loincAlternateIdentifierScheme);
          this.selectedCoding = [
            {
              system: 'http://snomed.info/sct',
              version: this.data.activeEditionVersion,
              code: node.code,
              display: node.display
            }
          ];

          if (loincCode) {
            this.selectedCoding.push({
              system: 'http://loinc.org',
              code: loincCode,
              display: node.display
            });
          }

          const template = loincCode ? this.data.resultTemplatesByLoincCode[loincCode] : null;
          this.selectedResult = {
            value: template?.value || '',
            unitDisplay: template?.unitDisplay || '',
            unitCode: template?.unitCode || '',
            unitSystem: template?.unitSystem || 'http://unitsofmeasure.org',
            referenceLow: template?.referenceLow || '',
            referenceHigh: template?.referenceHigh || '',
            isGrouper: false
          };
          this.step = 'editor';
          this.resolvingSelection = false;
        },
        error: () => {
          this.selectedCoding = [
            {
              system: 'http://snomed.info/sct',
              version: this.data.activeEditionVersion,
              code: node.code,
              display: node.display
            }
          ];
          this.selectedResult = {
            value: '',
            unitDisplay: '',
            unitCode: '',
            unitSystem: 'http://unitsofmeasure.org',
            referenceLow: '',
            referenceHigh: '',
            isGrouper: false
          };
          this.step = 'editor';
          this.resolvingSelection = false;
        }
      });
  }

  backToTree() {
    this.step = 'tree';
  }

  save() {
    if (!this.selectedNode) {
      return;
    }

    this.dialogRef.close({
      coding: this.selectedCoding,
      text: this.selectedNode.display,
      value: this.selectedResult.value,
      unitDisplay: this.selectedResult.unitDisplay,
      unitCode: this.selectedResult.unitCode,
      unitSystem: this.selectedResult.unitSystem,
      referenceLow: this.selectedResult.referenceLow,
      referenceHigh: this.selectedResult.referenceHigh
    } satisfies GrouperResolutionDialogResult);
  }

  close() {
    this.dialogRef.close(null);
  }

  private getAlternateIdentifierByScheme(alternateIdentifiers: any[], identifierSchemeConceptId: string): string | null {
    const matchingIdentifier = alternateIdentifiers.find(
      (identifier: any) => identifier.identifierScheme?.conceptId === identifierSchemeConceptId
    );

    return matchingIdentifier ? matchingIdentifier.alternateIdentifier : null;
  }
}
