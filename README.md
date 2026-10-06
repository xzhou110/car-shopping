# Car Shopping — Used-Car Shortlist & Compare

A single-user dashboard for shopping used cars: capture each candidate from a screenshot, see auto
risk/value flags, compare side-by-side on **out-the-door / total cost of ownership**, and export to
Google Sheets.

Formerly **Garage**. Renamed to **Car Shopping** on October 6, 2026 so its purpose is clear from the name. Existing browser saves continue to work in the same browser and profile.

**Live:** https://xzhou110.github.io/car-shopping/ — deployed from `main` via GitHub Actions (`.github/workflows/deploy.yml`).
The Google Sheet sync URL is **never** in the code/bundle (it lives only in your browser's localStorage), so
it is not exposed by the public site. Note: localStorage is per-domain, so set your Sheet URL once on the live
site too (Assumptions), separate from localhost. Runs locally as well (below).

## Run it

```bash
cd app
npm install        # first time only (already done)
npm run dev        # → http://localhost:5178
```

Other commands (from `app/`):
- `npm run build` — type-check + production bundle into `app/dist/`
- `npm run preview` — serve the built bundle
- `npm test` — run the engine unit tests (211 tests)

> Data persists in your browser's localStorage (in-app edits: ratings, status, new cars). The committed
> seed lives in `app/src/data/cars.ts` and is the source of truth I edit when you send screenshots.

## How you'll use it

1. **Add a car** — paste me a listing screenshot (and a Carfax/AutoCheck shot + the URL if you have them).
   I extract year/trim/price/mileage/title/accidents/features/etc., map vendor wording onto the 9 tracked
   features (marking anything *inferred from a package* as "confirm"), crop the photo, and append the car to
   `src/data/cars.ts`. You can also click **+ Add car** to enter one by hand, and **Edit** any card.
2. **Triage** — each card shows price + transfer + ≈ out-the-door + **estimated N-yr cost to own** (TCO over your
   horizon), the 9-feature pill row (✓ / ✕ / **? = unknown**),
   and auto risk/value flags. A colored top border flags overall risk (red) / caution (amber) / good (green). A
   small car-id badge (e.g. `c2`) on each photo maps the card to the data file / chat references — and the search
   box matches the id, so typing `c4` jumps straight to that car.
3. **Compare** — tick ≥2 cars → the Compare tab shows a side-by-side table that auto-highlights the **best
   (green) / worst (red)** value in each row (cheapest price, lowest out-the-door, most features, etc.).
4. **Filter / sort** — search, seller/title/accident chips, a filter panel (max price/mileage, min ratings,
   "must-have" features), and sorts (out-the-door, mileage, **total cost (TCO)**, ratings, …).
   - **Rank by total cost of ownership** — pick **Sort → Total cost (TCO): Low → High** to order the board by
     estimated lifetime cost over your ownership horizon (see below), not just sticker price.
5. **Set & change your rating** — click the **You ★** stars on a card (or in the detail view) to rate; it saves
   instantly, persists across reloads, and you can change it any time. **Expert ★** is my rating.
6. **Mark as sold** — when a car is gone (sold to someone else / off the market), open it and click **Mark as
   sold**; it drops out of the list. Toggle the **Show sold** chip to bring sold cars back.
7. **Export to Google Sheets** — the **Export** button:
   - **Sync to Google Sheet** — pushes every car straight into your sheet (title row + one row per car, updated
     in place), no copy-paste. Needs the one-time setup below.
   - **Copy for Sheets** / **Download CSV** — zero-setup fallbacks (paste into A1 / open the CSV).
   - **JSON for Claude** — paste back to me in chat so I can save your in-app edits into the data file.

## Sync to Google Sheet — one-time setup (~5 min, free, no Google Cloud)
A browser app can't write to your Drive without auth, so set this up once:
1. Create a blank sheet at **https://sheets.new** — this is the sheet that gets updated.
2. In it: **Extensions → Apps Script**. Delete the placeholder and paste:
   ```js
   function doPost(e) {
     var rows = JSON.parse(e.postData.contents).rows || [];
     var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
     sh.clear(); // reset content + old formatting each sync
     if (rows.length) {
       var nCols = rows[0].length;
       sh.getRange(1, 1, rows.length, nCols).setValues(rows);
       sh.getRange(1, 1, 1, nCols).setFontWeight('bold'); // bold title row
       sh.setFrozenRows(1);                               // keep titles visible
       sh.autoResizeColumns(1, nCols);                    // width fits the longest text
     }
     return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. **Deploy → New deployment → Web app**. Execute as **Me**; **Who has access: Anyone**. Click **Authorize
   access** and allow the permissions. *(Your URL is secret — only you have it — so "Anyone" just means the
   request doesn't need a Google login; the script still runs as **you** and writes only **your** sheet. With
   "Only myself" a browser POST is blocked and nothing is written.)*
4. Copy the **Web app URL** (ends in `/exec`, not `/dev`).
5. In Car Shopping: **Assumptions** → paste it into **Google Sheet sync URL** → **Apply**.
6. Open the **Export** dialog → click **Sync to Google Sheet**, then open your sheet — title row + one row per
   car; re-syncing overwrites in place. (Google's CORS hides the response, so the button just says "sent" —
   glance at the sheet to confirm.)

**Troubleshooting — "Sync ran but the sheet is empty":** 99% of the time the deployment access is still
"Only myself." Fix: **Deploy → Manage deployments → ✏️ (edit) → Who has access → Anyone → Deploy**. The `/exec`
URL stays the same, so you don't need to re-paste it. Also confirm: you used the `/exec` URL (not `/dev`), you
clicked **Apply** after pasting it in Assumptions, and you clicked **Sync to Google Sheet** *inside* the Export
dialog (the header **Export** button only opens the dialog).

**Changed the script code?** (e.g. to add the bold-title/auto-fit formatting above.) Push it live the same way:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** — the `/exec` URL stays the same.

## Total cost of ownership (TCO)
Sticker price is a poor way to rank near-identical cars — a cheaper car that depreciates faster or burns more
fuel can cost *more* to own. Car Shopping estimates each car's **5-component lifetime cost** (depreciation + fuel +
insurance + maintenance/repairs + taxes & registration) over **your** ownership horizon and uses it to rank the board.

- **Choose how long you'll keep it.** Open **Assumptions** and set **Ownership horizon (years)** + **Annual miles**.
  Everything recomputes live — the **"Est. N-yr cost to own"** line on every card, the TCO sort, the **Est. TCO**
  row in Compare, and the per-car breakdown in the detail view. A longer horizon spreads the big up-front
  depreciation hit, so the *best buy can change* with how long you hold the car (pick 5 → get a 5-yr cost; pick 8 → an 8-yr cost).
- **It's an estimate, by design.** Cost rates (depreciation curve, insurance, upkeep) come from segment-typical
  reference tables (RAV4-anchored depreciation curve), priced on a **cash basis** with **California** averages for
  fuel/tax/registration/insurance. Differences between cars come from **price, age and mileage** — which is exactly
  what makes the *ranking* trustworthy even though every absolute figure is an estimate. Cars are labelled **"Est."**.
- **Override when you have better data.** Enter a number in a car's **TCO override** field (e.g. from an Edmunds True
  Cost to Own or AAA lookup) and that replaces the estimate for that car everywhere.

The engine is a **vendored copy** of the pure calculator from the sibling project
[`car-tco-compare`](https://github.com/xzhou110/car-tco-compare), kept dependency-free so Car Shopping stays a static,
offline-capable app. See `app/src/lib/tco/README.md` for provenance/re-sync and **DECISIONS.md → ADR-009** for why.

## The 10 tracked features
Sunroof/moonroof · **panoramic roof** · heated seats · heated steering wheel · power seats · JBL/premium audio ·
keyless entry + push start · Bluetooth · power liftgate · immobilizer. Tri-state: ✓ has · ✕ confirmed absent ·
**? unknown** (never silently treated as "no").

> **Panoramic roof ⟹ sunroof (one-way).** A panoramic roof *is* a (bigger, fixed-glass) sunroof, so a car
> marked as having a panoramic roof automatically counts as having the sunroof/moonroof too. The reverse does
> **not** hold — a plain sunroof gives no panoramic credit. The implication is derived in the engine
> (`featState`), so it holds everywhere: pills, detail, compare, export, and the "must-have" filter.

## Project layout
```
app/src/
  types.ts            data model (Car, Feat, Settings, Flag)
  data/               cars.ts (seed = source of truth) · features.ts · sheetCols.ts
  lib/                flags.ts · derive.ts · format.ts · exportSheet.ts  (PURE, unit-tested)
  lib/tco/            vendored TCO engine (engine.ts · depreciation.ts · reference.ts) + resolve.ts adapter
  state/useGarage.ts  cars + settings + filters; localStorage autosave + URL-hash share
  components/         Card · Grid · CompareTable · DetailModal · Filters · CarForm · Export/Settings modals
docs/                 PRD.md · spec-source.md · api-contract.md
```
Design rule: all domain logic is pure functions in `lib/*` (no DOM) and is covered by Vitest; the UI only
formats and renders. See `docs/` for the full spec and `review-findings.md` for the pre-ship review.
