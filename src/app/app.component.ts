import { Component } from '@angular/core';
import { CodingSpecService } from './services/coding-spec.service';
import { ExcelService } from './services/excel.service';
import { TerminologyService } from './services/terminology.service';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { MenuService } from './services/menu.service';
import { MatDialog } from '@angular/material/dialog';
import { LanguageConfigComponent } from './util/language-config/language-config.component';
import { skip } from 'rxjs';

declare let gtag: Function;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent {
  title = 'sct-implementation-demonstrator';
  bindingsForExport: any[] = [];
  editions: any[] = [];
  editionsDetails: any[] = [];
  languages = ['da', 'de', 'en', 'es', 'et', 'fi', 'fr', 'nl', 'no', 'sv'];
  languageRefsets: any[] = [];
  selectedEdition = 'Edition';
  selectedLanguage = 'en';
  selectedLanRefsetConcept: any = null;
  selectedLanguageContext: string = '';
  fhirServers = [
    { name: "SNOMED Dev IS", url: "https://dev-is-browser.ihtsdotools.org/fhir"},
    { name: "SNOMED Public", url: "https://snowstorm.ihtsdotools.org/fhir"},
    { name: "SNOMED Dev 2", url: "https://snowstorm-temp.kaicode.io/fhir"},
    { name: "SNOMED Lite Demo", url: "https://snowstorm-lite.nw.r.appspot.com/fhir"},
    { name: "LOINC Ontology Server", url: "https://browser.loincsnomed.org/fhir"},
    { name: "Ontoserver", url: "https://r4.ontoserver.csiro.au/fhir"},
    { name: "SNOMED Dev 1", url: "https://dev-browser.ihtsdotools.org/fhir"},
  ];
  selectedServer = this.fhirServers[1];
  embeddedMode: boolean = false;

  demos: any[] = [];

  constructor( private codingSpecService: CodingSpecService, 
    public excelService: ExcelService, 
    private terminologyService: TerminologyService, 
    public router: Router,
    private menuService: MenuService,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute) { 
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Send pageview event to Google Analytics on each route change.
        gtag('config', 'G-7SK998GPMX', {
          'page_path': event.urlAfterRedirects
        });
      }
    });
  }

  ngOnInit(): void {
    this.demos = this.menuService.getDemos();
    this.setFhirServer(this.selectedServer);
    this.bindingsForExport = [];
    let spec: any[] = this.codingSpecService.getCodingSpec();
    for (const section of spec) {
      for (const binding of section.bindings) {
        this.bindingsForExport.push({ section: section.title, title: binding.title, ecl: binding.ecl.replace(/\s\s+/g, ' ') })
      }
    }
    this.activatedRoute.queryParams.pipe().subscribe(params => {
      if (params['embedded'] === 'true') {
        this.embeddedMode = true;
      } else {
        this.embeddedMode = false;
      }
      if (params['edition']) {
        this.updateCodeSystemOptions(params['edition']);
      } 
    });

    this.terminologyService.lang$.subscribe(lang => {
      this.selectedLanguage = lang;
    });

    this.terminologyService.languageRefsetConcept$.subscribe(languageRefsetConcept => {
      this.selectedLanRefsetConcept = languageRefsetConcept;
    });

    this.terminologyService.context$.subscribe(context => {
      this.selectedLanguageContext = context;
    });

    this.terminologyService.fhirUrlParam$.subscribe(urlParam => {
      if (this.editions?.length > 0) {
        this.editions.forEach(loopEdition => {
          if (loopEdition.resource.version === urlParam) {
            this.selectedEdition = loopEdition.resource.title?.replace('SNOMED CT release ','');
          }
        });
      }
    });

    this.terminologyService.snowstormFhirBase$.subscribe(url => {
      if (this.fhirServers?.length > 0) {
        this.fhirServers.forEach(loopServer => {
          if (loopServer.url === url) {
            this.selectedServer = loopServer;
            this.updateCodeSystemOptions()
          }
        });
      }
    });
  }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      this.router.navigate([demo.url], { queryParams: demo.queryParams });
    } else {
      this.openInNewTab(demo.url);
    }
  }

  openInNewTab(url: string) {
    window.open(url, '_blank');
  }

  updateCodeSystemOptions(preselectedEdition?: string) {
    this.terminologyService.getCodeSystems().subscribe((response: any) => {
      this.editionsDetails = [];
      this.editions = response.entry;
      // remove all entries that don't include SNOMED in the title
      this.editions = this.editions.filter( el => (el.resource?.url?.includes('snomed.info')));
      let editionNames = new Set();
      this.editions.forEach(loopEdition => {
        editionNames.add(loopEdition.resource.title);
        // editionNames.add(loopEdition.resource.title.substr(0,loopEdition.resource.title.lastIndexOf(' ')));
      });
      editionNames.forEach(editionName => {
        this.editionsDetails.push(
          {
            editionName: editionName,
            editions: this.editions.filter( el => (el.resource?.title?.includes(editionName))).sort( this.compare )
          }
        );
      });
      let currentVerIndex = this.editionsDetails.findIndex(x => x.editionName === 'International Edition'); //  SNOMED CT release
      if (preselectedEdition) {
        this.editions.forEach(loopEdition => {
          if (loopEdition.resource.version === preselectedEdition) {
            this.setEdition(loopEdition);
          }
        });
      } else if (currentVerIndex >= 0) {
        this.setEdition(this.editionsDetails[currentVerIndex].editions[0]);
      } else {
        this.setEdition(this.editions[0]);
      }
    });
  }

  compare( a: any, b: any ) {
    if ( a.resource.date < b.resource.date ){
      return 1;
    }
    if ( a.resource.date > b.resource.date ){
      return -1;
    }
    return 0;
  }

  setFhirServer(server: any) {
    this.selectedServer = server;
    this.terminologyService.setSnowstormFhirBase(server.url);
    this.selectedEdition = 'Edition';
    this.editions = [];
    this.editionsDetails = [];
  }

  setEdition(edition: any) {
    this.selectedEdition = edition.resource.title?.replace('SNOMED CT release ','');
    this.terminologyService.setFhirUrlParam(edition.resource.version);
    this.updateLanguageRefsets();
  }

  updateLanguageRefsets() {
    this.languageRefsets = [];
    this.terminologyService.getLanguageRefsets().subscribe((response: any) => {
      this.languageRefsets = response?.expansion?.contains;
      // sort by language display length
      this.languageRefsets.sort((a, b) => (a.display.length > b.display.length) ? 1 : -1);
    });
  }

  setLanguageRefset(languageRefset: any) {
    this.terminologyService.setLanguageRefsetConcept(languageRefset);
  }

  setLanguage(language: string) {
    if (language != 'en') {
      language += ', en';
    }
    this.selectedLanguage = language;
    this.terminologyService.setLang(language);
  }

  openLanguageDialog(): void {
    const dialogRef = this.dialog.open(LanguageConfigComponent, {
      width: '800px',
      disableClose: false,
      data: { languageCodes: this.languages, languageRefsets: this.languageRefsets, selectedLanguage: this.selectedLanguage, selectedLanRefsetConcept: this.selectedLanRefsetConcept },
    });

    dialogRef.afterClosed().subscribe((result) => {
      console.log('Dialog was closed. Result:', result);
    });
  }

}
