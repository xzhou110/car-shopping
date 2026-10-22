---
name: car-shopping
formerly: [garage]
summary: Single-user used-car shortlist & compare — capture listings from screenshots, auto risk/value flags, rank by total cost of ownership, export to Google Sheets; static SPA on GitHub Pages
status: live
live: https://xzhou110.github.io/car-shopping/
repo: https://github.com/xzhou110/car-shopping
updated: 2026-10-21
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
| **Stack** | Vite + React + TypeScript · Vitest (211 tests) · ESLint (the standard's boundary and size rules, `app/eslint.config.js`) · CSS tokens, light/dark · localStorage autosave (a base64 state `#hash`, if present, overrides it) |
| **Local path** | `D:\Meaningful\AI\car-shopping` (Vite app in `app/`) |
| **Run** | `cd app; npm run dev` → http://localhost:5173 (Vite default; no port in `vite.config.ts`) · workspace launch entry `car-shopping` ([`.claude/launch.json`](../.claude/launch.json)) → http://127.0.0.1:5178 · `npm run check` (= lint, typecheck, tests, build; the validation for any change) · `npm test` · `npm run lint` · `npm run build` (= `tsc --noEmit && vite build`) |
| **Deploy** | push to `main` → `.github/workflows/deploy.yml`: `check` job (`npm run check`) → `build` → GitHub Pages; `check.yml` runs the same gate on every other branch and pull request (ADR-010) |
| **Data / backends** | Seed cars in `app/src/data/cars.ts` (c1–c18) + photos `app/public/img/cN.jpg`; TCO engine **vendored** from car-tco-compare (`app/src/lib/tco/`); Google Sheets sync via the user's Apps Script Web App (URL in localStorage only). **$0/month.** |
| **Related** | [`car-tco-compare`](../car-tco-compare/PROJECT.md) (source of the TCO engine; its RAV4 Deal Alerts email backend is a separate thing, not part of this app) · [`apartment-shopping`](../apartment-shopping/PROJECT.md) (derived from this) · [`/build` plugin](../claude-marketplace/PROJECT.md) · skills: `ship-web-app`, `web-sheets-sync`, `web-ship-check` |
| **Started · last major change** | 2026-06-23 (first commit; ported from a single-file prototype) · 2026-06-25 (TCO ranking, ADR-009) |

## 3. Key things to know
- **Renamed on 2026-10-06:** project folder, GitHub repository, app title, CSV filename, and live URL now use `car-shopping` / Car Shopping. Existing saves still use `garage.v1` and `garage.theme`; keep these keys and the internal `useGarage` hook compatible. The live origin and the workspace launch entry's port (5178) are unchanged. `formerly: [garage]` connects old Command Center history to this project.
- **Seed = source of truth.** `app/src/data/cars.ts`, one typed `Car` per entry; ids `cN` are stable and key the overlay + image filenames. On load (`mergeWithSeed` in `app/src/state/useGarage.ts`) the seed wins for the car set and every field; from the browser's save only a seed car's `rating` + `status` are overlaid, in-app-added cars are kept, and deleted ids stay deleted (`removed` list). Two consequences: editing a seed car's other fields in the form is lost on reload (change `cars.ts` instead), and a `status` changed in `cars.ts` does not reach a browser that already saved that car (change it in-app). A base64 JSON `#hash` wins over localStorage; nothing in the app writes one.
- **Add-a-car = read the screenshot honestly.** Map vendor wording onto the 10 tracked features as **tri-state** (✓ / ✕ / ? unknown — never silently "no"); anything inferred from a package is marked "confirm" in `notes`. **Infer trim-STANDARD equipment** (e.g. JBL audio + heated seats are standard on a RAV4 Limited and won't appear in the sticker's add-ons) — trim notes under Domain rules below. Panoramic roof ⟹ sunroof, one-way (`FEATURE_IMPLIES` in `app/src/data/features.ts`, applied by `featState` in `app/src/lib/format.ts`). `ownerType` comes from the history report, not the seller's wording (c11 read "Personal" until the CARFAX showed ex-Avis fleet). Photo → `app/public/img/cN.jpg` (a `data:` URI in `image` is the only fallback; a missing file shows the placeholder). `app/src/types.ts` is the frozen contract (`Car`, `Feat`, `Settings`, `Flag`); the 10-key order in `features.ts` is frozen too — it drives the pill row, checklist and export columns.
- **Flag rules that were argued over** (`app/src/lib/flags.ts` + tests): one reported accident → **red** (ADR-008); `priorTheft: true` → **red** (stolen-and-recovered with a clean title, c16); annual mileage amber ≥ 15k, red ≥ 25k (only under 90k total — ≥ 90k gets its own amber "High mileage"); Toyota hybrids keep 8-yr/100k hybrid + 10-yr/150k battery coverage — don't flag "out of warranty" off the 3/36 basic. The warranty amber fires when `warranty` is empty, or says expired/none/void without any active-coverage wording (the regex keys on: active, remaining, covered, in-warranty, hybrid battery/system/component, powertrain, "until 20xx"; CPO is exempt) — so write the live hybrid coverage into a hybrid's `warranty` text. Overall card signal: any red → red, any amber → amber, else green only when the clean-title/0-accident/CPO/records "good" flag fires.
- **TCO is vendored, not shared.** `app/src/lib/tco/` is a verbatim copy of car-tco-compare's pure engine + a `resolve.ts` adapter (ADR-009: no npm package / submodule / API — keeps the app static & offline). Re-sync by hand when the source changes (never hand-edit the verbatim files). Every figure is labelled **"Est."** (segment-typical placeholder rates, CA averages, cash basis). `tco5yr` is a manual override that wins over the estimate (`effectiveTco` in `app/src/lib/derive.ts` — the one source the sort, compare row, detail and export read); every seed car has it `null`. The adapter infers segment from make/model (default compact SUV), powertrain from `fuelType`, and treats only a 0-mile current/future model year as "new" (c18).
- The Google Sheet Web-App URL is the user's secret — stored as `settings.sheetUrl` inside the `garage.v1` localStorage blob, never bundled (verified by grepping the built JS). Never move it into a `VITE_*` var: Vite inlines those into the public bundle (ADR-007). Sync is a `mode: 'no-cors'` POST of `{ rows }` from `app/src/components/ExportModal.tsx`, so the response is opaque and the toast can only say "sent". The Apps Script recipe + the "access = Anyone" trap are in README + the `web-sheets-sync` skill.
- Repo is **public** by the user's choice (ADR-007 reversed the local-only ADR-003). Standing OK to push/deploy after validation.
- **Status is a user fact.** A car stays `Shortlist` until the owner states outright that he bought or ordered it; never infer Bought or on-order from availability news (c18 once shipped as Bought from "may arrive earlier" and stuck in every visitor's localStorage).
- **Dealer and CRM document links expire.** A DriveCentric-style spec sheet URL carries `Expires=` / `Signature=` and dies within hours; download the PDF into `app/public/docs/` and link the self-hosted copy (c18).
- Known gap: **`c10.jpg` is missing** (seed references it → placeholder shows; still missing 2026-10-15).
- Three untracked analysis files sit at the repo root (`cars-comparison.md/.tsv`, `rav4-shortlist-excl-2022.md`) — decide: commit, move to `docs/`, or delete.

## 4. Details
### How it works
Frozen `types.ts` → pure engine in `lib/*` (flags, derive, format, exportSheet, tco/) covered by
Vitest → thin React UI. `state/useGarage.ts` owns cars + settings + filters: `garage.v1` autosaves
cars + settings + removed ids (filters, compare set and view are session-only); a base64 JSON
`#hash` is read on load and wins over the save (no share button writes one). Compare view highlights
best/worst per row; TCO recomputes live from the Assumptions (horizon years + annual miles).
`status` "Sold" = off the market, hidden unless "Show sold". Vite `base: './'` lets the same bundle
serve under `/car-shopping/` and from a local path; there is no router.
```
app/src/
  types.ts            Car, Feat, Settings, Flag
  data/               cars.ts (seed, c1–c18) · features.ts (10 keys + FEATURE_IMPLIES) · sheetCols.ts (export column order; TCO column follows the horizon)
  lib/                flags · derive · format · exportSheet · tco/ (vendored engine + resolve adapter)
  state/useGarage.ts  cars + settings + filters; garage.v1 autosave + seed merge
  components/         Card · Grid · CompareTable · DetailModal · Filters · CarForm · Export/Settings modals
docs/                 PRD.md · spec-source.md · api-contract.md
```
Skeleton aliases for the engineering standard (`D:/Meaningful/AI/agent-skills/rules/engineering-principles.md`):
`lib/` = engine (pure; the lint forbids framework, I/O and upward imports there), `components/` = ui,
`state/` = the hooks that own storage and state (no adapters folder), `App.tsx` + `main.tsx` = the app shell.

### How to work on it
`cd app; npm install` (once) → `npm run dev` while working, then `npm run check` (lint, typecheck,
tests, build) before any push: it is the validation for every change; the machine's pre-push hook runs
it through the root `package.json` forwarder, and Actions runs it again before anything deploys (ADR-010). Validate in the running app, push to `main`, confirm the
Actions run is green and the live page's `<meta name="build-commit">` equals the pushed commit.
Standing workflow: user sends listing (+ Carfax) screenshots → I extract, append, crop/save the
photo, validate, push.

### Domain rules (RAV4 trims, as seen on this board's stickers — confirm per listing)
- A feature that is standard for the trim is absent from the sticker's "added options" list; still mark it ✓ (the c13 "no JBL" mistake, corrected by the user).
- **Limited:** JBL premium audio and heated + ventilated front seats standard; heated wheel usually (Weather Pkg) but c1's sticker lacked it → `null` + "confirm"; panoramic roof optional (c13 ✓, c1 has a regular power moonroof).
- **XSE:** panoramic roof comes with the Advanced Tech Pkg (not Limited-only — c14 correction); heated seats + wheel on every XSE seen; JBL is not standard — c14's 6-speaker sticker → ✕, c15–c17 ✓.
- **XLE Premium:** moonroof yes, 6-speaker audio (no JBL) — c9, c10, c18.
- **XLE:** moonroof, heated seats and heated wheel are options, not standard — leave `null` unless the sticker shows them; no JBL.
- **SE:** heated seats + heated wheel via the Cold Weather Package, power liftgate via the Convenience Package, keyless/push-start + immobilizer standard, standard audio (c2 notes).
- Flag text compares against a ~12k mi/yr average; `ownerType` "Rental/Fleet" covers Enterprise/Avis off-fleet cars, "Lease" a lease return — both read from the history report.

### Current state & open items
Deployed, stable, no active build. Open: `c10.jpg` missing; untracked root files (above); the
`review-findings.md` pre-ship review is a dated record (its "9 features" was true then; the app tracks 10
since the panoramic roof). Detail: [STATE.md](STATE.md).
Engineering-standard debt (audit 2026-10-21): the lint found none; three files over the 300-line reading
limit (`CarForm.tsx` 430, `useGarage.ts` 334, `DetailModal.tsx` 311) are split at their next touch
(retrofit step 4); the Node version is not pinned (CI runs 20, the machine 24; both pass).

### Change highlights
- 2026-10-21 — Command surface and CI gate (ADR-010): ESLint with the standard's boundary and size rules, `npm run lint` and `npm run check`, a `check` job the deploy's `build` job needs, and `check.yml` for other branches and pull requests. No behavior or UI change.
- 2026-10-16 — Build-commit stamp: the built page carries `<meta name="build-commit">` with the deployed commit (GitHub Actions' `GITHUB_SHA`; `local` for a local build), so a deploy is proven live by that id, not by a `?t=` query the Pages CDN ignores (app/index.html, app/vite.config.ts).
- 2026-10-06 — Renamed Garage to Car Shopping locally and on GitHub, updated related projects and portfolio links, and retained existing browser storage.
- 2026-06-25 — TCO ranking: vendored car-tco-compare engine, TCO sort/compare row/detail breakdown (ADR-009); c18 spec sheet self-hosted.
- 2026-06-23 → 24 — public GitHub Pages deploy (ADR-007); Sheets sync via Apps Script; accident=1 → red (ADR-008); id badges + id search; c1–c17 added across sessions.
- 2026-06-23 — full `/build` (lean crew) porting the 257 KB single-file prototype to Vite/React/TS; first commit.

## 5. Pointers
- [README.md](README.md) — product face incl. the Google Sheet one-time setup + troubleshooting, TCO explanation, the 10 features.
- [docs/PRD.md](docs/PRD.md) · [docs/spec-source.md](docs/spec-source.md) · [docs/api-contract.md](docs/api-contract.md).
- [DECISIONS.md](DECISIONS.md) — ADR-001…010 (ADR-002 seed-vs-Sheet, ADR-008 accident flag, ADR-009 vendoring, ADR-010 command surface and CI gate).
- [STATE.md](STATE.md) · [RUN_LOG.md](RUN_LOG.md) · [review-findings.md](review-findings.md).
- `app/src/lib/tco/README.md` — engine provenance + how to re-sync from car-tco-compare.
- Memory: `garage-app.md` was folded into this file on 2026-10-15 (nothing durable remains there). Skills: `ship-web-app`, `web-sheets-sync`, `web-ship-check`.
