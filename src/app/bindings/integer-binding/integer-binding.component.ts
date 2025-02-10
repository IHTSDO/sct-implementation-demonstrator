import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
    selector: 'app-integer-binding',
    templateUrl: './integer-binding.component.html',
    styleUrls: ['./integer-binding.component.css'],
    standalone: false
})
export class IntegerBindingComponent {
  @Input() binding: any;
  @Output() textChange = new EventEmitter<any>();

  options: any[] | undefined;
  selectedOptions: any[] | undefined;

  value: number = 0;

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    // this.terminologyService.expandValueSet(this.binding.ecl, '').subscribe(response => this.options = response.expansion.contains)
  }

  onValueChange(newValue: number) {
    this.value = newValue;
    this.textChange.emit(newValue);
  }

}
