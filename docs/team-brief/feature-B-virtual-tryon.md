# Feature B — Virtual try-on and fit

**Feature ID:** `try-on` · **Folder:** `src/features/try-on/` · **Pain solved:** hesitation before buying (conversion)

Read `CLAUDE.md` first. Follow the integration rules exactly.

## Important: this is a clearly labeled MOCK

Real virtual try-on needs an image-generation or try-on API. For the workshop, build a **mock**: the shopper's photo
(or an avatar) with a simple garment overlay drawn as SVG from the product's `swatchHex`. Say so on screen.
Do not call any image API. Do not attempt face detection, body measurement or live camera access.

## What the shopper experiences

1. Sees the products from `session.selectedProductIds` (from Feature A) as small cards.
2. Chooses **Use an avatar** (default, pre-selected) or **Use my photo**.
3. If **Use my photo**: a consent step appears *before* any file picker opens (see Privacy below).
4. Sees the photo or avatar with the garment overlay. Simple controls: move up/down, resize, switch item.
   A watermark is always visible: **"SIMULATION — not an accurate picture of fit."**
5. Sees a **size and fit note** per item, e.g. *"Runs small, size up: we suggest 18."*
6. Taps **Looks good, continue** → `stock-price-handoff`, **Back to options** → `intake-shortlist`,
   or **Skip** → `stock-price-handoff`.

## Avatar

Provide 3 simple, neutral SVG body silhouettes (no faces, no real people), labeled by shape only
(e.g. "Avatar 1/2/3"), not by size or body judgment words. The overlay works the same on avatars and photos.

## Privacy rules (non-negotiable)

- **Explicit consent before upload:** a plain-language panel: what happens to the photo ("stays on this device
  only, is never uploaded or saved, and is deleted when you finish or restart"), an unchecked checkbox
  "I agree", and buttons **Continue** / **Use an avatar instead**. The file picker opens only after consent.
- **Never stored:** keep the image only in component state via `URL.createObjectURL`. Never put it (or a data URL)
  in `ShopperSession`, `localStorage`, `sessionStorage`, IndexedDB, cookies, logs or any network request.
- **Discard:** call `URL.revokeObjectURL` and clear state on **Delete photo now**, on leaving the feature, and on
  unmount (the app shell remounts features when a session restarts).
- Use `<input type="file" accept="image/*">` only. No `capture` attribute, no `getUserMedia`.
- Record only `tryOn.consentGiven` (boolean) in the session.

## Size and fit logic (deterministic, from product data)

For each selected product, start from the shopper's requested size (`session.request.size`) or, if missing, ask
once inside this feature with a size picker.

| `product.fit.runs` | Recommended size |
|---|---|
| `"small"` | next size up in `product.sizes` |
| `"large"` | next size down in `product.sizes` |
| `"true"` | same size |

- Show `product.fit.note` plus the recommendation, e.g. *"Runs small in the shoulders, size up: we suggest 18."*
- If the recommended size isn't offered for that product, keep the requested size and say
  *"This item isn't made in 18; size 16 is the closest."* Log a `MissedDemandEvent`
  (`reason: "item-not-carried"`, `source: "try-on"`, with that product and the recommended size).
- Do not check store stock here; Feature C does that.
- Label the note as guidance: "Fit note based on SAMPLE product data."

## Writes to the session

`tryOn: { consentGiven, results: TryOnResult[] }` with one result per selected product
(`isSimulation: true`), plus any `missedDemand`. Do not change `selectedProductIds` or the shortlist.

## Acceptance criteria

- [ ] Explicit consent appears before any upload; declining routes to the avatar.
- [ ] The photo is never stored: not in the session (check the Debug panel), not in browser storage, no network
      requests (check the browser Network tab), and it is gone after Restart session.
- [ ] Every try-on view is visibly labeled as a simulation.
- [ ] A size and fit note appears for every selected product, using the rules above.
- [ ] Works standalone (`Standalone: try-on` in the dev view) and inside the full flow.

## Demo script (standalone fixture: P01 Relaxed Satin Blouse + P04 Straight-Leg Trouser, size 16)

1. Avatar view loads by default with the blouse overlay and the SIMULATION watermark.
2. Fit notes: P01 "True to size… we suggest 16"; P04 "True to size… we suggest 16".
3. Tap **Use my photo** → consent panel → tick "I agree" → upload any photo → overlay appears.
4. Tap **Delete photo now** → photo gone; Debug panel never showed image data.
5. Extra check in the full flow: choose the Ponte Knit Top (P02, runs small) in size 16 → suggests 18.
