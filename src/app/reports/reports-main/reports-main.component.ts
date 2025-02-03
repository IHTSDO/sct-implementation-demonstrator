import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-reports-main',
  templateUrl: './reports-main.component.html',
  styleUrl: './reports-main.component.css'
})
export class ReportsMainComponent {

  reports: any[] = [
    { type: 'external', name: 'RF2 History Mechanism', subtitle: "Specification Guide", 
      url: 'https://confluence.ihtsdotools.org/display/DOCRELFMT/3.1.5+History+Mechanism', 
      description: 'How SNOMED terminology changes are represented in the release files.' },
    { type: 'external', name: 'Historical Associations Refset', subtitle: "Specification Guide", 
      url: 'https://confluence.ihtsdotools.org/display/DOCRELFMT/5.2.5.1+Historical+Association+Reference+Sets', 
      description: 'How SNOMED represents historical associations linking active components with inactive ones.' },
    { type: 'external', name: 'Editorial Conventions for Changes in Components', subtitle: "Editorial Guide", 
      url: 'https://confluence.ihtsdotools.org/display/EDUEG/Changes+to+Components', 
      description: 'An educational resource outlining policies for managing terminology changes.' },
    { type: 'external', name: 'Translation Maintenance Advice', subtitle: "Translation Management Guide", 
      url: 'https://confluence.ihtsdotools.org/display/DOCMANAGETRANS/5.+Maintenance+of+a+Translation', 
      description: 'Recommendations for managing translations, adapting to changes in international concepts and descriptions.' },
    { type: 'external', name: 'Managing Inactivations in the Authoring Platform', subtitle: "User Guide", 
      url: 'https://confluence.ihtsdotools.org/display/SIAPUG/Inactivation+-+Descriptions%2C+Relationships%2C+and+Concepts', 
      description: 'Step by step guides on how to perform content inactivations in the Authoring Platform.' },
    { type: 'external', name: 'Managing Inactivations in the Refset & Translation Tool', subtitle: "User Guide", 
      url: 'https://confluence.ihtsdotools.org/display/REFSET/Migration', 
      description: 'Features in the Refset & Translation Tool that support content migration between releases and the replacement of inactive content in refsets.' },
    { type: 'external', name: 'Managing Inactivations in Snap2Snomed', subtitle: "User Guide", 
      url: 'https://confluence.ihtsdotools.org/display/S2SUG/Appendix+A+-+FAQs', 
      description: 'How inactive content is reported in Snap2Snomed and how the tool supports replacement selection.' },
    { type: 'external', name: 'History Supplements in ECL', subtitle: "User Guide", 
      url: 'https://confluence.ihtsdotools.org/display/DOCECL/6.11+History+Supplements', 
      description: 'How history supplements can be applied to an expression constraint to include relevant inactive concepts in the results.' },
    { type: 'external', name: 'Release Management Home', subtitle: "Release Notes", 
      url: 'https://confluence.ihtsdotools.org/display/RMT/SNOMED+International+Release+Management+Home', 
      description: 'Information on past and upcoming SNOMED Releases and access to Releases Notes describing content changes.' },
    { type: 'external', name: 'Last International Release Statistics', subtitle: "Changes Report", 
      url: 'https://browser.ihtsdotools.org/qa/#/SNOMEDCT', 
      description: 'Descriptive statistics from the latest release of the International Edition of SNOMED CT.' },
    { type: 'internal', name: 'FSN Changes', subtitle: "Changes Report", url: 'reports/fsn', 
      description: 'This report displays changes to the FSN of concepts over time.' },
    { type: 'internal', name: 'Inactivations', subtitle: "Changes Report", url: 'reports/inactivations', 
      description: 'This report displays concept inactivations over time.' },
    { type: 'internal', name: 'New Concepts', subtitle: "Changes Report", url: 'reports/new-concepts', 
      description: 'This report displays newly added concepts over time.' },
];


  constructor(public router: Router, public route: ActivatedRoute) { }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      let queryParams = demo.queryParams;
      let currentParams = this.route.snapshot.queryParams;
      if (queryParams) {
        queryParams = { ...currentParams, ...queryParams };
      } else {
        queryParams = currentParams;
      }
      this.router.navigate([demo.url], { queryParams: queryParams });
    } else {
      this.openInNewTab(demo.url);
    }
  }

  openInNewTab(url: string) {
    window.open(url, '_blank');
  }

}
