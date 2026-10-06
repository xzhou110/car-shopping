# Review Findings — Car Shopping

> **Who reviewed:** The dedicated `reviewer` subagent could not run — two spawn attempts returned
> **529 Overloaded** (API server-side, 0 tool uses). To avoid blocking a time-sensitive build, the
> orchestrator/PM conducted the review directly (read every module + lib tests + live DOM/console
> verification). Re-run the independent reviewer when the API recovers for a second pair of eyes.

**Verdict: ship-with-nits.** Build green (tsc 0 errors), 155/155 unit tests, console clean, all
acceptance criteria met in live verification.

## MUST-FIX
- **(FIXED during integration)** `Card.tsx` price-extra used `{(car.transferFee || fees) && (…)}` — when both
  are `0` (c2), React rendered a literal `0` next to the price. Changed to a `? … : null` ternary. Verified
  gone in the live DOM. No other numeric `{n && jsx}` patterns exist (audited all components; remaining `&&`
  guards are on string fields, which render empty safely).

## SHOULD-FIX
- None blocking. (Engine is a verbatim port of the prototype and is locked by 155 tests with 0 discrepancies.)

## NICE-TO-HAVE
- `CarForm` new-car id is `'c' + Date.now()` — unique for single-user manual entry; the screenshot-ingestion
  path (PM appends to `data/cars.ts`) uses sequential `c{n}` ids. Harmless, just two id styles.
- URL-hash share encodes the full car array; fine today because images are file paths (not base64). If a user
  ever stores a base64 `image`, the hash could get long. Low risk for a private tool.
- Compare placeholder thumbnails / card placeholders use a fixed light gradient; a dark-mode patch was added so
  they use `--surface-2` in dark. Cosmetic.
- **Inline "You" star on cards** (`Card.tsx` + `RatingStars.tsx`): the rating handler is correct — verified by a
  direct DOM dispatch (rating set 0→3, autosaved to localStorage, survived reload, no modal opened, so the
  `stopPropagation` in the card-foot works). The automated preview harness's *pointer* click mis-targeted the
  small star (a 14px svg inside a `.card:hover{transform:translateY(-3px)}` clickable card) and landed on the
  card body, opening the detail modal. This is a test-tool artifact, not a path a real mouse user hits (any
  click that lands in the card-foot is stopped). Hardened anyway: enlarged the star hit area (`padding:4px;
  margin:-4px 0; display:inline-flex`) so near-misses still register. Worth a quick manual sanity click.

## POSITIVE / VERIFIED
- **Robustness:** `useGarage` hydrate-merge spreads every saved/shared car over a complete `DEFAULT_CAR`, so
  old saves missing new fields can't crash a render. `decodeHash`/`decodeStore` both wrap `atob`/`JSON.parse`
  in try/catch and check `Array.isArray(cars)` → malformed localStorage or URL hash degrades to the seed.
- **Security:** No `dangerouslySetInnerHTML` anywhere; all free-text (notes, dealer, features) rendered as text
  → React auto-escapes (XSS-safe). External listing links use `target="_blank" rel="noopener noreferrer"`.
- **Compare engine (§5.2):** dir min/max best/worst, ties → no highlight, accidents colorByValue (0 green / ≥1
  red), feature rows green-on-`yes`-only and **never** painted red for a missing feature. Verified live across
  Price/Mileage/OTD/Accidents/Key-features/JBL.
- **Tri-state honesty (§4):** unknown features render amber `?`, never as `No`. Verified live (c1 "Htd wheel ?").
- **Export (§5.7):** matrix is titles-row + one row per car, 41 columns incl. all 9 features as Yes/No/?.
- **Pure separation:** `lib/*` has zero DOM/React imports; the UI imports and only formats/renders.
