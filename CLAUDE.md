# Shopping Copilot — context for Claude Code

In-store shopping copilot prototype (React + TypeScript + plain CSS, Vite). UI only: no backend.
Shopper says what they need and how much time they have, gets up to three curated options in their size,
previews the fit, checks store stock and holds, and sees one clear price. **Everything is sample data and
every action is simulated.** Business background and the original specs: `docs/team-brief/` (historical).

## Commands
`npm install` · `npm run dev` · `npm test` · `npm run typecheck` · `npm run build` — all must pass before a push.

## The contract (src/shared/)
- `types.ts`: the six agreed types (`ShopperRequest`, `Product`, `Store`, `InventoryRecord`, `Outfit`,
  `ShoppingSession`) are frozen. Additive types for components 3–5 are below them.
- `sampleData.ts`: the ONE catalog, inventory, offers and fit data. Append only; stable IDs; never add a second catalog.
- Session state lives only in the shell (`src/shell/App.tsx`, a 5-step guided flow). Features receive
  `SessionFeatureProps` (`src/shared/featureProps.ts`) and report changes through callbacks.
  Features plug in at `src/shell/featureSlots.tsx`.

## Guardrails
- Label sample data and simulated actions (`.mc-sample-badge`, `.mc-sim-badge`). Never imply real inventory, reservations, payments or fit prediction.
- No invented discounts: only `SAMPLE_OFFERS`, only when eligible. Shortlists never relax size/store/occasion/budget.
- Try-on photo: in-memory canvas inside the try-on component only; consent before upload; wiped on delete, unmount, page hide, end of session. Never in shared state, storage or network.
- Use the shared theme (`src/styles/theme.css`, `.mc-*` classes). Prefix feature CSS classes with the feature name. Accessible controls; usable from 320px up.
- Add or update tests for behavior you change (vitest + Testing Library).
