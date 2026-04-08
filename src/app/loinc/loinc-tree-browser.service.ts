import { Injectable } from '@angular/core';
import { map, Observable, of, shareReplay } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';
import { LoincGrouperCacheService } from './loinc-grouper-cache.service';
import type { LoincTreeNode } from './loinc-tree.types';

@Injectable({
  providedIn: 'root'
})
export class LoincTreeBrowserService {
  readonly loincTerminologyServer = 'https://browser.loincsnomed.org/fhir';
  readonly loincEditionUri = 'http://snomed.info/sct/11010000107';
  readonly loincOrderablesRefset = '^ 635111010000100';
  readonly fallbackEditionVersion = 'http://snomed.info/sct/11010000107/version/20250321';

  private latestEditionVersion$?: Observable<string>;

  constructor(
    private terminologyService: TerminologyService,
    private loincGrouperCacheService: LoincGrouperCacheService
  ) {}

  resolveLatestEditionVersion(): Observable<string> {
    if (!this.latestEditionVersion$) {
      this.latestEditionVersion$ = this.terminologyService.getLatestCodeSystemVersionFromServer(
        this.loincTerminologyServer,
        this.loincEditionUri,
        this.fallbackEditionVersion
      ).pipe(shareReplay(1));
    }

    return this.latestEditionVersion$;
  }

  warmGroupers(activeEditionVersion: string): Observable<Set<string>> {
    return this.loincGrouperCacheService.warmGroupers(this.loincTerminologyServer, activeEditionVersion);
  }

  markNodes(activeEditionVersion: string, nodes: LoincTreeNode[]): LoincTreeNode[] {
    return nodes.map((node) => ({
      ...node,
      isGrouper: this.loincGrouperCacheService.isGrouper(activeEditionVersion, node.code),
      children: node.children ? this.markNodes(activeEditionVersion, node.children) : node.children
    }));
  }

  loadDirectChildren(activeEditionVersion: string, node: LoincTreeNode): Observable<LoincTreeNode[]> {
    return this.terminologyService.expandValueSetFromServer(
      this.loincTerminologyServer,
      activeEditionVersion,
      `(<! ${node.code}) AND (${this.loincOrderablesRefset})`,
      '',
      0,
      100
    ).pipe(
      map((response) => this.markNodes(activeEditionVersion, response?.expansion?.contains || []))
    );
  }

  buildNode(code: string, display: string, activeEditionVersion: string): LoincTreeNode {
    return {
      code,
      display,
      isGrouper: this.loincGrouperCacheService.isGrouper(activeEditionVersion, code),
      isExpanded: false,
      isLoadingChildren: false,
      children: []
    };
  }
}
