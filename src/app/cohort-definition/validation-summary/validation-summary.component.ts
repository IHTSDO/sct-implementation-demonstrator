import { Component, Input } from '@angular/core';
import { CohortDefinitionValidationIssue } from '../cohort-definition-validator';

@Component({
  selector: 'app-validation-summary',
  templateUrl: './validation-summary.component.html',
  styleUrls: ['./validation-summary.component.css'],
  standalone: false
})
export class ValidationSummaryComponent {
  @Input() title = 'Validation';
  @Input() issues: CohortDefinitionValidationIssue[] = [];
}
