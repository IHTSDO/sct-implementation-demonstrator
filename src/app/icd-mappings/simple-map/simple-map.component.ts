import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TerminologyService } from '../../services/terminology.service';

@Component({
  selector: 'app-icd-simple-map',
  templateUrl: './simple-map.component.html',
  styleUrls: ['./simple-map.component.css'],
  standalone: false,
})
export class IcdSimpleMapComponent implements OnChanges {
  @Input() mapDefinition: any;
  @Input() concept: any;
  /** Server selected by the parent for map lookups; falls back to the global server when absent. */
  @Input() mapServer$?: Observable<string>;

  mapResults: any[] = [];
  notFound = false;
  loading = false;

  constructor(private terminologyService: TerminologyService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['concept'] && changes['concept'].currentValue) {
      this.notFound = false;
      this.loading = true;
      (this.mapServer$ ?? of<string | undefined>(undefined))
        .pipe(
          switchMap((base) =>
            this.terminologyService.getSimpleMapTargets(this.concept?.code, this.mapDefinition.codeSystem, base),
          ),
        )
        .subscribe({
          next: (data) => {
            this.mapResults = [];
            if (data.parameter) {
              data.parameter.forEach((element: any) => {
                if (element.name === 'match') {
                  element.part.forEach((part: any) => {
                    if (part.name === 'concept') this.mapResults.push(part.valueCoding);
                  });
                }
              });
            }
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.notFound = true;
          },
        });
    }
  }
}
