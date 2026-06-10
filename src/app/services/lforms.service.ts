import { Injectable } from '@angular/core';

declare var LForms: any;

type FhirVersion = 'R4' | 'R5';

const BASE = 'https://clinicaltables.nlm.nih.gov/lforms-versions/36.3.2';

@Injectable({ providedIn: 'root' })
export class LformsService {
  private coreReady: Promise<void> | null = null;
  private pluginReady = new Map<FhirVersion, Promise<void>>();

  detectVersion(questionnaire: any): FhirVersion {
    const profiles: string[] = questionnaire?.meta?.profile ?? [];
    if (profiles.some((p: string) => /\/5\.0\//.test(p))) return 'R5';
    return 'R4';
  }

  private loadCore(): Promise<void> {
    if (!this.coreReady) {
      this.coreReady = new Promise<void>((resolve) => {
        if (typeof LForms !== 'undefined') { resolve(); return; }
        const s = document.createElement('script');
        s.src = `${BASE}/webcomponent/lhc-forms.js`;
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    }
    return this.coreReady;
  }

  private loadPlugin(version: FhirVersion): Promise<void> {
    if (!this.pluginReady.has(version)) {
      const ready = this.loadCore().then(() => new Promise<void>((resolve) => {
        const src = `${BASE}/fhir/${version}/lformsFHIR.min.js`;
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        document.head.appendChild(s);
      }));
      this.pluginReady.set(version, ready);
    }
    return this.pluginReady.get(version)!;
  }

  preloadCore(): void {
    this.loadCore();
  }

  async renderQuestionnaire(questionnaire: any, containerId: string): Promise<void> {
    if (!questionnaire || Object.keys(questionnaire).length === 0) {
      await this.loadCore();
      LForms.Util.addFormToPage({}, containerId);
      return;
    }
    const version = this.detectVersion(questionnaire);
    await this.loadPlugin(version);
    const converted = LForms.Util.convertFHIRQuestionnaireToLForms(questionnaire, version);
    LForms.Util.addFormToPage(converted, containerId);
  }
}
