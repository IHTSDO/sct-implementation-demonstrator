import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { take } from 'rxjs';
import { LoincTreeBrowserService } from '../loinc-tree-browser.service';
import type { LoincTreeNode } from '../loinc-tree.types';

@Component({
  selector: 'app-loinc-tree-browser',
  templateUrl: './loinc-tree-browser.component.html',
  styleUrl: './loinc-tree-browser.component.css',
  standalone: false
})
export class LoincTreeBrowserComponent implements OnChanges {
  @Input() nodes: LoincTreeNode[] = [];
  @Input() activeEditionVersion = '';
  @Input() selectionMode: 'all' | 'orderable-only' = 'all';
  @Input() emptyText = 'No results...';
  @Input() orderedSnomedCodes: Set<string> = new Set();
  @Output() nodeSelected = new EventEmitter<LoincTreeNode>();

  treeNodes: LoincTreeNode[] = [];
  visibleNodes: LoincTreeNode[] = [];

  constructor(private loincTreeBrowserService: LoincTreeBrowserService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodes'] || changes['activeEditionVersion']) {
      this.treeNodes = this.loincTreeBrowserService.markNodes(this.activeEditionVersion, this.nodes);
      this.rebuildVisibleNodes();
    }
  }

  isGrouper(node: LoincTreeNode): boolean {
    return !!node.isGrouper;
  }

  isInOrder(node: LoincTreeNode): boolean {
    return this.orderedSnomedCodes.has(node.code);
  }

  canExpandGrouper(node: LoincTreeNode): boolean {
    return this.isGrouper(node);
  }

  canSelect(node: LoincTreeNode): boolean {
    return this.selectionMode === 'all' || !this.isGrouper(node);
  }

  onNodeClick(node: LoincTreeNode) {
    if (!this.canSelect(node)) {
      return;
    }

    this.nodeSelected.emit(node);
  }

  toggleNode(node: LoincTreeNode, event: Event) {
    event.stopPropagation();

    if (!this.canExpandGrouper(node)) {
      return;
    }

    if (node.children?.length) {
      node.isExpanded = !node.isExpanded;
      this.rebuildVisibleNodes();
      return;
    }

    node.isExpanded = true;
    node.isLoadingChildren = true;
    this.rebuildVisibleNodes();

    this.loincTreeBrowserService.loadDirectChildren(this.activeEditionVersion, node)
      .pipe(take(1))
      .subscribe({
        next: (children) => {
          node.children = children;
          node.isLoadingChildren = false;
          this.rebuildVisibleNodes();
        },
        error: () => {
          node.children = [];
          node.isExpanded = false;
          node.isLoadingChildren = false;
          this.rebuildVisibleNodes();
        }
      });
  }

  private rebuildVisibleNodes() {
    this.visibleNodes = this.flattenNodes(this.treeNodes);
  }

  private flattenNodes(nodes: LoincTreeNode[], level = 0): LoincTreeNode[] {
    return nodes.flatMap((node) => {
      node.level = level;
      const base = [node];
      if (!node.isExpanded || !node.children?.length) {
        return base;
      }

      return [...base, ...this.flattenNodes(node.children, level + 1)];
    });
  }
}
