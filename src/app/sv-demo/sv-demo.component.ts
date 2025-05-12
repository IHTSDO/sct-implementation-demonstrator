import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { TerminologyService } from '../services/terminology.service';
import { RefsetViewerComponent } from '../util/refset-viewer/refset-viewer.component';

@Component({
    selector: 'app-sv-demo',
    templateUrl: './sv-demo.component.html',
    styleUrl: './sv-demo.component.css',
    standalone: false
})
export class SvDemoComponent implements OnInit {

  @ViewChild('refsetViewer') refsetViewerComponent: RefsetViewerComponent | undefined;

  emptySpec: any = {};
  nutritionSpecs = [
    { specFile: "Nutritionsutredning.json", spec: this.emptySpec },
    { specFile: "Nutritionsdiagnos.json", spec: this.emptySpec },
    { specFile: "Malochnutrition.json", spec: this.emptySpec },
    { specFile: "Nutritionsuppföljning.json", spec: this.emptySpec },
  ];

  nursingSpecs = [
    { specFile: "sv-demo-nutrition.json", spec: this.emptySpec },
    // { specFile: "Nursing Assessment sv.json", spec: this.emptySpec },
  ];
  activeContext: string = '';

  contexts = [
    { name: 'English', value: 'en-X-900000000000509007' },
    { name: 'Swedish', value: 'sv-X-46011000052107,en-X-900000000000509007' },
    { name: 'Swedish Nursing', value: 'sv-X-83461000052100,sv-X-46011000052107,en-X-900000000000509007' },
    { name: 'Swedish Patient', value: 'sv-X-63451000052100,sv-X-46011000052107,en-X-900000000000509007' }
  ];

  languageMetadata: any = {};
  localLanguageMetadata: any = {};
  initReady: boolean = false;
  antropometriskQuestionnaire: any;

  constructor(private http: HttpClient, private terminologyService: TerminologyService) { }
  
  ngOnInit() {
    this.terminologyService.setSnowstormFhirBase('https://implementation-demo.snomedtools.org/fhir');
    setTimeout(() => {
      if (this.localLanguageMetadata?.contexts[1]) {
        this.terminologyService.setContext(this.localLanguageMetadata.contexts[1]);
      } else {
        this.terminologyService.setLang('sv,en');
      }
      setTimeout(() => {
        this.terminologyService.setFhirUrlParam('http://snomed.info/sct/45991000052106/version/20241130');
        setTimeout(() => {
          this.terminologyService.fhirUrlParam$.subscribe(urlParam => {
            this.loadSpecs();
          });
      
          this.terminologyService.snowstormFhirBase$.subscribe(url => {
            this.loadSpecs();
          });
      
          this.terminologyService.lang$.subscribe(lang => {
            this.loadSpecs();
          });
      
          this.terminologyService.context$.subscribe(context => {
            this.activeContext = context;
            this.loadSpecs();
          });
          this.initReady = true;
        }, 1000);
      }, 1000);
    }, 1000);

    // Load language metadata from https://raw.githubusercontent.com/IHTSDO/snomedct-language-metadata/refs/heads/main/national-language-metadata.json
    this.http.get('assets/language/national-language-metadata.json').subscribe((data: any) => {
      this.languageMetadata = data;
      this.setupLanguageMetadata();
    });
  }


  setupLanguageMetadata() {
    // set localLanguageMetadata to the match of moduleUri with ''http://snomed.info/sct/45991000052106'
    this.localLanguageMetadata = this.languageMetadata.editions.find((lang: any) => lang.moduleUri === 'http://snomed.info/sct/45991000052106');
    this.localLanguageMetadata.contexts.unshift({ name: 'English', languageDialects: 'en-X-900000000000509007' });
  }

  loadSpecs() {
    this.nutritionSpecs.forEach(async (spec) => {
      spec.spec = this.emptySpec;
      const data: any = await lastValueFrom(this.http.get('assets/specs/sv-demo/' + spec.specFile));
      spec.spec = data;
    });

    this.nursingSpecs.forEach(async (spec) => {
      spec.spec = this.emptySpec;
      const data: any = await lastValueFrom(this.http.get('assets/specs/nursing/' + spec.specFile));
      spec.spec = data;
    });
    this.loadLForms();
    setTimeout(() => {
      this.updateRefset();
    }, 1000);
  }

  async loadLForms() {
    const script = document.createElement('script');
    script.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/36.3.2/webcomponent/lhc-forms.js'; // Replace with the actual URL of your JS library
    script.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/36.3.2/fhir/R4/lformsFHIR.min.js'; // Replace with the actual URL of your JS library
      script2.onload = () => {
        // this.loadQuestionnaires();
      };
      document.head.appendChild(script2);
    };
    document.head.appendChild(script);
  }

  async loadQuestionnaires() {
    const qdata: any = await lastValueFrom(this.http.get('assets/specs/sv-demo/Antropometrisk.R5.json'));
    this.antropometriskQuestionnaire = qdata;
    LForms.Util.addFormToPage(this.antropometriskQuestionnaire, 'myFormContainer');
  }

  onNutritionTabChange(event: any) {
    const tabIndex = event.index;
    const isLastTab = tabIndex === this.nutritionSpecs.length;  // because all nutritionSpecs tabs come first
  
    if (isLastTab && !this.antropometriskQuestionnaire) {
      this.loadQuestionnaires();
    }
  }

  updateRefset() {
    if (this.refsetViewerComponent) {
      this.refsetViewerComponent.cleanAndGetMembers();
    }
  }

  setContext(context: string) {
    this.terminologyService.setContext(context);
  }

  setEnglishContext() {
    this.terminologyService.setLang('en');
  }

  setSwedishContext() {
    this.terminologyService.setContext('sv-X-46011000052107,en-X-900000000000509007');
  }

  setSwedishNursingContext() {
    this.terminologyService.setContext('sv-X-83461000052100,sv-X-46011000052107,en-X-900000000000509007');
  }

  setSwedishPatientContext() {
    this.terminologyService.setContext('sv-X-63451000052100,sv-X-46011000052107,en-X-900000000000509007');
  }

}
