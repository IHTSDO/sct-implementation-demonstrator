import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reports-main',
  templateUrl: './reports-main.component.html',
  styleUrl: './reports-main.component.css'
})
export class ReportsMainComponent {

  reports: any[] = [
    { name: 'FSN Changes', subtitle: "Changes to concepts FSN", route: 'reports/fsn', description: 'This report shows changes to the FSN of concepts over time.' },
    { name: 'Inactivations', subtitle: "Inactivations of concepts", route: 'reports/inactivations', description: 'This report shows inactivations of concepts over time.' },
    { name: 'New Concepts', subtitle: "New concepts", route: 'reports/new-concepts', description: 'This report shows new concepts over time.' },
  ];

  constructor(public router: Router) { }

  navigate(report: any) {
    this.router.navigate([report.route])
  } 

}
