import { Component } from '@angular/core';
import saveAs from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
    selector: 'app-loinc-results',
    templateUrl: './loinc-results.component.html',
    styleUrl: './loinc-results.component.css',
    standalone: false
})
export class LoincResultsComponent {

    isFlipped = false;
    fhirBundleStr = "";

    results: any[] = [
        {
            "code": "12345-6",
            "display": "Test Result 1",
            "loincId": "12345-6",
            "name": "Test Result 1",
            "value": "123",
            "unit": "mg/dL",
            "referenceRange": "70-100",
            "date": "2021-01-01"
        },
        {
            "loinc": "54321-0",
            "name": "Test Result 2",
            "value": "4.5",
            "unit": "mg/dL",
            "referenceRange": "3.5-5.5",
            "date": "2021-01-01"
        }
    ];

    constructor(private clipboard: Clipboard) { }

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

    getCurrentDate() {
        // In format YYYY-MM-DD
        return new Date().toISOString().split('T')[0];
    }


}
