# Shopping Copilot (prototype)

React + TypeScript + plain CSS (Vite). **All data is fictional sample data and every action is simulated.**

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: parsing, constraints, swap, UI flows
npm run typecheck
```

## The user flow

A guided 5-step wizard with a progress stepper, a request summary bar and a sticky Back / Continue bar on phones.

1. **Need** — type, speak, or tap an example. Fields fill in and stay editable. At most one grouped clarifying question (focus jumps to the answer box); once everything is valid, focus jumps to **Find outfits**.
2. **Options** — up to three outfits with a Best pick; **Swap this piece** keeps every constraint; **Choose this one** moves on automatically. Nothing qualifies? A clear reason, never a relaxed constraint.
3. **Fit** — mock try-on on an avatar or (with consent) a photo, plus sample fit notes and a size preview per piece.
4. **Stock** — sample status, floor and department; other store or ship-to-home if unavailable; simulated fitting-room and pickup holds.
5. **Price** — one "You pay" total, expandable breakdown, simulated pay / pickup / ship, then an "All set" summary.

Steps unlock as the shopper progresses and completed steps can be revisited from the stepper. Changing any request detail clears the options (never show results for different constraints). **End session** wipes everything, including any try-on photo.

## What is built

| Step | Component | Where |
| --- | --- | --- |
| Shell | Owns all session state; guided flow; store picker; End session; merchant "missed demand" view | `src/shell/` |
| 1 | Time-and-need intake (typed or voice, one clarifying question) | `src/features/intake/` |
| 2 | Curated shortlist (≤3, best pick, swap) | `src/features/shortlist/` |
| 3 | Virtual try-on and fit (clearly labeled mock; avatar or consented photo) | `src/features/tryon/` |
| 4 | Store stock, location and simulated holds | `src/features/stock-price-handoff/` (`StockHold`) |
| 5 | One "You pay" total, sample offers, simulated pay / pickup / ship | `src/features/stock-price-handoff/` (`PriceHandoff`) |

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/shared/types.ts` | Frozen contract types + additive types (`Offer`, `Hold`, `PriceBreakdown`, `MissedDemandEvent`, `ProductFit`) |
| `src/shared/sampleData.ts` | The ONE catalog: `STORES`, `PRODUCTS`, `PRODUCT_OCCASIONS`, `PRODUCT_COLORS`, `INVENTORY`, `PRODUCT_FIT`, `SAMPLE_OFFERS`, `DEMO_NOW`, helpers |
| `src/shared/dataProvider.ts` | Read-only `DataProvider` view of the sample data (used by components 4–5) |
| `src/shared/session.ts` | `createInitialSession`, `missingFields`, `isRequestComplete` |
| `src/shared/featureProps.ts` | `SessionFeatureProps` + `SessionExtras` passed to components 3–5 |
| `src/shared/money.ts` | `formatPrice`, `sumPrices` (cent-safe) |
| `src/shell/App.tsx`, `featureSlots.tsx` | Shell and the plug-in point for components 3–5 |
| `src/styles/theme.css` | The one shared theme (`.mc-*` classes); `tokens.css` aliases; `base.css` |
| `docs/team-brief/` | Original specs and notes (historical) |

### Shared-data notes
- Stable IDs: `store-downtown`, `store-lakeside`, `store-westgate`; products are `prod-…`. Never rename; only append.
- `Product` has no occasion or color field (frozen), so those live beside the catalog (`PRODUCT_OCCASIONS`, `PRODUCT_COLORS`).
- No inventory record for a product/store/size means "not carried" = unavailable. `stockStatus` is `in_stock | low_stock | out_of_stock`.
- Categories are `top`, `bottom`, `dress`, `outerwear` (no shoes: shoe sizes don't map to apparel sizes).
- The demo clock is fixed (`DEMO_NOW`, Fri Oct 2 2026, 2 PM) so offers, holds and ETAs are repeatable.
- `ShopperRequest` fields are `null` until known. `isRequestComplete(r)` narrows to `CompleteShopperRequest`.

## Component 1 — `TimeAndNeedIntake`
`import { TimeAndNeedIntake } from './features/intake/TimeAndNeedIntake'`

| Prop | Type | Notes |
| --- | --- | --- |
| `request` | `ShopperRequest` | Controlled; from `session.shopperRequest`. `request.storeId` is the "selected store" that "this store" resolves to |
| `onRequestChange` | `(next: ShopperRequest) => void` | Called when text is understood or a field is edited |
| `onSubmit` | `(req: CompleteShopperRequest) => void` | "Find outfits" (enabled only when complete) |
| `stores?`, `occasions?`, `knownSizes?` | | Default to shared sample data |

Behavior: parses typed (or spoken) text into editable fields (`parseRequest.ts`, pure and unit-tested). Asks **at most one** grouped clarifying question, never assumes size/budget, and keeps "Find outfits" disabled until time, occasion, size, budget and store are all valid. Voice uses the Web Speech API when present (button hidden otherwise; errors fall back to typing). Dependencies: `shared/*`, React.

## Component 2 — `CuratedShortlist`
`import { CuratedShortlist } from './features/shortlist/CuratedShortlist'`; engine in `buildShortlist.ts`.

| Prop | Type | Notes |
| --- | --- | --- |
| `request` | `CompleteShopperRequest` | |
| `outfits` | `Outfit[]` | `session.shortlistedOutfits` |
| `selectedOutfitId` | `string \| null` | |
| `onOutfitsChange` | `(outfits: Outfit[]) => void` | After a successful swap |
| `onSelectOutfit` | `(id: string) => void` | "Choose this one" |
| `catalog?` | `Catalog` | Defaults to `SAMPLE_CATALOG` |

Engine API: `buildShortlist(request)` → ≤3 `Outfit`s (best pick first); `summarizeShortlist(request)` → `{mode: 'outfits'|'items'|'none', message?}`; `swapPiece(...)`, `getSwapCandidates(...)`.

Rules: every piece matches the size, has non-`out_of_stock` sample inventory at the selected store, and is tagged for the occasion; the outfit total is ≤ budget. Options are disjoint where possible. Best pick = most complete look, then fewest low-stock pieces, then lowest price. If no complete outfit fits, up to 3 qualifying single items are shown with an explanation; if nothing qualifies, a data-derived reason is shown and nothing is relaxed. Swap replaces a piece with the next same-category qualifying piece (cycling by price) that keeps the total within budget; outfit id and best-pick flag are kept, total and reason are recalculated. The intake `time` value is captured and passed on but does not filter the shortlist.

## Component 3 — `VirtualTryOn`
`import { VirtualTryOn } from './features/tryon/VirtualTryOn'` · props: `SessionFeatureProps`.
Uses the selected outfit and requested size from shared state. Default avatar (4 shapes, 5 skin tones) or an optional photo upload behind an explicit, initially unchecked consent (no camera, no `capture`). Garments are simple 2D overlays; the canvas itself carries a "MOCK SIMULATION" banner. The photo exists only as an in-memory canvas in this component: wiped on "Delete photo now", unmount (End session) and `pagehide`; never in shared state, storage or the network. Fit notes: `Product.fitNote` plus the sample fit engine (`fitEngine.ts`, `PRODUCT_FIT`). Reports via `onExtrasChange`: `tryOnSizes` (previewed size per piece, carried to steps 4–5) and an `item-not-carried` missed-demand event when the ideal size isn't made.

## Components 4 and 5 — `StockHoldSection`, `PriceHandoffSection`
From `src/features/stock-price-handoff` (`logic.ts` is pure and unit-tested).
- **Stock:** sample status, floor and department per piece at the selected store; if unavailable, the nearest other sample store (pickup hold) or ship-to-home; adjacent-size hint; **simulated** fitting-room (30 min, selected store only) and pickup holds, cancellable. Logs `size-out-of-stock` once per store/product/size.
- **Price:** one "You pay"; applies only the single best valid offer from `SAMPLE_OFFERS` (inclusive dates, min spend, categories; sign-in offers never apply; discounts round down and are capped); the breakdown explains each non-applied offer and states that tax and delivery fees are not modeled. Simulated pay / pickup / ship with mock confirmation codes and sample-estimate dates. Reports the method via `onFulfillmentChange` (`pay-in-store | store-pickup | ship-to-home`) and calls `onFinish`.
- Size priority per piece: stock-step choice > try-on size > requested size.

## Connecting a new or replacement component
1. Build it under `src/features/<name>/`, taking `SessionFeatureProps`. Read shared types and sample data from `src/shared/`; no second catalog, no separate session state.
2. Point its slot in `src/shell/featureSlots.tsx` at it; `App.tsx` doesn't change.
3. Panels mount on first visit (so nothing is logged for unseen steps) and stay mounted while navigating. Steps 4–5 remount when the outfit's pieces change; all remount on End session.
4. Label sample data and simulated actions.
