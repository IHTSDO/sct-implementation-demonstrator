import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TerminologyService } from '../../services/terminology.service';

@Component({
  selector: 'app-textbox-binding',
  templateUrl: './textbox-binding.component.html',
  styleUrls: ['./textbox-binding.component.css']
})
export class TextBoxBindingComponent implements OnInit {
  @Input() binding: any;
  @Output() textChange = new EventEmitter<any>();

  options: any[] | undefined;
  selectedOptions: any[] | undefined;

  text: string = '';

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    // this.terminologyService.expandValueSet(this.binding.ecl, '').subscribe(response => this.options = response.expansion.contains)
  }

  onTextChange(newValue: string) {
    this.text = newValue;
    this.textChange.emit(newValue);
  }

}
