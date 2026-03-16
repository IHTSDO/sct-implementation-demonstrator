import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TimeWindow } from '../cohort-definition.model';

@Component({
  selector: 'app-time-window-editor',
  templateUrl: './time-window-editor.component.html',
  styleUrls: ['./time-window-editor.component.css'],
  standalone: false
})
export class TimeWindowEditorComponent {
  @Input() label = 'Time Window';
  @Input() model!: TimeWindow;
  @Output() modelChange = new EventEmitter<TimeWindow>();

  update<K extends keyof TimeWindow>(key: K, value: TimeWindow[K]): void {
    this.modelChange.emit({
      ...this.model,
      [key]: value
    });
  }
}
