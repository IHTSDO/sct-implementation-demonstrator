import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import saveAs from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
import { debounceTime, filter, forkJoin, Subject, switchMap, takeUntil } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';
import { v3 as uuidv3, v3 } from 'uuid';

@Component({
    selector: 'app-loinc-order',
    templateUrl: './loinc-order.component.html',
    styleUrl: './loinc-order.component.css',
    standalone: false
})
export class LoincOrderComponent implements OnInit, OnDestroy {

    searchControl = new FormControl('');
    private destroy$ = new Subject<void>();
    loincOrderBinding = { ecl: '^ 635111010000100', title: 'Lab item for order' };
    searchResults: any[] = [];
    totalResults = 0;
    searching = false;
    extending = false;
    offset = 0;
    limit = 50;
    resultsEcl = '';
    initializing = true;

    filterOptions: any[] = [];
    filters: any[] = [];
    order: any[] = [];
    specimens: any[] = [];
    searchingSpecimens = false;

    isFlipped = false;
    fhirBundle: any = {};
    fhirBundleStr = '';

    showLoincCodes = true;

    skeletonLoaders = Array(10);

    uuid_namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    patient = {
        "resourceType": "Patient",
        "id": "example-patient",
        "text": {
          "status": "generated",
          "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Patient Jane Doe</div>"
        },
        "identifier": [
          {
            "system": "http://hospital.org/mrn",
            "value": "1234567890"
          }
        ],
        "name": [
          {
            "use": "official",
            "family": "Doe",
            "given": [
              "Jane"
            ]
          }
        ],
        "telecom": [
          {
            "system": "phone",
            "value": "123-456-7890",
            "use": "home"
          },
          {
            "system": "email",
            "value": "jane@email.com",
            "use": "home"
          }
        ],
        "birthDate": "1970-01-01",
        "address": [
          {
            "use": "home",
            "line": [
              "123 Main St"
            ],
            "city": "Anytown",
            "country": "USA"
          }
        ]
    };
      

    constructor(private terminologyService: TerminologyService, private clipboard: Clipboard) {
    }

    ngOnInit() {
        this.searchControl.disable();
        setTimeout(() => {
            this.terminologyService.setSnowstormFhirBase('https://browser.loincsnomed.org/fhir');
            setTimeout(() => {
                this.terminologyService.setFhirUrlParam('http://snomed.info/sct/11010000107/version/20250321');
                this.searchControl.enable();
                this.initializing = false;
                this.updateFHIRBundle();
            }, 1500);
        }, 1500);

        this.searchControl.valueChanges
        .pipe(
            debounceTime(300),
            // distinctUntilChanged(),
            filter((term): term is string => !!term && term.length >= 3),
            // switchMap cancels previous in-flight requests when a new value is emitted
            switchMap((term: string) => {
            this.searching = true;
            this.searchResults = [];
            this.filterOptions = [];
            this.totalResults = 0;
            this.offset = 0;
            this.limit = 50;

            // Build refinements filter
            let refinements = '';
            this.filters.forEach( (filter, index) => {
                if (index == 0) {
                    refinements = ': ';
                }
                refinements += `${filter.refinement} ${filter.selected.code}`;
                if (index < this.filters.length - 1) {
                refinements += ', ';
                }
            });

            // Build the ECL strings
            const ecl = `(^ 635111010000100 ${refinements}) {{ D term = "${term}" }}`;
            this.resultsEcl = ecl;
            const propertyEcl = `(${ecl}).370130000 |Property (attribute)|`;
            const componentEcl = `(${ecl}).246093002 |Component (attribute)|`;
            const scaleEcl = `(${ecl}).370132008 |Scale type (attribute)|`;
            const siteEcl = `(${ecl}).704327008 |Direct site (attribute)|`;
            const inheresEcl = `(${ecl}).704319004 |Inheres in (attribute)|`;
            const techniqueEcl = `(${ecl}).246501002 |Technique (attribute)|`;

            // Return a single combined Observable that includes both calls
            return forkJoin({
                mainResult: this.terminologyService.expandValueSet(ecl, '', 0, this.limit),
                propertyResult: this.terminologyService.expandValueSet(propertyEcl, '', 0, 50),
                componentResult: this.terminologyService.expandValueSet(componentEcl, '', 0, 50),
                scaleResult: this.terminologyService.expandValueSet(scaleEcl, '', 0, 50),
                siteResult: this.terminologyService.expandValueSet(siteEcl, '', 0, 50),
                inheresResult: this.terminologyService.expandValueSet(inheresEcl, '', 0, 50),
                techniqueResult: this.terminologyService.expandValueSet(techniqueEcl, '', 0, 50)
            });
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: ({ mainResult, propertyResult, componentResult, scaleResult, siteResult, inheresResult, techniqueResult }) => {
                // Now both requests have completed
                this.searchResults = mainResult?.expansion?.contains || [];
                this.totalResults = mainResult?.expansion?.total || 0;

                let propertyFilterOptions = {
                    title: 'Property',
                    options: propertyResult?.expansion?.contains || [],
                    otherOptions: [],
                    refinement: '370130000 |Property (attribute)| = '
                }
                propertyFilterOptions.options.sort((a: any, b: any) => a.display.localeCompare(b.display));
                propertyFilterOptions.otherOptions = propertyFilterOptions.options.slice(5);
                propertyFilterOptions.options = propertyFilterOptions.options.slice(0, 5);
                this.filterOptions.push(propertyFilterOptions);

                let componentFilterOptions = {
                    title: 'Component',
                    options: componentResult?.expansion?.contains || [],
                    otherOptions: [],
                    refinement: '246093002 |Component (attribute)| = '
                }
                componentFilterOptions.options.sort((a: any, b: any) => a.display.localeCompare(b.display));
                componentFilterOptions.otherOptions = componentFilterOptions.options.slice(5);
                componentFilterOptions.options = componentFilterOptions.options.slice(0, 5);

                this.filterOptions.push(componentFilterOptions);

                let scaleFilterOptions = {
                    title: 'Scale',
                    options: scaleResult?.expansion?.contains || [],
                    otherOptions: [],
                    refinement: '370132008 |Scale type (attribute)| = '
                }
                scaleFilterOptions.options.sort((a: any, b: any) => a.display.localeCompare(b.display));
                scaleFilterOptions.otherOptions = scaleFilterOptions.options.slice(5);
                scaleFilterOptions.options = scaleFilterOptions.options.slice(0, 5);
                this.filterOptions.push(scaleFilterOptions);

                let siteFilterOptions = {
                    title: 'Site',
                    options: siteResult?.expansion?.contains || [],
                    otherOptions: [],
                    refinement: '704327008 |Direct site (attribute)| = '
                }
                siteFilterOptions.options.sort((a: any, b: any) => a.display.localeCompare(b.display));
                siteFilterOptions.otherOptions = siteFilterOptions.options.slice(5);
                siteFilterOptions.options = siteFilterOptions.options.slice(0, 5);
                this.filterOptions.push(siteFilterOptions);

                let inheresFilterOptions = {
                    title: 'Inheres in',
                    options: inheresResult?.expansion?.contains || [],
                    otherOptions: [],
                    refinement: '704319004 |Inheres in (attribute)| = '
                }
                inheresFilterOptions.options.sort((a: any, b: any) => a.display.localeCompare(b.display));
                inheresFilterOptions.otherOptions = inheresFilterOptions.options.slice(5);
                inheresFilterOptions.options = inheresFilterOptions.options.slice(0, 5);
                this.filterOptions.push(inheresFilterOptions);

                let techniqueFilterOptions = {
                    title: 'Technique',
                    options: techniqueResult?.expansion?.contains || [],
                    otherOptions: [],
                    refinement: '246501002 |Technique (attribute)| = '
                }
                techniqueFilterOptions.options.sort((a: any, b: any) => a.display.localeCompare(b.display));
                techniqueFilterOptions.otherOptions = techniqueFilterOptions.options.slice(5);
                techniqueFilterOptions.options = techniqueFilterOptions.options.slice(0, 5);
                this.filterOptions.push(techniqueFilterOptions);


                this.searching = false;
            },
            error: err => {
                console.error('Search error:', err);
                this.searching = false;
            }
        });
    }

    loadNextPage() {
        this.offset = this.searchResults.length; // Increment the offset for pagination
        this,this.extending = true;
        this.terminologyService.expandValueSet(this.resultsEcl, '', this.offset, this.limit).subscribe({
            next: (result) => {
                // Append the new results to the existing searchResults array
                const newResults = result?.expansion?.contains || [];
                this.searchResults = [...this.searchResults, ...newResults];
                this.extending = false;
            },
            error: (err) => {
                console.error('Error loading next page:', err);
                this.extending = false;
            }
        });
    }

    addFilter(filter: any, option: any) {
        const existingFilter = this.filters.find( f => f.title === filter.title);
        if (existingFilter) {
            existingFilter.selected = option;
        } else {
            this.filters.push({ title: filter.title, selected: option, refinement: filter.refinement });
        }
        this.searchControl.setValue(this.searchControl.value);
    }

    removeFilter(filter: any) {
        const index = this.filters.findIndex( f => f.title === filter.title);
        if (index >= 0) {
            this.filters.splice(index, 1);
            this.searchControl.setValue(this.searchControl.value);
        }
    }

    labItemSelected(event: any) {
        console.log('labItemSelected', event);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    toggleLoincCodes() {
        this.showLoincCodes = !this.showLoincCodes;
    }

    addToOrder(item: any) {
        if (this.order.find( i => i.code === item.code)) {
            return;
        }
        item.loincId = '-------';
        this.order.push(item);
        let ecl = item.code + '.(704327008 |Direct site (attribute)| OR 704319004 |Inheres in (attribute)|)';
        this.terminologyService.expandValueSet(ecl, '', 0, 1)
        .subscribe({
            next: (result) => {
                if (result?.expansion?.contains?.length > 0) {
                    item.specimen = result?.expansion?.contains[0];
                }
                this.terminologyService.getAlternateIdentifiers(item.code).subscribe({
                    next: (result2) => {
                        item.loincId = this.getAlternateIdentifierByScheme(result2, '30051010000102');
                        this.updateSpecimens();
                        this.updateFHIRBundle();
                    }
                });
            },
            error: err => {
                console.error('Search error:', err);
            }
        });
    }

    getAlternateIdentifierByScheme(alternateIdentifiers: any[], identifierSchemeConceptId: string): string | null {
        // Find the alternate identifier that matches the given identifier scheme concept ID
        const matchingIdentifier = alternateIdentifiers.find(
            (identifier: any) => identifier.identifierScheme?.conceptId === identifierSchemeConceptId
        );
    
        // Return the alternateIdentifier value if found, otherwise return null
        return matchingIdentifier ? matchingIdentifier.alternateIdentifier : null;
    }

    removeFromOrder(index: number) {
        this.order.splice(index, 1);
        this.updateSpecimens();
        this.updateFHIRBundle();
    }

    getCurrentDate() {
        // In format YYYY-MM-DD
        return new Date().toISOString().split('T')[0];
    }

    updateSpecimens() {
        this.specimens = [];
        // Collect all speciments in items if it is not already in the list
        this.order.forEach( (item) => {
            if (item.specimen && !this.specimens.find( s => s.code === item.specimen.code)) {
                this.specimens.push(item.specimen);
            }
        });
    }

    flipCard() {
        this.isFlipped = !this.isFlipped;
    }

    saveFhirResource() {
        var blob = new Blob([this.fhirBundleStr], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "request-bundle.json");
    }

    copyToClipboard(text: string) {
        this.clipboard.copy(text);
    }

    updateFHIRBundle() {
        this.fhirBundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: []
        };
      
        this.order.forEach((item) => {
          const entry = {
            fullUrl: 'urn:uuid:' + uuidv3(item.code, this.uuid_namespace),
            resource: {
              resourceType: 'ServiceRequest',
              status: 'draft',
              intent: 'order',
              text: {
                status: 'generated',
                div: '<div xmlns="http://www.w3.org/1999/xhtml">Order for ' + item.display + '</div>'
              },
              code: {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    version: this.terminologyService.getFhirUrlParam(),
                    code: item.code,
                    display: item.display
                  },
                  {
                    system: 'http://loinc.org',
                    code: item.loincId,
                    display: item.display
                  }
                ],
                text: item.display
              },
              specimen: [
                {
                  reference: 'urn:uuid:' + ((item?.specimen) ? uuidv3(item?.specimen?.code, this.uuid_namespace): 'no-specimen'),
                }
              ],
              subject: {
                // reference the patient's id
                reference: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8'
              },
              occurrenceDateTime: this.getCurrentDate()
            }
          };
          this.fhirBundle.entry.push(entry);
        });

        // Add specimens to the bundle
        this.specimens.forEach((specimen) => {
            this.fhirBundle.entry.push({
                fullUrl: 'urn:uuid:' + uuidv3(specimen.code, this.uuid_namespace),
                resource: {
                    resourceType: 'Specimen',
                    id: specimen.code,
                    type: {
                        coding: [
                            {
                                system: 'http://snomed.info/sct',
                                version: this.terminologyService.getFhirUrlParam(),
                                code: specimen.code,
                                display: specimen.display
                            }
                        ],
                        text: specimen.display
                    },
                    text: {
                        status: 'generated',
                        div: '<div xmlns="http://www.w3.org/1999/xhtml">Specimen for ' + specimen.display + '</div>'
                    }
                }
            });
        });

        this.fhirBundle.entry.push({
            fullUrl: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8',  // or some absolute URI if you have one
            resource: this.patient
        });
      
        this.fhirBundleStr = JSON.stringify(this.fhirBundle, null, 2);
    }

}
