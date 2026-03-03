import { Component, Input } from '@angular/core';
import { Patient } from '../../services/patient.service';

@Component({
  selector: 'app-nursing-record',
  templateUrl: './nursing-record.component.html',
  styleUrls: ['./nursing-record.component.css'],
  standalone: false
})
export class NursingRecordComponent {
  @Input() patient: Patient | null = null;
}
