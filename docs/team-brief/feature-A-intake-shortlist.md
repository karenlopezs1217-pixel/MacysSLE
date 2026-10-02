# Feature A — Time-and-need intake + Curated shortlist with a "best pick"

**Feature ID:** `intake-shortlist` · **Folder:** `src/features/intake-shortlist/` · **Pain solved:** discovery and decision fatigue

Read `CLAUDE.md` first. Follow the integration rules exactly.

## What the shopper experiences

1. One text box (plus an optional mic button) with the prompt: *"What do you need, and how much time do you have?"*
   Placeholder example: `20 minutes, work outfit, size 16, under $150, this store`.
2. The copilot shows what it understood as editable chips: **Time · Occasion · Size · Budget · Store**.
3. If something important is missing, it asks **at most one** clarifying question.
4. It returns **at most 3** options. One is marked **Best pick** with a one-line reason. Every option has a reason.
5. On a multi-piece option, the shopper can tap **Swap this piece** to see alternatives for that one piece.
6. The shopper chooses an option, then taps **Preview the fit** (goes to `try-on`) or **Skip to checkout**
   (goes to `stock-price-handoff`).

## Part 1: Intake (extraction)

Extract into `ShopperRequest`. The deterministic parser is required; Claude is an optional upgrade.

| Field | Rule (deterministic parser) | Default if missing |
|---|---|---|
| `timeMinutes` | `(\d+)\s*(min|mins|minutes)`; "half an hour" = 30; "an hour" = 60 | `null` (no time pressure) |
| `occasion` | keywords: work/office/meeting/job → `work`; interview → `interview`; wedding → `wedding-guest`; party/gala/event/cocktail → `event`; date/dinner → `date-night`; casual/weekend/everyday → `casual` | ask (see below) |
| `size` | `size\s*(\d{1,2})` or a standalone apparel size `XS/S/M/L/XL` | ask |
| `budgetMax` | `\$\s?(\d+)` optionally after "under/below/up to/max/less than" | `null` (no cap; say so) |
| `storeId` | "this store" or nothing → the kiosk's store `S-A`; otherwise match a store name from `data.getStores()` | `S-A` |

**One clarifying question, max.** Priority: missing size → missing occasion → nothing else. Ask once, e.g.
*"What size should I look for?"* Store it in `request.clarifyingQuestion`. After the answer (parse it with the same
rules), never ask again: proceed and state any assumption in plain words ("No budget given, showing all prices").

**Voice (optional):** use the browser Web Speech API if available; hide the mic button if not supported. Voice
only fills the text box — the shopper confirms before submitting.

## Part 2: Shortlist

Build candidates only from `data.getProducts()`:

- **Eligible product:** `occasions` includes the request occasion AND `sizes` includes the request size.
  Shoes are eligible only if the shopper gave a shoe size; otherwise exclude shoes.
- **Option shapes:** a dress alone; a top + bottom; optionally a dress or top+bottom + one outerwear piece if it
  still fits the budget. Single items are allowed when the request is clearly for one item.
- **Hard filters (never break):** total regular price ≤ `budgetMax` (when set); every piece offered in the requested size.
- **Ranking score (higher is better):**
  - +3 if every piece has `qty > 0` in the selected store in the requested size (use `data.getInventory`)
  - +2 if all pieces are in the same department (faster within the time limit)
  - +1 if `timeMinutes ≤ 30` and the option has ≤ 2 pieces
  - +1 if no piece has a "runs small/large" fit warning
  - tiebreak: lower total price
- **Diversity:** the 3 options must not be the same shape twice if another shape is available
  (e.g. one dress option, one top+bottom option, one alternative).
- **Best pick:** the highest-scoring option; exactly one `isBestPick: true`.
- **Reasons:** one line each, built only from facts in the data (stock at this store, floor/department, price,
  fit note). Example: *"Both pieces are in stock in size 16 on floor 2, so you can try them on within 20 minutes."*
  Never claim anything the data doesn't support.

**Swap this piece:** for the chosen piece, show up to 3 alternatives in the same category that pass the same hard
filters given the rest of the outfit. Recalculate `totalPrice` and the reason after a swap.

**Fewer than 3 valid options:** show what exists and say so. If zero, say what blocked it ("Nothing for work in
size 16 under $20 — try a higher budget?") and log missed demand.

## Missed-demand logging (append via `onUpdate`)

- A product that matches the occasion but is **not offered in the requested size** → `reason: "item-not-carried"`
  (sample data: `P06` Wide-Leg Pant and `P15` Cocktail Dress stop at size 14).
- Zero options within budget → `"over-budget"`. Zero options at all → `"no-match"`.
- `source: "intake-shortlist"`. Do not log the same product twice in one session.

## Writes to the session

`request`, `shortlist`, `selectedOptionId`, `selectedProductIds` (the products of the chosen option, after swaps),
`missedDemand`. Then `onNavigate("try-on")` or `onNavigate("stock-price-handoff")`.

## Optional: Claude upgrade (server-side only)

Only if the team wants richer language understanding or reason wording. Requirements:

- Call from a tiny server route (e.g. a Vite dev-server middleware or small Express server) that reads
  `ANTHROPIC_API_KEY` from the environment. Never call the API from browser code. Model: `claude-sonnet-5-5`.
- Send the request text plus a compact catalog (id, name, category, occasions, sizes, price, fit note, stock flags
  for the selected store). Ask for JSON only: `{ request: ShopperRequest, options: [{ productIds, reason, isBestPick }] }`.
- **Validate everything in code** before showing it: every product ID exists, every piece has the requested size,
  totals are recomputed in code and ≤ budget, ≤ 3 options, exactly one best pick, reasons non-empty. If any check
  fails or the call errors/times out (5 s), use the deterministic result. Never show prices from the model.

## Acceptance criteria

- [ ] Extracts time, occasion, size, budget and store from one sentence; chips are editable.
- [ ] Asks at most one clarifying question per session.
- [ ] Never shows more than 3 options.
- [ ] Every item in every option matches the stated size and the option total is within budget.
- [ ] Exactly one option is flagged Best pick; every option has a one-line, data-backed reason.
- [ ] Swap this piece works and keeps all rules true.
- [ ] Works with no API key. Sample values are labeled.

## Demo script / test cases (sample data, demo date Oct 2, 2026, store S-A)

1. `20 minutes, work outfit, size 16, under $150, this store` → time 20, work, 16, $150, S-A, **no question**.
   3 options, all ≤ $150, all size 16. With the scoring rules above, expected result:
   **Best pick** P01 Relaxed Satin Blouse + P04 Straight-Leg Trouser ($98, both in stock at Store A, same department,
   true to size); then P08 Jersey Wrap Dress ($79); then P02 Ponte Knit Top + P05 Pencil Skirt ($83).
   (This matches `src/shared/fixtures.ts`, which the other features use.) Missed demand logged for P06
   (not carried in 16).
2. `Something for a wedding` → asks one question about size → answer `12, under $200` → shortlist appears; no
   second question.
3. `work outfit size 16 under $20` → zero options, clear message, `over-budget` or `no-match` logged.
4. Swap the trouser in option 1 → alternatives are bottoms in size 16 with outfit total ≤ $150.
