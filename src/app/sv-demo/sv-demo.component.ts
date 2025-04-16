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
    { specFile: "Nutrition Assessment.json", spec: this.emptySpec },
    { specFile: "Nutrition Diagnosis.json", spec: this.emptySpec },
    { specFile: "NCPT_Intervention_form.json", spec: this.emptySpec },
  ];

  nursingSpecs = [
    { specFile: "Nursing Assessment sv.json", spec: this.emptySpec },
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

  constructor(private http: HttpClient, private terminologyService: TerminologyService) { }
  
  ngOnInit() {
    this.terminologyService.setSnowstormFhirBase('https://implementation-demo.snomedtools.org/fhir');
    setTimeout(() => {
      this.terminologyService.setContext(this.localLanguageMetadata.contexts[1]);
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
    this.http.get('https://raw.githubusercontent.com/IHTSDO/snomedct-language-metadata/refs/heads/main/national-language-metadata.json').subscribe((data: any) => {
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
      const data: any = await lastValueFrom(this.http.get('assets/specs/ncpt/' + spec.specFile));
      spec.spec = data;
    });

    this.nursingSpecs.forEach(async (spec) => {
      spec.spec = this.emptySpec;
      const data: any = await lastValueFrom(this.http.get('assets/specs/nursing/' + spec.specFile));
      spec.spec = data;
    });

    setTimeout(() => {
      this.updateRefset();
    }, 1000);
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
