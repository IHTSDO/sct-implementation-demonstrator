import { Component, Input } from '@angular/core';
import { Patient } from '../../services/patient.service';

type NursingView = 'vitals' | 'nutrition';

@Component({
  selector: 'app-nursing-record',
  templateUrl: './nursing-record.component.html',
  styleUrls: ['./nursing-record.component.css'],
  standalone: false
})
export class NursingRecordComponent {
  @Input() patient: Patient | null = null;
  @Input() selectedView: NursingView = 'vitals';
}
