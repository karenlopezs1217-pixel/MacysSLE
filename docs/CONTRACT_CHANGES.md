# Contract change requests

Do not edit `src/shared/` directly. If your feature truly needs a contract change, add an entry here,
tell the team, and agree on it before anyone changes the shared files. Approved changes bump `CONTRACT_VERSION`
and are copied to all three accounts at the same time.

| # | Requested by (feature) | Change | Why | Status |
|---|---|---|---|---|
| 1 | stock-price-handoff (Components 4+5) | `src/shared/theme.css`: Macy's-inspired palette (#E21A2C / #000 / #FFF / #F5F5F5 / #DDD), white page background, typography scale, and shared `.mc-btn`, `.mc-card`, `.mc-panel`, `.mc-choice`, `.mc-status`, `.mc-alert`, `.mc-best-pick`, `.mc-sim-badge`, `.mc-wordmark` classes plus `:focus-visible` styles. All original token names are kept (values remapped), so existing code is unaffected. No change to `types.ts`, so `CONTRACT_VERSION` stays 1.0.0. | The branding brief requires every color, type style, button and card style to live in ONE shared theme file that all teammates import. | Applied on branch `claude/shopping-copilot-components-4-5-as6n68`; team to confirm |
