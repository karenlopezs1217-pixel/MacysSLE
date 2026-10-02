# In-Store Shopping Copilot: starter pack (Macy's workshop prototype)

This folder gives all three builders the same starting point, so the three features plug into one app at the end.
Claude Code reads `CLAUDE.md` automatically and will follow it.

## What's inside

- `CLAUDE.md`: the full context (business problem, evidence, guardrails, integration rules).
- `docs/feature-A-…`, `docs/feature-B-…`, `docs/feature-C-…`: one spec per feature, with acceptance criteria and demo scripts.
- `docs/integration-checklist.md`: how to merge and test the final app.
- `src/shared/`: the shared "contract" (data types, SAMPLE data, test sessions, colors). Nobody edits this.
- `src/app/AppShell.tsx`: the app frame that runs the full flow, or one feature on its own for development.

## How each builder starts (in their own Claude account)

1. Unzip this folder and open Claude Code in it.
2. Paste the prompt for your feature:

**Builder A (intake + shortlist):**
> Read CLAUDE.md and docs/feature-A-intake-shortlist.md. Build the `intake-shortlist` feature only, inside
> `src/features/intake-shortlist/`. Do not edit src/shared or src/app. Install dependencies, run the app, and show me
> the demo script working in the "Standalone: intake-shortlist" view. Start with the deterministic version; no API key.

**Builder B (virtual try-on):**
> Read CLAUDE.md and docs/feature-B-virtual-tryon.md. Build the `try-on` feature only, inside `src/features/try-on/`,
> as a clearly labeled mock. Do not edit src/shared or src/app. Install dependencies, run the app, and walk me through
> the demo script and privacy checks in the "Standalone: try-on" view.

**Builder C (stock, price, handoff):**
> Read CLAUDE.md and docs/feature-C-stock-price-handoff.md. Build the `stock-price-handoff` feature only, inside
> `src/features/stock-price-handoff/`. Do not edit src/shared or src/app. Add a dev-only scenario switcher in your
> folder and show me all four test scenarios producing the expected prices.

3. When done, ask Claude Code: *"Run the typecheck and the pre-merge checklist in docs/integration-checklist.md."*
4. Zip your feature folder and share it with the person doing the merge.

## Merging

One person follows `docs/integration-checklist.md`: drop the three feature folders into a fresh copy of this pack,
run it, and walk the end-to-end test.

## Reminders for the presentation

- Everything in the app is SAMPLE DATA. Say so when you demo.
- The try-on is a labeled mock; a real version would need a try-on or image-generation service.
- The "Merchant view: missed demand" on the final screen is the data story: every size or item the store couldn't
  supply becomes a signal for what to stock where.
