import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-ips-terminology',
  templateUrl: './ips-terminology.component.html',
  styleUrls: ['./ips-terminology.component.css'],
  standalone: false,
})
export class IpsTerminologyComponent implements OnInit, OnDestroy {
  // International Derivatives edition — hosts the IPS reference set (816080008).
  private static readonly DERIVATIVES_EDITION = 'http://snomed.info/sct/705115006';

  readonly specPaths = [
    'assets/specs/ips-terminology/allergies.json',
    'assets/specs/ips-terminology/problem-list.json',
    'assets/specs/ips-terminology/immunizations.json',
    'assets/specs/ips-terminology/procedures.json',
    'assets/specs/ips-terminology/medications.json',
    'assets/specs/ips-terminology/result-organisms.json',
    'assets/specs/ips-terminology/devices.json',
  ];

  // Edition forwarded to every binding. Undefined => fall back to the global edition.
  editionUri?: string;
  derivativesStatus: 'checking' | 'available' | 'unavailable' = 'checking';

  // Search binding for the Interoperability Demo: any clinical concept.
  readonly interopBinding: any = {
    title: 'Search a concept (complete SNOMED CT edition)',
    type: 'autocomplete',
    ecl: '< 404684003 |Clinical finding (finding)| OR < 272379006 |Event (event)| OR < 243796009 |Situation with explicit context|',
    value: '',
    note: 'Searching using a complete edition of SNOMED CT.',
  };

  selectedConcept: any = null;
  conceptIsPartOfIps = false;
  ipsOptions: any[] = [];
  searching = false;

  private serverSub?: Subscription;

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit(): void {
    // Re-check edition availability whenever the configured server changes.
    this.serverSub = this.terminologyService.snowstormFhirBase$.subscribe(() =>
      this.checkDerivativesAvailability(),
    );
  }

  ngOnDestroy(): void {
    this.serverSub?.unsubscribe();
  }

  get introText(): string {
    const base =
      'Terminology bindings for SNOMED CT and the International Patient Summary (IPS) Implementation Guide. ' +
      'Each section offers a binding over the chosen SNOMED edition and an equivalent binding restricted to the IPS reference set (816080008). ';
    if (this.derivativesStatus === 'available') {
      return (
        base +
        'This demonstrator always queries the International Derivatives edition (which contains the IPS reference set), regardless of the edition selector.'
      );
    }
    return base;
  }

  private checkDerivativesAvailability(): void {
    this.derivativesStatus = 'checking';
    this.terminologyService.getCodeSystems().subscribe((response: any) => {
      const available = (response?.entry ?? []).some((entry: any) =>
        (entry?.resource?.version ?? '').startsWith(IpsTerminologyComponent.DERIVATIVES_EDITION),
      );
      if (available) {
        this.editionUri = IpsTerminologyComponent.DERIVATIVES_EDITION;
        this.derivativesStatus = 'available';
      } else {
        // Fall back to the default edition and warn the user.
        this.editionUri = undefined;
        this.derivativesStatus = 'unavailable';
      }
    });
  }

  conceptSelected(concept: any) {
    if (!concept?.code) {
      return;
    }
    this.selectedConcept = concept;
    this.searching = true;
    this.ipsOptions = [];
    this.conceptIsPartOfIps = false;

    // 1) Is the concept already a member of the IPS terminology refset?
    this.expandIps(`(${concept.code} AND ^816080008 |International Patient Summary|)`).subscribe(
      (result1) => {
        if (result1?.expansion?.total > 0) {
          this.conceptIsPartOfIps = true;
          this.searching = false;
        } else {
          // 2) Otherwise resolve the proximal common ancestor(s) within IPS.
          this.expandIps(
            `(> ${concept.code} AND ^816080008 |International Patient Summary|) MINUS (> (> ${concept.code} AND ^816080008 |International Patient Summary|))`,
          ).subscribe((result2) => {
            this.ipsOptions = result2?.expansion?.contains ?? [];
            this.conceptIsPartOfIps = false;
            this.searching = false;
          });
        }
      },
    );
  }

  /** Expand against the derivatives edition when available, otherwise the default edition. */
  private expandIps(ecl: string) {
    if (this.editionUri) {
      return this.terminologyService.expandValueSetFromServer('', this.editionUri, ecl, '');
    }
    return this.terminologyService.expandValueSet(ecl, '');
  }
}
