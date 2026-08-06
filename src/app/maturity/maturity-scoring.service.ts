import { Injectable } from '@angular/core';

/** A maturity level derived from a 0–5 score. */
export interface MaturityLevel {
  /** Integer level, 0–5 (0 = None). */
  value: number;
  /** i18n key suffix under `maturity.results` (e.g. 'levelBasic'). */
  key: string;
  /** Default English label. */
  label: string;
}

/**
 * Single source of truth for mapping a maturity score to a level.
 *
 * Both the maturity results page and the maturity dashboard must use this so
 * the two views cannot drift apart. The bucketing matches the results page,
 * which is the authoritative view.
 */
@Injectable({ providedIn: 'root' })
export class MaturityScoringService {
  /** Ordered levels 1–5 (the implicit 0 = None is excluded). */
  readonly resultsScale: ReadonlyArray<{ value: number; label: string }> = [
    { value: 1, label: 'Basic' },
    { value: 2, label: 'Emerging' },
    { value: 3, label: 'Advanced' },
    { value: 4, label: 'Integrated' },
    { value: 5, label: 'Optimizing' }
  ];

  /**
   * Maps a 0–5 maturity score to its level using threshold ranges.
   * A score of exactly 0 is `None`; otherwise the score is bucketed by its
   * upper bound (`<= 1` → Basic, `<= 2` → Emerging, …).
   */
  getLevel(score: number): MaturityLevel {
    if (score === 0) return { value: 0, key: 'levelNone', label: 'None' };
    if (score <= 1) return { value: 1, key: 'levelBasic', label: 'Basic' };
    if (score <= 2) return { value: 2, key: 'levelEmerging', label: 'Emerging' };
    if (score <= 3) return { value: 3, key: 'levelAdvanced', label: 'Advanced' };
    if (score <= 4) return { value: 4, key: 'levelIntegrated', label: 'Integrated' };
    return { value: 5, key: 'levelOptimizing', label: 'Optimizing' };
  }

  /** Default English label for a 0–5 score (for non-translated contexts). */
  getLevelLabel(score: number): string {
    return this.getLevel(score).label;
  }

  /** i18n key suffix (under `maturity.results`) for a 0–5 score. */
  getLevelKey(score: number): string {
    return this.getLevel(score).key;
  }
}
