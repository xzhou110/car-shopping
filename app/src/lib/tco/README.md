# `lib/tco` — vendored Total-Cost-of-Ownership engine

This folder is a **vendored copy** of the pure TCO calculator from the sibling project
[`car-tco-compare`](https://github.com/xzhou110/car-tco-compare) (`app/src/lib/` + `app/src/data/reference.ts`),
plus a thin car-shopping-specific adapter. It lets Car Shopping estimate and **rank cars by total cost of
ownership** over the user's chosen ownership horizon — without adding a runtime dependency or a backend.

## Why vendored (not an npm package / submodule)
The engine is small, pure, dependency-free, and already unit-tested. Car Shopping is a self-contained
static SPA on GitHub Pages (no backend, works offline), so copying the pure files keeps that property
and stays fully reversible. The cost is duplication across two repos; we accept it because the engine
is stable pure math. See **DECISIONS.md → ADR-009**. Promote to a shared package only if a 3rd app needs it.

## Files
| File | Origin | Notes |
|---|---|---|
| `depreciation.ts` | verbatim from car-tco-compare | RAV4-anchored value-retention curve |
| `engine.ts` | verbatim from car-tco-compare (`tco.ts`) | `computeTco` — the 7-category model |
| `reference.ts` | verbatim from car-tco-compare (`data/reference.ts`) | segment cost tables (illustrative placeholders) |
| `types.ts` | adapted | engine-internal types (private to this module) |
| `resolve.ts` | **car-shopping-specific** | `Car → Vehicle` adapter + `estimateTco()` |
| `index.ts` | car-shopping-specific | public barrel — import from `'../lib/tco'` |

## Re-syncing the engine
If the engine improves upstream, re-copy `depreciation.ts`, `engine.ts`, and `reference.ts` from
`car-tco-compare/app/src/...` (keep the vendor header comments), then run `npm test`. Do **not** hand-edit
the verbatim files — keep them faithful so a future diff against upstream is clean. `resolve.ts` is ours.

## The numbers are estimates
The cost rates in `reference.ts` are explicitly illustrative placeholders. The UI labels TCO as an
**Est.** and shows the assumptions (cash basis, CA regional averages). The value is in the *ranking*:
shared assumptions cancel, so per-car differences are driven by price, age and mileage.
