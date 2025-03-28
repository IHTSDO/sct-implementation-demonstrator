import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { TerminologyService } from 'src/app/services/terminology.service';
import { Subject, takeUntil, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-refset-viewer',
  templateUrl: './refset-viewer.component.html',
  styleUrl: './refset-viewer.component.css',
  standalone: false
})
export class RefsetViewerComponent implements OnInit, OnChanges, OnDestroy {

  @Input() title: string = '';
  @Input() valuesetEcl: string = '';
  @Input() refsetEditionUri: string = '';

  private cancel$ = new Subject<void>();

  refsetMembers: any[] = [];
  searching = false;
  offset = 0;
  limit = 100;
  total = 0;

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    // if (this.valuesetEcl) {
    //   this.getRefsetMembers();
    // }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['valuesetEcl'] && !changes['valuesetEcl'].firstChange) {
      // Reset refsetMembers and offset when valuesetEcl changes
      this.cleanAndGetMembers();
    }
  }

  public cleanAndGetMembers() {
    this.refsetMembers = [];
    this.offset = 0;
    this.getRefsetMembers();
  }

  public getRefsetMembers() {
    // Cancel any in-flight request
    this.cancel$.next();
  
    this.searching = true;
  
    this.terminologyService.expandValueSetFromServer(
      this.terminologyService.getSnowstormFhirBase(), 
      this.refsetEditionUri, 
      this.valuesetEcl, 
      '', 
      this.offset, 
      this.limit
    ).pipe(
      takeUntil(this.cancel$),
      switchMap((data) => {
        if (data?.expansion?.contains) {
          this.total = data.expansion.total;
          if (this.total > this.offset + this.limit) {
            this.offset += this.limit;
          }
          let tempValueset = this.terminologyService.getValueSetFromExpansion(data.expansion);
          return this.terminologyService.expandInlineValueSet(tempValueset);
        }
        return of(null); // Return an observable even when data is invalid
      }),
      takeUntil(this.cancel$)
    ).subscribe((data) => {
      if (data?.expansion?.contains) {
        this.refsetMembers = [...this.refsetMembers, ...data.expansion.contains];
      }
      this.searching = false;
    });
  }
  
  ngOnDestroy(): void {
    this.cancel$.next();
    this.cancel$.complete();
  }

}
