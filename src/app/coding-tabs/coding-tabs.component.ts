import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CodingTabSpec } from './coding-tabs.models';
import { CodingTabsService } from './coding-tabs.service';

@Component({
  selector: 'app-coding-tabs',
  templateUrl: './coding-tabs.component.html',
  styleUrl: './coding-tabs.component.css',
  standalone: false
})
export class CodingTabsComponent implements OnChanges {
  @Input() title = '';
  @Input() intro = '';
  @Input() specPaths: string[] = [];
  @Input() specs: CodingTabSpec[] = [];

  tabs: CodingTabSpec[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private codingTabsService: CodingTabsService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['specPaths'] || changes['specs']) {
      this.loadTabs();
    }
  }

  private loadTabs(): void {
    this.errorMessage = '';

    if (this.specs?.length) {
      this.tabs = this.codingTabsService.normalizeSpecs(this.specs);
      return;
    }

    if (!this.specPaths?.length) {
      this.tabs = [];
      return;
    }

    this.isLoading = true;
    this.codingTabsService.loadSpecs(this.specPaths).subscribe({
      next: specs => {
        this.tabs = specs;
        this.isLoading = false;
      },
      error: () => {
        this.tabs = [];
        this.errorMessage = 'Unable to load coding specifications.';
        this.isLoading = false;
      }
    });
  }
}
