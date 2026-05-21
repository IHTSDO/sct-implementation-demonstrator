import { Component, inject, OnInit } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const STORAGE_KEY = 'ui-lang';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
  standalone: false,
})
export class LanguageSwitcherComponent implements OnInit {
  private transloco = inject(TranslocoService);

  availableLangs = this.transloco.getAvailableLangs() as string[];
  activeLang = this.transloco.getActiveLang();

  ngOnInit(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && this.availableLangs.includes(saved)) {
      this.transloco.setActiveLang(saved);
      this.activeLang = saved;
    }
  }

  setLang(lang: string): void {
    this.transloco.setActiveLang(lang);
    this.activeLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }
}
