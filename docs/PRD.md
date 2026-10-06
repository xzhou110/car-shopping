# PRD — Car Shopping (local used-car shortlist & compare)

**Author:** orchestrator/PM · **Date:** 2026-06-22 · **Status:** approved to build

## Problem
The owner is actively shopping for a used car and must decide **by end of June 2026**. Listings live across
many sites with inconsistent wording. They need one private place to capture each candidate from a screenshot,
see risk/value signals, compare side-by-side on total cost of ownership, and export to Google Sheets.

## User & job
Single user (the owner). Job: "Given screenshots of used-car listings, capture the few that matter, compare
them honestly on out-the-door cost + condition + features, and pick one this week." Claude does the screenshot
→ data extraction; the app does the storing, signalling, comparing, and exporting.

## In scope
- Port the prototype (`garage.html`) to Vite + React + TS with a **pure, unit-tested** logic engine.
- Card grid, risk/value flags, compare table (best/worst highlighting), detail modal, filters/sort, dual ratings.
- **Add/Edit car form** so the owner can tweak without Claude; **delete**.
- localStorage persistence (autosave) + URL-hash share + hydrate-merge.
- Light/dark theme with no-flash init.
- Export: Download CSV + Copy-for-Sheets (TSV) + Copy-JSON (titles row 1, one car per row).
- Seed images externalized to `public/img/`.

## Out of scope (non-goals)
- No hosting/deploy (local only). No backend/server. No in-browser OCR (Claude extracts from screenshots).
- No live Google-Sheets-as-source loading. No multi-user/auth. No real-money/quota calls from the app.

## Acceptance criteria (checkable — QA tests against these; PM signs off against these)
**Build & health**
1. `npm install` clean; `npm run build` (tsc + vite) succeeds with **zero TypeScript errors**.
2. `npm run test` (Vitest) passes; lib has **0 DOM access** (pure).
3. Dev server runs; **console has zero errors**; no horizontal overflow at 360px and 1280px.

**Logic engine (unit-tested)**
4. `getFlags`/`signalLevel` reproduce **every §5.5 rule** incl. edge cases (branded title, accidents 0/1/2/null,
   no VIN, mileage ≥90k, milesPerYr ≥15k & <90k, owners ≥3, no service records, over/under market, warranty
   none/void & not CPO, stale ≥60d, private, the CPO "good" case). Tie/`null` handling matches the prototype.
5. Derived math correct: `totalFees`, `otd`, `milesPerYr` (round, min-1-year guard), `tcoPerYear`, `tcoPerMile`.
6. Tri-state feature state never collapses `unknown`→`no`; `featCount` counts only `yes`.

**UI behavior**
7. Grid renders both seed cars with photo, OTD subline, key-feature pills (✓/✕/?), flags, dual ratings, top
   border by signal level.
8. Selecting ≥2 cars shows the transposed compare table with correct best(green)/worst(red) per `dir`/`colorByValue`;
   ties = no highlight; feature rows green only when `yes`.
9. Detail modal shows all groups incl. the 9-feature checklist with long labels and notes line-breaks preserved.
10. Filters (search, chips, panel incl. must-have feature toggles, clear-all) and all sorts behave per §5.4.
11. Add/Edit form creates/updates a car (all model fields incl. tri-state features + image); delete removes it;
    changes persist across reload (localStorage).
12. Theme toggle switches light/dark with no flash on reload.

**Export**
13. Export produces a matrix whose **first row is the column titles** (`SHEET_COLS` order) and **one row per car**,
    with all 9 features as Yes/No/? and derived OTD + miles/yr. CSV downloads; TSV copies; JSON copies.
14. A real Google Sheet can be created from this export (verified by PM via the connected Drive MCP on request).

## Success metric
The owner can add a car from a screenshot in one paste, compare candidates side-by-side, and export to a Google
Sheet — and actually use it to choose a car before end of June 2026.
