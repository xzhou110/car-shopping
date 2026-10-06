---
name: car-shopping
formerly: [garage]
summary: Single-user used-car shortlist & compare — capture listings from screenshots, auto risk/value flags, rank by total cost of ownership, export to Google Sheets; static SPA on GitHub Pages
status: live
live: https://xzhou110.github.io/car-shopping/
repo: https://github.com/xzhou110/car-shopping
updated: 2026-10-06
---

# Car Shopping — Used-Car Shortlist & Compare

## 1. Summary
A single-user dashboard built for xzhou's **used RAV4 Hybrid search** (target window ≈ June 2026):
paste a listing screenshot → I extract year/trim/price/mileage/title/accidents/features and append
a typed car; the app shows auto **risk/value flags**, a 10-feature tri-state pill row, out-the-door
price and an **estimated N-year total cost of ownership**, ranks/filters/compares cars, takes
ratings, and syncs to a Google Sheet. Static, free, no backend. It was the first `/build` full
build and the template that [`apartment-shopping`](../apartment-shopping/PROJECT.md) was adapted from.
**Deployed and working**; last change 2026-06-25 — if the car has been bought, flip status to `done`.

## 2. Key facts
| | |
|---|---|
| **Kind** | web app (static SPA, single user) |
| **Stack** | Vite + React + TypeScript · Vitest (211 tests) · CSS tokens, light/dark · localStorage + URL-hash share |
| **Local path** | `D:\Meaningful\AI\car-shopping` (Vite app in `app/`) |
| **Run** | `cd app; npm run dev` → http://localhost:5178 · `npm test` · `npm run build` |
| **Deploy** | push to `main` → `.github/workflows/deploy.yml` → GitHub Pages |
| **Data / backends** | Seed cars in `app/src/data/cars.ts` (c1–c18) + photos `app/public/img/cN.jpg`; TCO engine **vendored** from car-tco-compare (`app/src/lib/tco/`); Google Sheets sync via the user's Apps Script Web App (URL in localStorage only). **$0/month.** |
| **Related** | [`car-tco-compare`](../car-tco-compare/PROJECT.md) (source of the TCO engine) · [`apartment-shopping`](../apartment-shopping/PROJECT.md) (derived from this) · [`/build` plugin](../claude-marketplace/PROJECT.md) · skills: `ship-web-app`, `web-sheets-sync`, `web-ship-check` |
| **Started · last major change** | 2026-06-23 (first commit; ported from a single-file prototype) · 2026-06-25 (TCO ranking, ADR-009) |

## 3. Key things to know
- **Renamed on 2026-10-06:** project folder, GitHub repository, app title, CSV filename, and live URL now use `car-shopping` / Car Shopping. Existing saves still use `garage.v1` and `garage.theme`; keep these keys and the internal `useGarage` hook compatible. The live origin and local launch port (5178) are unchanged. `formerly: [garage]` connects old Command Center history to this project.
- **Seed = source of truth.** `app/src/data/cars.ts`, one typed `Car` per entry; user edits (ratings, status, hand-added cars) live in their browser and are merged over the seed on load. Ids `cN` are stable and key the overlay + image filenames.
- **Add-a-car = read the screenshot honestly.** Map vendor wording onto the 10 tracked features as **tri-state** (✓ / ✕ / ? unknown — never silently "no"); anything inferred from a package is marked "confirm". **Infer trim-STANDARD equipment** (e.g. JBL audio + heated seats are standard on a RAV4 Limited and won't appear in the sticker's add-ons). Panoramic roof ⟹ sunroof, one-way.
- **Flag rules that were argued over:** one reported accident → **red** (ADR-008); annual mileage amber ≥ 15k, red ≥ 25k; Toyota hybrids keep 8-yr/100k hybrid + 10-yr/150k battery coverage — don't flag "out of warranty" off the 3/36 basic.
- **TCO is vendored, not shared.** `app/src/lib/tco/` is a verbatim copy of car-tco-compare's pure engine + a `resolve.ts` adapter (ADR-009: no npm package / submodule / API — keeps the app static & offline). Re-sync by hand when the source changes. Every figure is labelled **"Est."** (segment-typical placeholder rates, CA averages).
- The Google Sheet Web-App URL is the user's secret — localStorage only, never bundled (verified by grepping the built JS). The Apps Script recipe + the "access = Anyone" trap are in README + the `web-sheets-sync` skill.
- Repo is **public** by the user's choice (ADR-007 reversed the local-only ADR-003). Standing OK to push/deploy after validation.
- Known gap: **`c10.jpg` is missing** (seed references it → placeholder shows).
- Three untracked analysis files sit at the repo root (`cars-comparison.md/.tsv`, `rav4-shortlist-excl-2022.md`) — decide: commit, move to `docs/`, or delete.

## 4. Details
### How it works
Frozen `types.ts` → pure engine in `lib/*` (flags, derive, format, exportSheet, tco/) covered by
Vitest → thin React UI. `state/useGarage.ts` owns cars + settings + filters with localStorage
autosave and URL-hash share. Compare view highlights best/worst per row; TCO recomputes live from
the Assumptions (horizon years + annual miles).
```
app/src/
  types.ts            Car, Feat, Settings, Flag
  data/               cars.ts (seed) · features.ts · sheetCols.ts
  lib/                flags · derive · format · exportSheet · tco/ (vendored engine + resolve adapter)
  state/useGarage.ts  cars + settings + filters; persistence + share
  components/         Card · Grid · CompareTable · DetailModal · Filters · CarForm · Export/Settings modals
docs/                 PRD.md · spec-source.md · api-contract.md
```

### How to work on it
`cd app; npm install` (once) → `npm run dev` / `npm test` / `npm run build`. Validate in the
running app, push to `main`, confirm the live URL serves the new bundle. Standing workflow: user
sends listing (+ Carfax) screenshots → I extract, append, crop/save the photo, validate, push.

### Current state & open items
Deployed, stable, no active build. Open: `c10.jpg` missing; untracked root files (above); the
`review-findings.md` pre-ship review is a dated record. Detail: [STATE.md](STATE.md).

### Change highlights
- 2026-10-06 — Renamed Garage to Car Shopping locally and on GitHub, updated related projects and portfolio links, and retained existing browser storage.
- 2026-06-25 — TCO ranking: vendored car-tco-compare engine, TCO sort/compare row/detail breakdown (ADR-009); c18 spec sheet self-hosted.
- 2026-06-23 → 24 — public GitHub Pages deploy (ADR-007); Sheets sync via Apps Script; accident=1 → red (ADR-008); id badges + id search; c1–c17 added across sessions.
- 2026-06-23 — full `/build` (lean crew) porting the 257 KB single-file prototype to Vite/React/TS; first commit.

## 5. Pointers
- [README.md](README.md) — product face incl. the Google Sheet one-time setup + troubleshooting, TCO explanation, the 10 features.
- [docs/PRD.md](docs/PRD.md) · [docs/spec-source.md](docs/spec-source.md) · [docs/api-contract.md](docs/api-contract.md).
- [DECISIONS.md](DECISIONS.md) — ADR-001…009 (ADR-002 seed-vs-Sheet, ADR-008 accident flag, ADR-009 vendoring).
- [STATE.md](STATE.md) · [RUN_LOG.md](RUN_LOG.md) · [review-findings.md](review-findings.md).
- `app/src/lib/tco/README.md` — engine provenance + how to re-sync from car-tco-compare.
- Memory: `garage-app.md` (this file supersedes its durable parts). Skills: `ship-web-app`, `web-sheets-sync`, `web-ship-check`.
