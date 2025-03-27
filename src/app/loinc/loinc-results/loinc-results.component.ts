import { Component, OnInit } from '@angular/core';
import saveAs from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
import { v3 as uuidv3, v3 } from 'uuid';

@Component({
    selector: 'app-loinc-results',
    templateUrl: './loinc-results.component.html',
    styleUrl: './loinc-results.component.css',
    standalone: false
})
export class LoincResultsComponent implements OnInit {

    isFlipped = false;

    fhirBundle: any = {};
    fhirBundleStr = "";
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

    results: any[] = [
        {
            "labConcept": {
                "coding": [
                    {
                    "system": "http://snomed.info/sct",
                    "version": "http://snomed.info/sct/11010000107",
                    "code": "277411010000101",
                    "display": "Fasting glucose [Moles/volume] in Serum or Plasma"
                    },
                    {
                    "system": "http://loinc.org",
                    "code": "14771-0",
                    "display": "Fasting glucose [Moles/volume] in Serum or Plasma"
                    }
                ],
                "text": "Fasting glucose [Moles/volume] in Serum or Plasma"
            },
            "result": "87",
            "units": {
                "system": "http://snomed.info/sct",
                "code": "258797006",
                "display": "mg/dL"
            },
            "referenceRange": "65 - 125"
        },
        {
            "labConcept": {
                "coding": [
                  {
                    "system": "http://snomed.info/sct",
                    "version": "http://snomed.info/sct/11010000107/version/20250321",
                    "code": "67151010000109",
                    "display": "Sodium [Moles/volume] in Venous blood"
                  },
                  {
                    "system": "http://loinc.org",
                    "code": "39791-9",
                    "display": "Sodium [Moles/volume] in Venous blood"
                  }
                ],
                "text": "Sodium [Moles/volume] in Venous blood"
            },
            "result": "140.0",
            "units": {
                "system": "http://snomed.info/sct",
                "code": "258813002",
                "display": "mmol/L"
            },
            "referenceRange": "135.0 - 144.0"
        },
        {
            "labConcept": {
                "coding": [
                  {
                    "system": "http://snomed.info/sct",
                    "version": "http://snomed.info/sct/11010000107/version/20250321",
                    "code": "203891010000109",
                    "display": "Potassium [Moles/volume] in Venous blood"
                  },
                  {
                    "system": "http://loinc.org",
                    "code": "39789-3",
                    "display": "Potassium [Moles/volume] in Venous blood"
                  }
                ],
                "text": "Potassium [Moles/volume] in Venous blood"
              },
            "result": "4.6",
            "units": {
                "system": "http://snomed.info/sct",
                "code": "258813002",
                "display": "mmol/L"
            },
            "referenceRange": "3.6 - 5.1"
        },
        {
            "labConcept": {
                "coding": [
                  {
                    "system": "http://snomed.info/sct",
                    "version": "http://snomed.info/sct/11010000107/version/20250321",
                    "code": "138321010000103",
                    "display": "Chloride [Moles/volume] in Venous blood"
                  },
                  {
                    "system": "http://loinc.org",
                    "code": "41649-5",
                    "display": "Chloride [Moles/volume] in Venous blood"
                  }
                ],
                "text": "Chloride [Moles/volume] in Venous blood"
            },
            "result": "106.0",
            "units": {
                "system": "http://snomed.info/sct",
                "code": "258813002",
                "display": "mmol/L"
            },
            "referenceRange": "99.0 - 108.0"
        }
    ];

    constructor(private clipboard: Clipboard) { }

    ngOnInit() {
      this.createFhirDiagnosticReportBundle();
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

    getCurrentDate() {
        // In format YYYY-MM-DD
        return new Date().toISOString().split('T')[0];
    }

    createFhirDiagnosticReportBundle() {
        this.fhirBundle = {
            "resourceType": "Bundle",
            "id": "example-bundle",
            "meta": {
                "versionId": "1",
                "lastUpdated": new Date().toISOString()
            },
            "type": "collection",
            "entry": []
        };

        this.results.forEach((result, index) => {
            const entry = {
                fullUrl: 'urn:uuid:' + uuidv3('dr' + result.labConcept.text, this.uuid_namespace),
                "resource": {
                    "resourceType": "DiagnosticReport",
                    "id": `dr-${index}`,
                    "status": "final",
                    "code": {
                        "coding": result.labConcept.coding,
                        "text": result.labConcept.text
                    },
                    "effectiveDateTime": this.getCurrentDate(),
                    "subject": {
                        reference: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8'
                    },
                    "result": [
                        // Add result references here
                        {
                            reference: 'urn:uuid:' + uuidv3('ob' + result.labConcept.text, this.uuid_namespace)
                        }
                    ]
                }
            };
            this.fhirBundle.entry.push(entry);
        });

        // add entries for observations
        this.results.forEach((result, index) => {
            const entry = {
                fullUrl: 'urn:uuid:' + uuidv3('ob' + result.labConcept.text, this.uuid_namespace),
                "resource": {
                    "resourceType": "Observation",
                    "id": `ob-${index}`,
                    "status": "final",
                    "subject": {
                        "reference": "urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8"
                    },
                    "code": {
                        "coding": result.labConcept.coding,
                        "text": result.labConcept.text
                    },
                    "valueQuantity": {
                        "value": parseFloat(result.result),
                        "unit": result.units.display,
                        "system": result.units.system,
                        "code": result.units.code
                    },
                    "referenceRange": [{
                        "low": {
                            "value": parseFloat(result.referenceRange.split('-')[0].trim()),
                            "unit": result.units.display,
                            "system": result.units.system,
                            "code": result.units.code
                        },
                        "high": {
                            "value": parseFloat(result.referenceRange.split('-')[1].trim()),
                            "unit": result.units.display,
                            "system": result.units.system,
                            "code": result.units.code
                        }
                    }],
                }
            };
            this.fhirBundle.entry.push(entry);
        });

        // Add patient to entries
        this.fhirBundle.entry.push({
          fullUrl: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8',  // or some absolute URI if you have one
          resource: this.patient
        });

        this.fhirBundleStr = JSON.stringify(this.fhirBundle, null, 2);
    }


}

