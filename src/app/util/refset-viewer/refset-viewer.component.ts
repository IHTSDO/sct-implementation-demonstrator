import { Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
  selector: 'app-refset-viewer',
  templateUrl: './refset-viewer.component.html',
  styleUrl: './refset-viewer.component.css',
  standalone: false
})
export class RefsetViewerComponent implements OnInit, OnChanges {

  @Input() title: string = '';
  @Input() valuesetEcl: string = '';
  @Input() refsetEditionUri: string = '';


  refsetMembers: any[] = [];
  searching = false;
  offset = 0;
  limit = 10;
  total = 0;

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    if (this.valuesetEcl) {
      this.getRefsetMembers();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['valuesetEcl'] && !changes['valuesetEcl'].firstChange) {
      // Reset refsetMembers and offset when valuesetEcl changes
      this.refsetMembers = [];
      this.offset = 0;
      this.getRefsetMembers();
    }
  }

  getRefsetMembers() {
    this.searching = true;
    this.terminologyService.expandValueSetFromServer(this.terminologyService.getSnowstormFhirBase(), 
                              this.refsetEditionUri, this.valuesetEcl, '', this.offset, this.limit).subscribe(
      (data) => {
        if (data?.expansion?.contains) {
          this.total = data.expansion.total;
          if(this.total > this.offset + this.limit) {
            this.offset += this.limit;
          }
          let tempValueset = this.terminologyService.getValueSetFromExpansion(data.expansion);
          this.terminologyService.expandInlineValueSet(tempValueset).subscribe(
            (data) => {
              if (data?.expansion?.contains) {
                this.refsetMembers = [...this.refsetMembers, ...data.expansion.contains];
                this.searching = false;
              }
            }
          );
        }
      }
    );
  }

}
