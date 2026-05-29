import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
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

  mapResults: any[] = [];
  notFound = false;
  loading = false;

  constructor(private terminologyService: TerminologyService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['concept'] && changes['concept'].currentValue) {
      this.notFound = false;
      this.loading = true;
      this.terminologyService
        .getSimpleMapTargets(this.concept?.code, this.mapDefinition.codeSystem)
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
