import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private http = inject(HttpClient);

  getTranslation(lang: string) {
    if (lang.includes('/')) {
      const [scope, locale] = lang.split('/');
      return this.http.get<Translation>(`assets/i18n/${scope}/${scope}-${locale}.json`);
    }
    return this.http.get<Translation>(`assets/i18n/${lang}.json`);
  }
}
