# Integration checklist (merging the three features into one app)

## Before merging (each builder)

- [ ] Your code is only inside `src/features/<your-feature-id>/`. `git status` or a file diff shows no changes to
      `src/shared/`, `src/app/`, `src/main.tsx`, `package.json` (unless agreed in `CONTRACT_CHANGES.md`).
- [ ] `src/features/<id>/index.tsx` still `export default`s a component that accepts `FeatureProps`.
- [ ] Class names are prefixed with your feature ID; styles live in your folder.
- [ ] `npm run typecheck` passes.
- [ ] Your feature's acceptance criteria and demo script pass in **Standalone** view.
- [ ] Share your folder as a zip (or push to the team repo) named `<feature-id>.zip`.

## Merge (one person, ~15 minutes)

1. Start from a clean copy of this starter pack.
2. Replace each stub folder with the builder's folder:
   `src/features/intake-shortlist/`, `src/features/try-on/`, `src/features/stock-price-handoff/`.
3. If a builder added a dependency, add it to `package.json` (only if listed in `CONTRACT_CHANGES.md`).
4. `npm install` → `npm run typecheck` → `npm run dev`.

## End-to-end test in "Full flow" view (demo date Oct 2, 2026)

1. Type `20 minutes, work outfit, size 16, under $150, this store` → 3 options, best pick Blouse + Trouser ($98).
2. Choose the best pick → **Preview the fit** → avatar with SIMULATION watermark; fit notes for both items.
3. Upload a photo with consent → overlay works → continue.
4. Stock shows both items at Store A, floor 2; hold the trouser in a fitting room.
5. Price shows **You pay $78.40**; breakdown explains the $15 offer's minimum and the sign-in offer.
6. Choose **Pay here** → simulated approval → "All set" screen.
7. Open "Merchant view: missed demand" → at least the P06 "item-not-carried" event from step 1 is listed.
8. Open "Debug: current session" → no image data anywhere; `tryOn.consentGiven` is `true`.
9. Click **Restart session** → everything clears, including the photo.
10. Repeat with Back buttons and Skip try-on to confirm navigation in both directions.

## Common merge problems and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Type error in `index.tsx` | Component props don't match `FeatureProps` | Use `FeatureProps` from `src/shared/types.ts` exactly |
| Styles from one feature break another | Unprefixed class names | Prefix with the feature ID |
| Feature shows old data after another step | Feature copied session into its own state and never re-read it | Read from `session` props; write with `onUpdate` |
| "Contract version mismatch" banner | Someone edited `src/shared/types.ts` | Restore the shared folder from the starter pack |
