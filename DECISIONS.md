# DECISIONS (ADR log)

Each entry: decision · context · alternatives · rationale · reversible?

---

## ADR-001 — Tier = FULL BUILD, but lean crew (skip research/design/tech-lead)
- **Decision:** Run the full-build pipeline but skip researcher, designer, tech-lead, and backend.
- **Context:** The handoff spec (Google Doc) already IS the research + design + tech plan: data model, design tokens, flag engine, file layout. A complete working prototype exists. Re-deriving would burn tokens for zero value.
- **Alternatives:** (a) full pipeline incl. research/design — rejected (redundant). (b) do it all inline myself — rejected (lib/* tests + UI are genuinely parallelizable; specialization helps).
- **Rationale:** Reconcile-don't-append; bias toward fewer agents. Crew = data-engineer + frontend-engineer (parallel) → qa-tester → reviewer. PM (me) authors PRD, scaffolds foundation, integrates, runs acceptance gate.
- **Reversible?** Yes — can add a designer pass if UX needs polish beyond the port.

## ADR-002 — Source of truth = committed data file; Google Sheets = export/mirror (NOT live source)
- **Decision:** App loads from a committed `src/data/cars.ts`; in-app edits persist to localStorage (hydrate-merged); Google Sheets is a one-way export (+ optional re-import), not the runtime data source.
- **Context:** User asked whether to load the app FROM a Google Sheet. Data model is rich/nested (tri-state `feat`, `features[]`, images, derived values).
- **Alternatives:** (a) Sheet-as-live-source — rejected: flat/lossy, needs runtime OAuth (can't keep service-account secret client-side) or a published (public) sheet, CORS/quota, slower, breaks offline, one bad cell breaks the app; solves multi-editor sync the user doesn't need. (b) localStorage-only — rejected: not portable, no git history.
- **Rationale:** The real "add a car" path is Claude editing the data file from screenshots → the file is naturally authoritative. Spreadsheets are good at viewing/sharing, so use them for export.
- **Reversible?** Yes — a Sheets-source loader could be added later if the workflow changes.

## ADR-003 — Local-only; no deploy. Push allowed (with approval).
- **Decision:** Ship a locally-run app (`npm run dev` / `npm run build` + preview). No GitHub Pages / hosting. Git push to a remote is allowed only with explicit user approval (backup), never auto.
- **Context:** User: "no need to deploy... I just want it to run on local to assist my car shopping, and export to Google Sheet."
- **Alternatives:** GH Pages private deploy (spec's optional step) — dropped per user.
- **Rationale:** Matches the actual job (private, single-user, this-week buying decision). Removes the deploy human-gate; replaces it with run-locally verification.
- **Reversible?** Yes — a static `dist/` can be deployed anytime later.

## ADR-004 — Externalize seed images to files (decode base64 → public/img), keep base64 only as fallback
- **Decision:** Extract the two seed cars' embedded base64 photos into `public/img/<id>.jpg` and reference by path; done via a Node script so the base64 never enters the LLM context.
- **Context:** Prototype embeds ~80–110KB base64/car inline. Spec §8.3 prefers files.
- **Alternatives:** keep base64 in cars.ts — rejected (bundle bloat; spec advises against).
- **Rationale:** Smaller data file, faithful port, cheaper context.
- **Reversible?** Yes — base64 data-URIs still supported in the `image` field as a fallback.

## ADR-005 — Google Sheets export: in-app zero-auth (CSV/TSV/JSON) + Claude-maintained real Sheet via connected Drive MCP
- **Decision:** In-app export = Download CSV + Copy-for-Sheets (TSV) + Copy-JSON (titles on row 1, one car per row). A real Google Sheet is created/refreshed on request via the Drive MCP connected to this session. Optional future: a Google Apps Script web-app endpoint for in-app in-place updates.
- **Context:** User wants an export button that creates/updates a Google Sheet for side-by-side comparison.
- **Alternatives:** in-browser Google Sheets OAuth — rejected (heavy, secret-in-client problem for a private tool).
- **Rationale:** Zero-auth instant export covers the daily need; Drive MCP covers "a real Sheet, updated in place" without app plumbing.
- **Reversible?** Yes.

## ADR-007 — Reversed ADR-003: deploy to PUBLIC GitHub Pages
- **Decision:** Deploy via GitHub Actions to GitHub Pages from a **public** repo at `xzhou110.github.io/car-shopping`. Supersedes ADR-003 (local-only).
- **Context:** User now wants to view the app on the web from any device. Offered public Pages vs private login-gated (Cloudflare); user chose public Pages (simplest, matches their stack).
- **Disclosure handling:** The Google Sheet sync URL is localStorage-only and was **verified absent** from the built bundle (only the input placeholder `…/exec` appears; no real `macros/s/<id>` / `AKfyc`). The car data in `cars.ts` IS bundled and public by design (user consented). **Do NOT** move the sheet URL into a `VITE_*` env var — Vite inlines those into the public JS, which would expose it. There are no real secrets in a client-only bundle.
- **Mechanics:** `actions/configure-pages` `enablement:true` failed (the workflow `GITHUB_TOKEN` can't create a Pages site); enabled Pages out-of-band via `gh api POST /repos/.../pages -f build_type=workflow`, then dropped the flag. `base: './'` in vite config makes assets resolve under the `/car-shopping/` subpath; hash routing avoids refresh 404s.
- **Reversible?** Repo can be set private again (Pages then needs a paid plan); content seen while public may be cached/indexed.

## ADR-006 — PM implemented the engine + finished the frontend lane directly (not via re-spawn)
- **Decision:** (a) PM ported the pure engine (flags/derive/format/exportSheet/sheetCols) itself; (b) after the frontend agent's report was lost to a 529 mid-run (components written, but no App.tsx and no CSS), PM wrote App.tsx + the full stylesheet itself instead of cold-spawning a replacement; (c) PM performed the code review itself after the reviewer spawn 529'd twice.
- **Context:** Cost/time-sensitive (user buying a car this week). The engine is a verbatim port PM already held in context; a cold agent would only re-derive it. Two separate 529 API overloads disrupted subagents. No subagent-resume tool is available in this environment.
- **Alternatives:** re-spawn fresh agents for each — rejected: each cold start re-reads the 257KB prototype + spec, costs more, and risks repeating the overload. Wait for the API — rejected: blocks a time-sensitive deliverable.
- **Rationale:** "Bias toward fewer agents." Independent verification was preserved where it matters most: QA wrote the 155-test engine suite independently, and live DOM/console verification is independent of the code author.
- **Mitigation/Reversible?** The independent `reviewer` can be re-run when the API recovers (logged as an open item in STATE).

## ADR-008 — A single reported accident flags RED (risk), not amber
- **Decision:** In `getFlags`, `accidents === 1` emits a **risk (red)** flag and escalates the card's overall signal to red, instead of the prototype's **warn (amber)**. 2+ accidents were already red; unknown (`null`) stays amber ("pull the history").
- **Context:** User is buying a low-risk daily driver and treats any reported accident as a hard caution (they filter for "no accidents"). On the live data this fired for c10 (Carvana, 1 accident reported); the accident *badge* was already red, so the amber flag text was inconsistent.
- **Alternatives:** keep spec fidelity (1 accident = amber) — rejected: under-weights a signal this buyer cares about and clashes with the red badge.
- **Rationale:** Make the flag text + card border match the badge and the buyer's risk tolerance; a *confirmed* accident is a stronger signal than *unknown* history.
- **Reversible?** Yes — one line in `flags.ts` (+ its test). Documented here so a future "restore prototype fidelity" pass doesn't silently revert it.

## ADR-009 — Bring TCO in by VENDORING car-tco-compare's pure engine (not a shared package / submodule / API)
- **Decision:** Copy the pure TCO calculator from the sibling repo `car-tco-compare` (`app/src/lib/tco.ts` + `depreciation.ts` + `data/reference.ts`) into car-shopping at `app/src/lib/tco/` (verbatim files + a car-shopping-specific `resolve.ts` adapter), and compute TCO live from the existing `Settings.years`/`Settings.miles`. The computed TCO is the **default**; the existing manual `tco5yr` field becomes an **override** (e.g. an Edmunds/AAA figure). Wired into the TCO sort, compare table, detail view, and Sheet export.
- **Context:** User wanted the TCO calculator (with a user-chosen holding period) from `car-tco-compare` to **rank** the RAV4 shortlist here. The two apps are separate GitHub repos / separate Vite/React/TS builds. Car Shopping already had the scaffolding (`tco5yr` field, `years`/`miles` settings, per-year/per-mile derive, a TCO sort, TCO UI rows) but `tco5yr` was `null` for every car, so the sort/rows were inert; the per-year math also divided a fixed "5-yr" number by a variable horizon (latent bug).
- **Alternatives:**
  - (a) **Shared npm package** consumed by both apps — rejected for now: publishing/versioning/CI overhead is overkill for two small personal apps and adds a release step to every engine tweak. Promote to this only if a 3rd consumer appears.
  - (b) **Git submodule / subtree** of the other repo — rejected: fiddly on Windows + Pages Actions, drags in the whole other repo, and the two apps have different `types.ts`.
  - (c) **Runtime call to the deployed car-tco app** — rejected: adds a network dependency + CORS to a static, offline-capable SPA for what is pure client-side math.
- **Rationale:** The engine is small, pure, dependency-free, and already unit-tested. Vendoring keeps car-shopping a self-contained static SPA (GitHub Pages, no backend, works offline), adds **zero runtime deps**, and is fully reversible. The one cost — duplication across repos — is mild because the engine is stable pure math; mitigated with vendor-header provenance + `app/src/lib/tco/README.md` (re-sync instructions). Ranking value holds even with placeholder cost rates: assumptions common to every car cancel out, so the ranking is driven by what differs per car — price, age, mileage.
- **Honesty:** the reference cost rates are illustrative placeholders, so TCO is surfaced as an **"Est."** with the assumptions shown (cash basis, CA regional averages) — never asserted as authoritative.
- **Reversible?** Yes — the module is isolated under `lib/tco/`; deleting it and reverting `derive.ts`/UI labels removes the feature cleanly. Manual `tco5yr` overrides keep working regardless.
