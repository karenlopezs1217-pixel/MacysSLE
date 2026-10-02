# Macy's In-Store Shopping Copilot — Project Context for Claude Code

You are building a workshop prototype for an MBA team (University of Michigan SLE Tech Track Day,
"Business Problem + AI Workshop"). The students are not programmers. Explain what you change in plain
business language, never ask them to debug code by hand, and keep the app runnable at every step.

The app is built as **three features on three different Claude accounts**, then merged into **one app**.
Integration only works if every builder follows the shared contract in `src/shared/`. Read the
"Integration rules" section before writing any code.

---

## 1. The business problem (why this exists)

**Company:** Macy's, Inc. (Macy's nameplate stores). **Personas:** CFO / COO / CMO executive team.

Evidence the team gathered (public sources, October 2026):

- **Two Macy's.** Macy's scores 2.1/5 on Trustpilot (3,108 reviews, mostly online orders) but every one of
  47 stores we pulled scores 4.0–4.5 on Google (~257,000 ratings, in-person visits).
- **Stores and associates are the asset.** In 77 hand-coded Trustpilot reviews (Apr 26–Aug 12, 2026),
  13 of 20 positive reviews praised a specific in-store associate. Online order/delivery problems appeared
  in 32 complaints vs. 8 for in-store problems. Customer service failures appeared in 35 of 57 negative reviews.
- **In-store pain points (Google reviews, 47 stores):** can't find help (~13 stores), size or item not
  available (~9), store pickup/delivery failures (~8), price and policy inconsistencies (~7),
  disorganized floor (~7).
- **Business context (Macy's Q2 FY2026, quarter ended Aug 1, 2026):** comparable sales +2.7%; Macy's
  nameplate +1.1% vs. Reimagine 200 stores +1.9%. Management says store traffic is steady but conversion
  is weak. Digital was ~34% of Q1 2026 net sales. Macy's already runs an AI assistant (AskMacy's) online.
- **Comparable:** Amazon Style (2022) put app-to-fitting-room touchscreens in stores and closed ~17 months
  later. Our edge: Macy's has the stores and associates Amazon lacked.

**Working problem statement:** Because Macy's says store traffic is steady but conversion is weak, and
shoppers report missing sizes, thin in-store stock and no one to help, shoppers already in the store walk
out without finding the option they came for, which costs Macy's sales from its most valuable asset.

**One-sentence pitch:** A shopper tells the copilot what they need and how much time they have, gets three
curated options with one best pick, can preview the fit, and sees one clear price with the item held in a
fitting room or for pickup — and every size or item the store couldn't supply becomes data on what to stock.

---

## 2. The three features (one per builder account)

| Feature ID | Combines | Pain solved | Spec |
|---|---|---|---|
| `intake-shortlist` | (1) Time-and-need intake + (2) Curated shortlist with best pick | Discovery, decision fatigue | `docs/feature-A-intake-shortlist.md` |
| `try-on` | (3) Virtual try-on and fit | Hesitation before buying (conversion) | `docs/feature-B-virtual-tryon.md` |
| `stock-price-handoff` | (4) Store-aware stock, location and hold + (5) One clear price and fast handoff | Availability, wasted trips, price clarity, transaction | `docs/feature-C-stock-price-handoff.md` |

**User flow in the merged app:**

```
[ intake-shortlist ] --> [ try-on ] (optional, skippable) --> [ stock-price-handoff ] --> done
       request + 3 options      fit preview + size note          stock, hold, price, pay/pickup/ship
```

Each feature reads and writes ONE shared object, the `ShopperSession` (see `src/shared/types.ts`).

---

## 3. Integration rules (MUST follow — this is what makes the merge easy)

1. **Same stack everywhere:** React 18 + TypeScript + Vite. Plain CSS using the tokens in
   `src/shared/theme.css`. No Tailwind, no UI libraries, no state libraries, no router. Keep dependencies
   to `react` and `react-dom` unless the feature spec says otherwise.
2. **Stay in your folder.** Each builder writes code only inside `src/features/<feature-id>/`.
   Do NOT edit anything in `src/shared/` or `src/app/`. If the contract truly needs a change, write the
   proposal in `docs/CONTRACT_CHANGES.md` and tell the team; do not change the shared files yourself.
3. **One entry point per feature:** `src/features/<feature-id>/index.tsx` must `export default` a React
   component typed as `React.FC<FeatureProps>` (from `src/shared/types.ts`). Nothing else is imported
   by the app shell.
4. **Talk only through the session.** A feature receives `session`, `data`, `onUpdate(patch)` and
   `onNavigate(next)`. It never imports another feature's files and never keeps its own global state
   outside the session (local component state is fine).
5. **Data only through the `DataProvider`.** Never import `sampleData.ts` directly inside a feature; use
   the `data` prop. This lets the team swap sample data for real data later in one place.
6. **Run standalone.** Each feature must work alone with `src/shared/fixtures.ts`
   (`makeStandaloneSession(featureId)`). The dev harness `src/app/AppShell.tsx` has a feature picker so
   each builder can open their feature directly. Do not delete the other features' stub folders.
7. **CSS scoping:** prefix every class name with your feature ID (e.g. `.try-on__card`). Put feature
   styles in `src/features/<feature-id>/styles.css` and import it from your `index.tsx`.
8. **Log missed demand.** Whenever a requested size/item/budget cannot be met, append a
   `MissedDemandEvent` to `session.missedDemand` via `onUpdate`. This feeds the merchant data story,
   which is the team's key differentiator.
9. **Keep `CONTRACT_VERSION` in sync.** If `session.contractVersion` does not match, show a visible
   warning instead of crashing.

**Merge procedure (done once at the end):** start from any one account's copy of the repo, copy the other
two `src/features/<feature-id>/` folders over the stubs, run `npm install && npm run dev`, then walk the
acceptance checklist in `docs/integration-checklist.md`.

---

## 4. Guardrails (apply to every feature)

- **SAMPLE DATA must be labeled.** All products, stores, stock, offers and prices are invented. Show a
  visible "SAMPLE DATA — not real Macy's inventory or prices" banner (the app shell renders one; features
  should also label sample values where they appear). Never imply the data describes real Macy's stores.
- **No fabricated facts.** If the app cites a business statistic, use only the figures in Section 1.
- **No real people.** No real executive, employee or customer names or photos. Generic placeholder art only;
  no brand logos or copyrighted images. Product images are simple colored SVG placeholders.
- **Privacy first.** No logins, no payments processed, no personal data collected or stored. The try-on
  photo stays in browser memory only and is discarded when the session ends. Anonymous mode is the default.
- **No invented discounts or prices.** Only offers in the data provider, only when valid.
- **AI calls are optional and server-side.** The prototype must work with no API key using deterministic
  logic. If a builder adds Claude, the key lives in a server environment variable (`ANTHROPIC_API_KEY`),
  never in browser code, and code must validate every AI answer against the catalog (see Feature A spec).
  Use model `claude-sonnet-5-5`. Always fall back to the deterministic result if the call fails.
- **Accessibility basics:** buttons are real `<button>`s, images have alt text, works at 390px mobile width.

---

## 5. Repo layout

```
macys-instore-copilot/
  CLAUDE.md                      <- this file
  README.md                      <- plain-English instructions for the team
  docs/
    feature-A-intake-shortlist.md
    feature-B-virtual-tryon.md
    feature-C-stock-price-handoff.md
    integration-checklist.md
    CONTRACT_CHANGES.md
  src/
    main.tsx                     <- mounts AppShell (shared, do not edit)
    app/AppShell.tsx             <- merged flow + standalone feature picker (shared)
    shared/                      <- THE CONTRACT (shared, do not edit)
      types.ts                   <- ShopperSession, FeatureProps, DataProvider, all data types
      sampleData.ts              <- SAMPLE catalog, stores, inventory, offers + createSampleDataProvider()
      fixtures.ts                <- ready-made sessions for running each feature standalone
      theme.css                  <- colors, spacing, type tokens
    features/
      intake-shortlist/index.tsx <- Builder A
      try-on/index.tsx           <- Builder B
      stock-price-handoff/index.tsx <- Builder C
```

## 6. Commands

- `npm install` then `npm run dev` — run the app (feature picker at the top).
- `npm run typecheck` — must pass before handing a feature back.

## 7. Definition of done for any feature

- Meets every acceptance criterion in its spec, demonstrated on screen with the demo script in the spec.
- Runs standalone AND inside the merged flow without editing shared files.
- `npm run typecheck` passes; no console errors.
- Every sample value is labeled; every AI-generated text is checked against the catalog.
