import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { set } from 'lodash';
import { debounceTime, distinctUntilChanged, filter, forkJoin, Subject, switchMap, takeUntil } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
    selector: 'app-loinc-order',
    templateUrl: './loinc-order.component.html',
    styleUrl: './loinc-order.component.css',
    standalone: false
})
export class LoincOrderComponent implements OnInit, OnDestroy {

    searchControl = new FormControl('');
    private destroy$ = new Subject<void>();
    loincOrderBinding = { ecl: '< 363787002 |Observable entity (observable entity)|', title: 'Lab item for order' };
    searchResults: any[] = [];
    totalResults = 0;
    searching = false;
    initializing = true;

    filterOptions: any[] = [];
    filters: any[] = [];

    constructor(private terminologyService: TerminologyService) {
    }

    ngOnInit() {
        this.searchControl.disable();
        setTimeout(() => {
            this.terminologyService.setSnowstormFhirBase('https://browser.loincsnomed.org/fhir');
            setTimeout(() => {
                this.terminologyService.setFhirUrlParam('http://snomed.info/sct/11010000107/version/20231015');
                this.searchControl.enable();
                this.initializing = false;
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
            const ecl = `(< 363787002 |Observable entity (observable entity)| ${refinements}) {{ C moduleId = 11010000107 }} {{ D term = "${term}" }}`;
            const propertyEcl = `(${ecl}).370130000 |Property (attribute)|`;
            const componentEcl = `(${ecl}).246093002 |Component (attribute)|`;
            const scaleEcl = `(${ecl}).370132008 |Scale type (attribute)|`;
            const siteEcl = `(${ecl}).704327008 |Direct site (attribute)|`;
            const techniqueEcl = `(${ecl}).246501002 |Technique (attribute)|`;

            // Return a single combined Observable that includes both calls
            return forkJoin({
                mainResult: this.terminologyService.expandValueSet(ecl, '', 0, 15),
                propertyResult: this.terminologyService.expandValueSet(propertyEcl, '', 0, 15),
                componentResult: this.terminologyService.expandValueSet(componentEcl, '', 0, 15),
                scaleResult: this.terminologyService.expandValueSet(scaleEcl, '', 0, 15),
                siteResult: this.terminologyService.expandValueSet(siteEcl, '', 0, 25),
                techniqueResult: this.terminologyService.expandValueSet(techniqueEcl, '', 0, 15)
            });
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: ({ mainResult, propertyResult, componentResult, scaleResult, siteResult, techniqueResult }) => {
                // Now both requests have completed
                this.searchResults = mainResult?.expansion?.contains || [];
                this.totalResults = mainResult?.expansion?.total || 0;

                let propertyFilterOptions = {
                    title: 'Property',
                    options: propertyResult?.expansion?.contains || [],
                    refinement: '370130000 |Property (attribute)| = '
                }
                this.filterOptions.push(propertyFilterOptions);

                let componentFilterOptions = {
                    title: 'Component',
                    options: componentResult?.expansion?.contains || [],
                    refinement: '246093002 |Component (attribute)| = '
                }
                this.filterOptions.push(componentFilterOptions);

                let scaleFilterOptions = {
                    title: 'Scale',
                    options: scaleResult?.expansion?.contains || [],
                    refinement: '370132008 |Scale type (attribute)| = '
                }
                this.filterOptions.push(scaleFilterOptions);

                let siteFilterOptions = {
                    title: 'Site',
                    options: siteResult?.expansion?.contains || [],
                    refinement: '704327008 |Direct site (attribute)| = '
                }
                this.filterOptions.push(siteFilterOptions);

                let techniqueFilterOptions = {
                    title: 'Technique',
                    options: techniqueResult?.expansion?.contains || [],
                    refinement: '246501002 |Technique (attribute)| = '
                }
                this.filterOptions.push(techniqueFilterOptions);


                this.searching = false;
            },
            error: err => {
                console.error('Search error:', err);
                this.searching = false;
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

}
