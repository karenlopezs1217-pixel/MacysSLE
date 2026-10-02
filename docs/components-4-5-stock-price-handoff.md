# Components 4 + 5: Stock, location & hold · Price & handoff

**Feature folder:** `src/features/stock-price-handoff/` (feature ID `stock-price-handoff`, spec: `feature-C-stock-price-handoff.md`).
Everything shown is **SAMPLE DATA**. Every hold, payment, pickup and delivery is a **SIMULATION**.

## Exports

| Export (from `src/features/stock-price-handoff`) | What it is |
|---|---|
| `default` → `StockPriceHandoff: React.FC<FeatureProps>` | Full step the app shell mounts. Puts Component 4 and Component 5 together on one screen. |
| `StockHold` + `StockHoldProps` | **Component 4.** Stock status, floor/department, other-store fallback, ship-to-home, simulated holds. |
| `PriceHandoff` + `PriceHandoffProps` | **Component 5.** One "You pay" total, expandable breakdown, simulated pay / pickup / ship handoff. |
| `stockPriceLogic` | Pure functions (`getStock`, `findFallbackStore`, `createHold`, `computePrice`, `shipEta`, …) with no React and no globals. |

### `StockPriceHandoff` (default): props = `FeatureProps` from `src/shared/types.ts`

| Prop | Used for |
|---|---|
| `session` | Reads `selectedProductIds`, `request.size`, `request.storeId`, `tryOn.results[].recommendedSize`, `holds`, `fulfillment`, `missedDemand`. |
| `data` | `DataProvider`: products, stores, inventory, offers, and `now()`, which is fixed to Fri Oct 2 2026, 2:00 PM. |
| `onUpdate(patch)` | Writes `holds`, `missedDemand`, `price`, `fulfillment`. |
| `onNavigate(to)` | `"done"` after Finish. The Back buttons send `"try-on"` / `"intake-shortlist"`. |

**Local state (not shared):** sizes the shopper picks or switches on this screen. Changing a size also removes
that item's hold for the old size and clears `fulfillment`.

### `StockHold` props

| Prop | Type | Notes |
|---|---|---|
| `session` | `ShopperSession` | reads `holds`, `missedDemand` |
| `data` | `DataProvider` | |
| `lines` | `CartLine[]` | `{ product, size, sizeSource }` from `stockPriceLogic.resolveLines` |
| `store` | `Store` | selected store, from `stockPriceLogic.resolveStore` (default `S-A`) |
| `onUpdate` | `(patch) => void` | **callback:** `{ holds }` on hold/cancel; `{ missedDemand }` once per out-of-stock store/product/size |
| `onSizeChange` | `(productId, size) => void` | **callback:** size picker and "Switch to size N" |

### `PriceHandoff` props

| Prop | Type | Notes |
|---|---|---|
| `session`, `data`, `lines`, `store` | as above | |
| `price` | `PriceBreakdown` | from `stockPriceLogic.computePrice(products, data.getOffers(), data.now())` |
| `onUpdate` | `(patch) => void` | **callback:** `{ fulfillment, holds, price }` on confirmation; `{ fulfillment: null }` on "Change how I get it" |
| `onNavigate` | `(to: NavTarget) => void` | **callback:** `"done"` on Finish |

**Dependencies:** `react` only. Uses `src/shared/types.ts`, `src/shared/theme.css` (shared `.mc-*` classes and tokens),
and `src/shared/fixtures.ts` (only the dev-only scenario switcher, which production builds hide). It never imports
`sampleData.ts` or another feature.

## Rules implemented

**Component 4: stock, location, hold**
- Size per item: the shopper's pick here, then the try-on `recommendedSize`, then `request.size`. If none of these exists, a size picker appears.
- Status at the selected store: qty ≥ 2 shows **In stock here**, qty 1 shows **Last one here**, and qty 0 shows **Not in this store in size N**. Items in stock also show floor and department.
- When an item is out of stock, the screen shows the nearest other sample store that has it (with a pickup hold button) and offers **Ship to home**. Ship to home rests on a sample assumption: the warehouse can ship every catalog item. If the fit runs small or large and the next size in that direction is in stock here, it shows "Runs small; size 18 is in stock here" with a switch button. It also logs a `size-out-of-stock` missed-demand event, once only.
- Holds are mock confirmations labeled **SIMULATION … Not a real reservation**. A fitting-room hold is possible only at the selected store when stock is above 0, and it expires 30 minutes after `now()`. A pickup hold lasts until the end of the next day. Every hold can be cancelled. The code enforces these limits, not just the UI.

**Component 5: price, handoff**
- One **You pay** total (before tax). **See price breakdown** opens a panel that lists the items, subtotal, applied offer and discount, and why each other offer did not apply. It also states the assumptions: no tax rate is used, tax is calculated at payment, and no delivery fee is modeled.
- Only offers in `data.getOffers()` are used. An offer is valid only if all of these hold: the date range includes today (inclusive), it does not require sign-in, the minimum spend is met on the eligible subtotal, and at least one eligible category is in the bag. The single largest valid discount is applied. Discounts are rounded down to the cent, never in the shopper's favor. When no offer is valid, no discount is applied.
- Handoff choices:
  - **Pay here:** only if every item is in stock here. It shows a mock terminal, then "Simulated payment approved. No card data was collected."
  - **Pick up:** only at sample stores that have every item. It creates pickup holds. The selected store is ready now; another store is ready by 12:00 PM the next day.
  - **Ship to home:** shown as a sample estimate of 3 business days, which is Wed Oct 7. No address is collected.

  Each choice that cannot be used shows the reason.

## Verification

- `npx esbuild src/features/stock-price-handoff/checks/logic.check.ts --bundle --platform=node --log-level=warning | node`
  runs 36 checks: the four spec scenarios (`$78.40`, `$71.20` with the Store B fallback, `$99.00` with ship arriving Oct 7, `$118.00`) plus failure cases. The failure cases cover the shoe offer that has not started, an empty bag, the discount cap, rounding down, a missing size, an unknown product ID, and hold rules.
- In the browser, open `npm run dev` → *Standalone: stock-price-handoff* → **Dev only: test scenarios** to load each scenario.

## Connecting to the shared app shell

1. Nothing extra is needed: `src/app/AppShell.tsx` already imports `../features/stock-price-handoff` as step 3 and passes
   `session`, `data`, `onUpdate`, `onNavigate`.
2. Upstream features must set `session.selectedProductIds` and `session.request` (`size`, `storeId`). `try-on` can also
   set `tryOn.results[].recommendedSize`. Then they call `onNavigate("stock-price-handoff")`.
3. To use the two components separately (for example on two shell steps), import `{ StockHold, PriceHandoff, stockPriceLogic }`.
   Build `lines` with `stockPriceLogic.resolveLines(session, data, {})` and `store` with `resolveStore`. Pass `price` from `computePrice`,
   and mirror it into the session with `onUpdate({ price })`.
4. `main.tsx` loads `src/shared/theme.css` globally, and this feature only adds layout CSS prefixed `stock-price-handoff__`.
