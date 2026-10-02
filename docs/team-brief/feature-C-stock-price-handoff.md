# Feature C — Store-aware stock, floor location and hold + One clear price and fast handoff

**Feature ID:** `stock-price-handoff` · **Folder:** `src/features/stock-price-handoff/`
**Pain solved:** availability, wasted trips, price clarity, transaction and fulfillment

Read `CLAUDE.md` first. Follow the integration rules exactly. All stock, locations, offers, prices and ETAs are
**SAMPLE DATA** — label them as such on screen.

## Inputs from the session

- Products: `session.selectedProductIds`.
- Size per product: the `recommendedSize` from `session.tryOn.results` for that product if present, otherwise
  `session.request.size`. If neither exists, show a size picker for that product.
- Store: `session.request.storeId`, default `"S-A"`.

## Part 1: Stock, location and hold

For each product, read `data.getInventory(storeId, productId)` and find the record for the chosen size.

| qty | Status shown | Actions |
|---|---|---|
| ≥ 2 | **In stock here** · Floor X, Department | Hold in fitting room · Hold for pickup |
| 1 | **Last one here** · Floor X, Department | Hold in fitting room · Hold for pickup |
| 0 | **Not in this store in size N** | Fallback (below) |

**Fallback when out of stock (always offer one):**

1. Nearest other store with `qty > 0` in that size, sorted by `distanceMiles` → *"In stock at Sample Store B
   (6.2 mi). Hold for pickup?"*
2. If no store has it → **Ship to home** (SAMPLE assumption: the online warehouse can ship every catalog item).
3. If the product's fit runs small/large and the adjacent size *is* in stock here, also suggest it:
   *"Runs small; size 18 is in stock here."*
4. Log a `MissedDemandEvent` (`reason: "size-out-of-stock"`, `source: "stock-price-handoff"`, store, product, size).

**Holds** (write to `session.holds`):

- **Fitting room:** only for items in stock at this store. Message: *"Held in Fitting Room 3. An associate will bring
  it to you."* Expires 30 minutes after `data.now()`.
- **Pickup:** at this store (ready now) or the fallback store (ready by 12:00 PM the next day). Expires at the end
  of the next day.
- Generate `holdId` like `H-XXXX`. Never allow a hold when qty is 0 at that store. Allow cancel.

## Part 2: One clear price

Compute in code from `data.getOffers()` only. **Never invent, guess or round in the shopper's favor.**

1. `subtotal` = sum of regular `price` for items being bought.
2. An offer is **valid** only if all are true:
   - `validFrom ≤ today ≤ validTo` (dates inclusive, using `data.now()`),
   - `requiresLogin` is false (the prototype is anonymous, so login offers never apply),
   - `minSpend` (if any) ≤ the subtotal it applies to,
   - it applies to at least one item (if `categories` is set, only items in those categories count).
3. Discount for a valid offer: percent → `value% × eligible items' subtotal`; amount → `value` (capped at the
   eligible subtotal).
4. Apply the **single best** valid offer (largest discount). Stack only offers with `stackable: true` — none apply
   to anonymous shoppers in the sample data.
5. `youPay = subtotal − discount`, rounded to cents.
6. Show **one big "You pay $X"** number. A **See price breakdown** toggle shows subtotal, the applied offer label,
   the discount, and plain notes on why other offers didn't apply ("Requires sign-in", "Expired Sep 30",
   "Starts Oct 15", "Minimum spend $100 not met", "Not valid on outerwear").
7. Taxes: say "Tax calculated at payment" — do not invent a tax rate.

Write the result to `session.price` (`PriceBreakdown`).

## Part 3: Fast handoff

Three choices; save to `session.fulfillment`, then `onNavigate("done")`:

- **Pay here:** a mock payment terminal screen: *"Tap your card on the terminal."* → *"Simulated payment approved.
  No card data was collected."* (Never build card number fields.) → `{ type: "pay-in-store" }`.
- **Pick up:** uses the hold; shows store and ready-by time → `{ type: "pickup", storeId, readyBy }`.
- **Ship to home:** **firm ETA = 3 business days after `data.now()`** (SAMPLE rule), shown as a date, e.g.
  "Arrives Wed, Oct 7" → `{ type: "ship", etaDate, confidence: "firm" }`. Do not collect an address in the
  prototype; show "Address entered at checkout (not in prototype)". Only show an ETA computed by this rule.

## Acceptance criteria

- [ ] Every item shows a stock status for the selected store, with floor and department when in stock.
- [ ] Out-of-stock items always get a fallback: nearest store with stock, otherwise ship-to-home.
- [ ] Holds are only possible where stock exists; each hold shows where and until when.
- [ ] One "You pay" price; breakdown on demand; only valid offers applied; never an invented discount.
- [ ] Pay / pickup / ship each end with a clear confirmation and a firm ETA or ready-by time.
- [ ] Missed demand is logged for every out-of-stock request.
- [ ] Works standalone and in the full flow. All sample values labeled.

## Test scenarios (demo date Fri Oct 2, 2026, 2:00 PM, Store A)

The shell's `Standalone: stock-price-handoff` view loads the default scenario. For the others, add a
**dev-only scenario switcher inside your own folder** that calls `makeHandoffScenario(name)` from
`src/shared/fixtures.ts` and passes the result up with `onUpdate` (do not edit shared files).

| Scenario | Items (size) | Expected stock | Expected price |
|---|---|---|---|
| `default` | P01 Blouse (16), P04 Trouser (16) | Both in stock at Store A, Floor 2, Women's Career & Tops; trouser is "Last one here" | Subtotal $98.00; 20% weekend offer on both = −$19.60; **You pay $78.40**. $15-off-$100 not applied (min spend not met) |
| `fallback-nearby` | P07 Sheath Dress (16) | Out at Store A → in stock at Store B (6.2 mi), pickup ready by 12:00 PM Sat, Oct 3 | $89.00 − $17.80 (20%) = **$71.20** |
| `out-everywhere` | P09 Blazer (16) | Out at all stores → ship to home, arrives **Wed, Oct 7**; also "Runs small; size 18 is in stock here" | $99.00; no offer applies (outerwear: 30% offer expired; $15 offer min $100 not met) → **$99.00** |
| `best-offer` | P09 Blazer (18), P02 Knit Top (16) | Both in stock at Store A | Subtotal $133.00; 20% would apply to the top only (−$6.80), $15-off-$100 gives −$15.00 → **You pay $118.00** |

In every scenario the rewards offer shows "Requires sign-in" and the $25 shoe offer shows "Starts Oct 15" only
if a shoe is in the cart.
