# Car Shopping Car Shopping — Handoff Spec (source of truth for the port)

> Verbatim copy of the user's handoff spec (originally a Google Doc) plus the user's added
> instructions. Agents: read this first. The original single-file prototype is at
> `D:/Downloads/garage.html` (visual + behavioral source of truth — port it, don't reinvent).

## 0. User's added instructions (2026-06-22)
- Buying a car by **end of June 2026**; actively shopping now. The tool must be usable immediately.
- **Run locally only** (no deploy/hosting). Export to Google Sheets to compare that way.
- For each new car the user pastes a **screenshot** (listing and/or history). Claude extracts fields and
  updates the data. Screenshots come from **different sources/vendors**, so wording varies — map onto the
  canonical fields/features; learn from examples.
- Capture (when present): **photo**, year, model, fuel type, trim (e.g. Limited), and these **9 features only**:
  sun/moon roof, heated seats, heated wheel, power seat, JBL audio, keyless entry, bluetooth,
  power liftgate (rear cargo access), immobilizer. Plus: clean title, accident/damage, **# of service/repair
  records**, sales price, mileage, dealership, location, owner type, and a **clickable source URL**.
- Easy side-by-side **compare**.

## 1. What this is
A personal **used-car shopping dashboard**. The owner compares a small number of used cars (currently RAV4
Hybrids) over a short buying window. Cars are entered by pasting listing/history screenshots; each car is
stored with price, fees, mileage, history, a fixed checklist of tracked features, two ratings, and notes.
Cards → compare side-by-side with automatic best/worst highlighting → auto risk/value flags → export to Sheets.
Guiding lens: **total cost of ownership**, not sticker price.

**Design intent:** a "decision instrument," not a glossy marketing page. Dark graphite header over a light
data canvas; one indigo accent for chrome; green/amber/red reserved strictly for risk/value signals.

## 2. What to port (lift verbatim from garage.html)
- `const CARS = [...]` — seed data (2 real cars, embedded base64 photos). Move to a data file; externalize images.
- `const FEATURES = [...]` — canonical tracked-feature list (§4).
- `const SHEET_COLS = [...]` — export/spreadsheet column order (§5.7).
- `getFlags(c)` + `signalLevel(c)` — the risk/value engine (§5.5). Port to a **pure** module.
- The compare-row definitions and `cellClass`/`colorByValue`/`dir` best-worst logic (§5.2).
- The CSS `:root` token block and font setup (§6).

## 3. Architecture (ship-web-app: Vite + React + TS)
Highest-value rule: **all domain logic is pure functions in `src/lib/*`, unit-tested, no DOM access**; the UI
only formats and renders.

```
app/
  index.html
  src/
    main.tsx · App.tsx
    types.ts                ← Car, Feat, Settings, Flag types (§4)
    data/cars.ts            ← seed CARS (ported) — source of truth
    data/features.ts        ← FEATURES list (§4)
    data/sheetCols.ts       ← SHEET_COLS (§5.7)
    lib/flags.ts            ← getFlags()/signalLevel() — PURE (§5.5)
    lib/derive.ts           ← otd(), totalFees(), milesPerYr(), tcoPerYear(), tcoPerMile()
    lib/format.ts           ← money(), miles(), star helpers
    lib/exportSheet.ts      ← toCSV()/toTSV()/toJSON() + sheetMatrix() from SHEET_COLS
    lib/*.test.ts           ← unit tests: cover every flag rule + derived math + edge cases
    state/useGarage.ts      ← cars + settings + filters; localStorage autosave; hash hydrate-merge
    components/*.tsx        ← Card, Grid, CompareTable, DetailModal, Filters, ExportModal, SettingsModal, CarForm
    styles.css              ← ported tokens + light/dark theme
```

## 4. Data model (authoritative)

### Car
| field | type | notes |
|---|---|---|
| id | string | stable, e.g. `c1` |
| status | enum | New · Shortlist · Contacted · Test driven · Negotiating · Rejected · Bought |
| year | number | |
| make / model / trim | string | display name = `${year} ${make} ${model}` |
| price | number | asking price |
| mileage | number | |
| sellerType | enum | Dealer · CPO · Private |
| dealership / location | string | |
| ownerCount | number\|null | |
| accidents | number\|null | 0 = none; null = unknown |
| titleStatus | enum | Clean · Rebuilt · Salvage · Flood · Lemon · Unknown |
| drivetrain | enum | FWD · RWD · AWD · 4WD |
| fuelType | enum | Gas · Hybrid · Plug-in Hybrid · EV · Diesel |
| engine | string | |
| extColor / intColor | string | |
| vin | string | empty → triggers a flag |
| warranty | string | free text |
| feat | Feat | tracked-feature object (below) |
| features | string[] | "other notable" free-text features |
| serviceRecords | bool\|null | |
| serviceCount | number\|null | # of records (preferred over the bool when known) |
| daysOnMarket | number\|null | |
| dateSeen | string | ISO date |
| marketAvg | number\|null | reference market price (drives over/under-market flags) |
| transferFee | number\|null | shown separately from price |
| feesEstimate | number\|null | doc/other dealer fees |
| tco5yr | number\|null | 5-yr total cost of ownership, if computed |
| expertRating | 0–5 | Claude's rating |
| rating | 0–5 | owner's own rating |
| notes | string | supports `\n` line breaks |
| image | string | image path **or** data: URI (prefer files) |
| sourceUrl | string | clickable listing link |

### Feat — value is `true` (has) / `false` (confirmed absent) / `null` (unknown)
Canonical `FEATURES = [key, shortLabel, longLabel]`, in order:
```
moonroof      "Moonroof"      "Sunroof / moonroof"
heatedSeats   "Htd seats"     "Heated seats"
heatedWheel   "Htd wheel"     "Heated steering wheel"
powerSeats    "Pwr seats"     "Power seats"
premiumAudio  "JBL audio"     "JBL / premium audio"
keyless       "Keyless"       "Keyless entry + push start"
bluetooth     "Bluetooth"     "Bluetooth"
powerLiftgate "Pwr liftgate"  "Power liftgate"
immobilizer   "Immobilizer"   "Immobilizer"
```
Tri-state (yes/no/unknown) is load-bearing — "unknown" must stay visually distinct (amber `?`), never silently
rendered as "no."

### Settings
`{ miles: number (annual, default 12000), years: number (ownership horizon, default 5) }` — converts `tco5yr`
into TCO/year and TCO/mile.

### Derived values (pure)
- `totalFees = (transferFee||0) + (feesEstimate||0)`
- `otd` (out-the-door) `= price + totalFees` *(before tax/registration — always footnote this)*
- `milesPerYr = round(mileage / max(1, currentYear - year))`
- `tcoPerYear = tco5yr / years` · `tcoPerMile = tco5yr / (miles * years)`

## 5. Behavior spec

### 5.1 Grid (cards)
Photo (or placeholder), status tag, compare checkbox, name+trim, **price with `+ $X transfer` and
`≈ $Y out-the-door*` subline**, spec chips (mileage · drivetrain · fuel · engine), title/accident/seller
badges, dealer·location, the **key-feature pill row** (N/9 score + a colored pill per feature: green ✓ /
muted ✕ / amber ?), up to 3 risk/value flags, the **dual rating** (Expert + You) + listing link. A colored
top border encodes overall signal level.

### 5.2 Compare view (core feature)
Tick ≥2 cars → a transposed table (attributes as rows, cars as columns). Each numeric row auto-highlights
**best (green) and worst (red)**:
- `dir:'min'` → lowest is best: price, mileage, transfer fee, doc fees, **out-the-door**, 5-yr TCO, TCO/year,
  TCO/mile, est. fees.
- `dir:'max'` → highest is best: year, key-feature count, expert rating, your rating, days-on-market (label "leverage").
- `colorByValue` → accidents: 0 green, ≥1 red.
- `cellClass` → per-feature rows: green when the car **has** the feature; neutral otherwise (don't paint
  "missing minor feature" red). Rows include every field plus one row per tracked feature, "other notable,"
  flags, notes, and the listing link. Ties → no highlight.

### 5.3 Detail modal
All fields grouped: Price & value (miles/yr + fee breakdown), Ratings (both), History & title, Specs,
**Key features checklist** (all 9 with ✓/✕/? + long labels), risk/value flags, free-text notes (preserve line
breaks), actions (open listing / edit / compare / delete).

### 5.4 Filters & sort
- **Search** across name/trim/dealer/location/features.
- **Chips:** seller type (All/Dealer/CPO/Private), clean-title-only, no-accidents, hide-rejected.
- **Filter panel** (collapsible, active-count badge): max price, max mileage, min expert ★, min your ★, and
  **"must have" toggles** for any of the 9 features (require feature = yes). "Clear all filters" resets.
- **Sort:** recently added, price ↑/↓, out-the-door ↑, mileage ↑, year ↓, key-features ↓, 5-yr TCO ↑,
  expert ★ ↓, your ★ ↓, days-listed ↓.

### 5.5 Risk / value flag engine (port verbatim, make pure)
Levels: risk (red) · warn (amber) · info (blue) · good (green). Rules:
- Branded title (Rebuilt/Salvage/Flood/Lemon) → **risk**.
- Title Unknown/missing → warn.
- accidents ≥2 → risk; ==1 → warn; null → warn.
- No VIN → warn.
- mileage ≥90,000 → warn.
- milesPerYr ≥15,000 **and** mileage <90,000 → info.
- ownerCount ≥3 → warn.
- serviceRecords === false → warn.
- marketAvg set and price > marketAvg×1.04 → warn (over market).
- marketAvg set and price < marketAvg×0.85 and not branded → info (well below market — verify why).
- (warranty matches /none|void|expired/ **or** no warranty) and sellerType ≠ CPO → warn.
- daysOnMarket ≥60 and not branded → info (stale = leverage).
- sellerType === Private → info.
- Clean + 0 accidents + CPO + has service records → **good**.

`signalLevel`: risk if any risk → else warn if ≥2 warn → else warn if any warn → else good if any good → else none.
(NOTE: prototype counts warns: `if(warn>=2) return 'warn'; if(any warn) return 'warn'`. Port that behavior exactly.)

### 5.6 Ratings
Two independent 0–5 ratings per car: **Expert** (Claude's) and **You** (owner's). Both display everywhere and
are independently sortable/filterable.

### 5.7 Export
Build CSV/TSV from `SHEET_COLS` (port the column list from garage.html; includes every field, all 9 features as
Yes/No/?, derived out-the-door + miles/yr). Provide **Copy-for-Sheets (TSV → paste into A1)**, **Download CSV**,
and **Copy-JSON**. Titles on row 1, one car per row.

## 6. Design system (preserve)
Port the `:root` tokens. Key values:
- Accent `#4f6bed` (hover `#3a55d6`, soft `#e9edff`). Ink `#15171c` / `#4a4f5a` / `#868d99`. Lines `#e4e7ec` / `#d3d8e0`.
- Signals: good `#1f9d57`, warn `#b7791f`, risk `#d4493f`, info `#3a7bd0` (+ matching `-soft` backgrounds).
- Header graphite `#181b22`. Radius 16/10. Fonts: **Archivo** (display/numbers, tabular) + **Inter** (body),
  Google Fonts with system fallbacks.
- Add a real light/dark theme via `:root[data-theme="dark"]` + no-flash head script (prototype is light-only).

## 7. Screenshot-ingestion workflow
Owner pastes a listing screenshot (+ optionally Carfax/AutoCheck + URL). Claude extracts fields, maps free-text
options onto the 9 tracked features (e.g. "Cold Weather Package" ⇒ heated seats + heated wheel — mark inferred,
note "confirm"), crops the car photo, appends a Car to data/cars.ts. Keep tri-state honesty: `true` only if
listed/reliably included; `false` if clearly excluded; otherwise `null`.

## 8. Improvements in this build
1. **Persistence** — served from a stable origin, localStorage persists; in-app edits survive reloads. State
   hook: autosave + URL-hash share + hydrate-merge onto current defaults so old saves gain new fields.
2. **Google Sheets** — see ADR-005. In-app zero-auth CSV/TSV/JSON; real Sheet maintained via Drive MCP.
3. **Images as files** — `public/img/<id>.jpg`, base64 fallback only.
4. **Tests** — Vitest locks §5.5 rules + derived math.
5. (SEO N/A — private local tool.)

## 9. Seed data (already in garage.html — port from CARS)
- **c1** — 2023 Toyota RAV4 Limited Hybrid AWD, $35,999, 48,280 mi, VIN 4T3D6RFV8PU137118, Enterprise Car Sales
  Victorville. Clean / 0 accidents / 1 owner / 3 service records. JBL, ventilated seats, power everything;
  **heated wheel unconfirmed**. Expert 4/5.
- **c2** — 2022 Toyota RAV4 SE Hybrid AWD, $32,965 (incl. dealer fees), 58,927 mi, VIN 4T3T6RFV6NU105129,
  Manly Auto (Santa Rosa). Clean / 0 accidents / 1 owner; market ≈ $32,815 ("Fair Deal"). Heated seats + wheel
  via Cold Weather Pkg; **no JBL**, power seat unconfirmed. Expert 4/5.

## 10. Build order
1. Scaffold (Vite + React + TS). Port tokens + fonts → styles.css; add dark theme.
2. types.ts, data/cars.ts, data/features.ts, data/sheetCols.ts (lift from prototype).
3. lib/flags.ts + lib/derive.ts + lib/format.ts + **tests**. Suite green.
4. Components: Card → Grid → Filters/Sort → Compare → Detail → Export/Settings/Form modals.
5. state/useGarage.ts (localStorage + hash). Sheets export wired.
6. Validate (test → type-check build → run & DOM-inspect → console clean). Run locally.
