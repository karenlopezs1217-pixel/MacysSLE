# Shopping Copilot (prototype)

React + TypeScript + plain CSS (Vite). **All data is fictional sample data and every action is simulated.**

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: parsing, constraints, swap, UI flows
npm run typecheck
```

## Repository layout

| Path | Owner | Purpose |
| --- | --- | --- |
| `src/shared/types.ts` | everyone (frozen contract) | `ShopperRequest`, `Product`, `Store`, `InventoryRecord`, `Outfit`, `ShoppingSession` (+ `FulfillmentMethod`, `StockStatus`, `Occasion`) |
| `src/shared/sampleData.ts` | everyone (append only) | The ONE catalog: `STORES`, `PRODUCTS`, `PRODUCT_OCCASIONS`, `INVENTORY`, `OCCASIONS`, lookup helpers |
| `src/shared/session.ts` | shell | `createInitialSession`, `missingFields`, `isRequestComplete` |
| `src/shared/money.ts` | everyone | `formatPrice`, `sumPrices` (cent-safe) |
| `src/shared/featureProps.ts` | everyone | `SessionFeatureProps` passed to components 3–5 |
| `src/shell/App.tsx` | shell | Owns ALL session state; renders steps 1–5 |
| `src/shell/featureSlots.tsx` | teammates (one line each) | Where components 3, 4, 5 plug in |
| `src/features/intake/` | Component 1 | Time-and-need intake |
| `src/features/shortlist/` | Component 2 | Curated shortlist |
| `src/styles/tokens.css`, `base.css` | shared | Design tokens, `.btn`, `.sample-tag`, `.visually-hidden` |

### Shared-data notes
- Stable IDs: `store-downtown`, `store-lakeside`, `store-westgate`; products are `prod-…`. Never rename; only append.
- `Product` has no occasion field (contract is frozen), so occasion suitability lives beside the catalog in `PRODUCT_OCCASIONS`.
- No inventory record for a product/store/size means "not carried" = unavailable. `stockStatus` is `in_stock | low_stock | out_of_stock`.
- The catalog has no shoes (shoe sizes don't map to apparel sizes); categories are `top`, `bottom`, `dress`, `outerwear`.
- Component 5 should add its offers/tax/delivery assumptions to `sampleData.ts` (append only).
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

## Connecting teammates' components (Components 3–5)
1. Build your component under `src/features/<name>/`, taking `SessionFeatureProps` (`session`, `onSelectOutfit`, `onFulfillmentChange`). Read shared types and sample data from `src/shared/`; don't create another catalog or session state.
2. In `src/shell/featureSlots.tsx`, replace your slot's body, e.g. `export const VirtualTryOnSlot = (p: SessionFeatureProps) => <VirtualTryOn {...p} />;`. `App.tsx` doesn't change.
3. The shell renders slots only after an outfit is selected, and remounts them when **End session** is pressed, so keep uploaded photos in component state (revoke object URLs in an effect cleanup) and they are discarded automatically.
4. Changing any intake field clears the shortlist, selection and fulfillment, so a downstream step never shows data for different constraints.
5. Label sample data and simulated actions in your UI (`<span className="sample-tag">`).
