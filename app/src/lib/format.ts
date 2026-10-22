import type { Car, FeatureKey, FeatState } from '../types';
import { FEATURES, FEATURE_IMPLIES } from '../data/features';

/** "$35,999" — em-dash for null/undefined (ported from prototype:578). 0 renders as "$0". */
export function money(n: number | null | undefined): string {
  return n || n === 0 ? '$' + Number(n).toLocaleString('en-US') : '—';
}

/** "48,280 mi" — em-dash for null/undefined (prototype:579). */
export function miles(n: number | null | undefined): string {
  return n || n === 0 ? Number(n).toLocaleString('en-US') + ' mi' : '—';
}

/**
 * Tri-state for a feature: 'yes' | 'no' | 'unk'. 'unk' must never collapse to 'no'.
 * A stronger feature can imply this one (see FEATURE_IMPLIES): e.g. a panoramic roof
 * counts as a sunroof/moonroof, so it wins even over an explicit moonroof:false.
 */
export function featState(c: Car, k: FeatureKey): FeatState {
  const feat = c.feat || {};
  if (feat[k] === true) return 'yes';
  for (const src in FEATURE_IMPLIES) {
    if (FEATURE_IMPLIES[src as FeatureKey]!.includes(k) && feat[src as FeatureKey] === true) return 'yes';
  }
  return feat[k] === false ? 'no' : 'unk';
}

/** Count of features the car definitively HAS (only 'yes'). */
export function featCount(c: Car): number {
  return FEATURES.reduce((n, [k]) => n + (featState(c, k) === 'yes' ? 1 : 0), 0);
}

/** Plain-text tri-state for export/spreadsheet cells. */
export function yn(state: FeatState): string {
  return state === 'yes' ? 'Yes' : state === 'no' ? 'No' : '?';
}

/**
 * A safe link target: returns the trimmed URL only if it is http(s), else undefined.
 * React escapes text but NOT URL schemes — a `javascript:` / `data:text/html` sourceUrl (typed in
 * the form) would execute on click. Use this everywhere car.sourceUrl becomes an <a href>.
 * (Ported from apartment-shopping's code review M1, minus mailto: a car listing link is never an email.)
 */
export function safeHref(u: string | null | undefined): string | undefined {
  const s = (u || '').trim();
  return /^https?:\/\//i.test(s) ? s : undefined;
}

/** Display name `${year} ${make} ${model}` (prototype:581). */
export function carName(c: Car): string {
  return `${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim();
}

/** Render a 0–5 rating as filled/empty stars, e.g. ★★★★☆. */
export function stars(n: number): string {
  const v = Math.max(0, Math.min(5, Math.round(n || 0)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}
