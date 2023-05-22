import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-radios-binding',
  templateUrl: './radios-binding.component.html',
  styleUrls: ['./radios-binding.component.css']
})
export class RadiosBindingComponent implements OnInit {
  @Input() binding: any;
  @Output() selectionChange = new EventEmitter<any>();

  options: any[] | undefined;

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    this.terminologyService.expandValueSet(this.binding.ecl, '').subscribe(response => this.options = response.expansion.contains)
  }

  optionSelected(value: any) {
    this.selectionChange.emit(value);
  }

}
