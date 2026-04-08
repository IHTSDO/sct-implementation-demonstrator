import { Component } from '@angular/core';
import type { ServiceRequest } from 'src/app/model';

@Component({
    selector: 'app-loinc-main',
    templateUrl: './loinc-main.component.html',
    styleUrl: './loinc-main.component.css',
    standalone: false
})
export class LoincMainComponent {
    readonly patient = {
        resourceType: 'Patient',
        id: 'example-patient',
        text: {
            status: 'generated',
            div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient Jane Doe</div>'
        },
        identifier: [
            {
                system: 'http://hospital.org/mrn',
                value: '1234567890'
            }
        ],
        name: [
            {
                use: 'official',
                family: 'Doe',
                given: ['Jane']
            }
        ],
        telecom: [
            {
                system: 'phone',
                value: '123-456-7890',
                use: 'home'
            },
            {
                system: 'email',
                value: 'jane@email.com',
                use: 'home'
            }
        ],
        birthDate: '1970-01-01',
        address: [
            {
                use: 'home',
                line: ['123 Main St'],
                city: 'Anytown',
                country: 'USA'
            }
        ]
    };

    draftServiceRequests: ServiceRequest[] = [];
    pendingDeterminations = 0;

    handleDraftOrderChanged(serviceRequests: ServiceRequest[]) {
        this.draftServiceRequests = serviceRequests;
    }

    handlePendingCountChanged(count: number) {
        this.pendingDeterminations = count;
    }
}
