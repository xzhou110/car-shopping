# API / Module Contract (FROZEN) — divides the two build lanes

`src/types.ts` is the authoritative type contract (already written by PM). Neither lane edits it.

## Lane A — data-engineer owns: `src/lib/*`, `src/data/*`, `src/lib/*.test.ts`
Implements the pure engine + seed data. **No DOM, no React.** PM has placed typed **stubs** in these files —
replace the bodies with the real implementation (ported verbatim from `D:/Downloads/garage.html`) and add tests.

### `src/data/features.ts` (already authored by PM — do not change order)
`export const FEATURES: ReadonlyArray<readonly [FeatureKey, string, string]>` — 9 entries in canonical order.

### `src/lib/format.ts`
```ts
export function money(n: number | null | undefined): string;     // "$35,999"; '' for null/undefined
export function miles(n: number | null | undefined): string;     // "48,280 mi"
export function featState(c: Car, k: FeatureKey): FeatState;      // 'yes' | 'no' | 'unk'
export function featCount(c: Car): number;                        // counts only 'yes'
export function yn(state: FeatState): string;                     // 'Yes' | 'No' | '?'
export function carName(c: Car): string;                          // `${year} ${make} ${model}`.trim()
export function stars(n: number): string;                         // optional helper for ★ rendering
```

### `src/lib/derive.ts` (pure; inject currentYear for deterministic tests)
```ts
export function totalFees(c: Car): number;                        // (transferFee||0)+(feesEstimate||0)
export function otd(c: Car): number | null;                       // price + totalFees; null if no price
export function milesPerYr(c: Car, currentYear?: number): number | null; // round(mileage/max(1, yr-year))
export function tcoPerYear(c: Car, s: Settings): number | null;   // tco5yr / s.years
export function tcoPerMile(c: Car, s: Settings): number | null;   // tco5yr / (s.miles * s.years)
```

### `src/lib/flags.ts` (PURE — port §5.5 verbatim; inject currentYear)
```ts
export function getFlags(c: Car, currentYear?: number): Flag[];
export function signalLevel(c: Car, currentYear?: number): SignalLevel;
```
- Reuse `derive.milesPerYr` and `format.money` (do not re-inline) so behavior stays consistent.
- `signalLevel`: `risk` if any risk → else `warn` if (#warn ≥ 2 OR any warn) → else `good` if any good → else `''`.
  (Port the prototype's exact ordering at garage.html:674–681.)

### `src/data/sheetCols.ts`
```ts
export const SHEET_COLS: SheetCol[];                              // ported from garage.html:1224 (exact order)
```
Accessors use `derive.otd`, `derive.milesPerYr`, `format.featState`, and `FEATURES`.

### `src/lib/exportSheet.ts`
```ts
export function sheetMatrix(cars: Car[]): (string | number)[][]; // [titles row, ...one row per car]
export function toTSV(cars: Car[]): string;                      // tabs; newlines/tabs in cells flattened
export function toCSV(cars: Car[]): string;                      // RFC-style quoting
export function toJSON(cars: Car[]): string;                     // JSON.stringify(cars, null, 2)
```

### Tests (Vitest, import from 'vitest'): `src/lib/flags.test.ts`, `derive.test.ts`, `exportSheet.test.ts`
Cover every §5.5 rule + edge cases (accidents 0/1/2/null, branded vs Clean vs Unknown title, no VIN,
mileage thresholds, milesPerYr, owners≥3, no service records, over/under market, warranty none/void & not CPO,
stale≥60, private, the CPO "good" case, signalLevel ordering incl. the ≥2-warn branch), derived math
(min-1-year guard, null handling), and the export matrix (first row = titles, features as Yes/No/?).

---

## Lane B — frontend-engineer owns: `src/App.tsx`, `src/components/*`, `src/state/useGarage.ts`, component CSS appended to `src/styles.css`
Implements UI + state. **Imports the finished Lane A modules + `types.ts`.** Does NOT touch `lib/*`, `data/*`,
or `types.ts`. May read `format/derive/flags` signatures above to build against; integration happens after both
lanes return.

- `state/useGarage.ts`: `{ cars, settings, filters, ... }` with localStorage autosave (key `garage.v1`),
  hydrate-merge (so old saves gain new fields = spread over `DEFAULT` car), and CRUD (add/update/delete car,
  set ratings/status, update settings/filters). Provide a `useGarage()` hook returning state + actions.
  (The original contract also had a URL-hash import; it was removed on 2026-10-22 for security, ADR-011.)
- `components/`: `Card`, `Grid`, `CompareTable`, `DetailModal`, `Filters`, `ExportModal`, `SettingsModal`,
  `CarForm` (add/edit), `ThemeToggle`. Use `<dialog>` for modals. Render per spec §5.1–5.7.
- Theme: toggle writes `localStorage['garage.theme']` and sets `data-theme` on `<html>`; no-flash init is already
  in `index.html`.
- `App.tsx`: header (brand, stats, view toggle, theme, export, settings, add-car), controls, grid/compare switch.

## Shared (PM-owned, do not edit in a lane)
`types.ts`, `data/features.ts`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `main.tsx`,
the token block at the **top** of `styles.css`. Seed `data/cars.ts` is generated by PM (extraction script).
