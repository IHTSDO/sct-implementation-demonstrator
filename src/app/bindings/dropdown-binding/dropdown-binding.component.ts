import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TerminologyService } from '../../services/terminology.service';

@Component({
    selector: 'app-dropdown-binding',
    templateUrl: './dropdown-binding.component.html',
    styleUrls: ['./dropdown-binding.component.css'],
    standalone: false
})
export class DropdownBindingComponent implements OnInit {
  @Input() binding: any;
  @Output() selectionChange = new EventEmitter<any>();

  options: any[] | undefined;
  selectedOptions: any[] | undefined;

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    this.terminologyService.expandValueSet(this.binding.ecl, '').subscribe(response => this.options = response.expansion.contains)
  }

  optionClicked() {
    this.selectionChange.emit(this.selectedOptions);
  }

}
