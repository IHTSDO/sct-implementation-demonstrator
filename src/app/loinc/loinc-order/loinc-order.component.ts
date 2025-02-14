import { Component, OnInit } from '@angular/core';
import { set } from 'lodash';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
    selector: 'app-loinc-order',
    templateUrl: './loinc-order.component.html',
    styleUrl: './loinc-order.component.css',
    standalone: false
})
export class LoincOrderComponent implements OnInit {

    loincOrderBinding = { ecl: '< 363787002 |Observable entity (observable entity)|', title: 'Lab item for order' };

    constructor(private terminologyService: TerminologyService) {
     }

    ngOnInit() {
        // setTimeout(() => {
        //     this.terminologyService.setSnowstormFhirBase('https://browser.loincsnomed.org/fhir');
        //     this.terminologyService.setFhirUrlParamLocal('http://snomed.info/sct');
        // }, 1000);
    }

    labItemSelected(event: any) {
        console.log('labItemSelected', event);
    }

}
