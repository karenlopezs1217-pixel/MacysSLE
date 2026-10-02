# Fit Studio — in-store virtual try-on & fit (prototype)

A kiosk prototype for Macy's stores. A time-pressed shopper picks an item, answers three quick questions, and sees the item on a photo of themselves (or on an avatar). They get a plain-language size and fit note, such as **"Runs small — size up"**, before they walk to the fitting room.

**Why it matters:** Macy's won't win on bulk, low-price shopping against Amazon or Walmart. It can win on confidence at the point of decision. The fit question ("will this fit me?") is what makes people hesitate, and that hesitation costs conversions.

## Run it

No build step and no dependencies.

```bash
npm start          # serves on http://localhost:8080 (python3 http.server)
npm test           # fit-engine unit tests (Node 18+)
```

The camera needs `localhost` or HTTPS. On a real kiosk, serve the app over HTTPS.

## The shopper flow (about 45 seconds)

| Step | Screen | What happens |
|---|---|---|
| 0 | Attract | "Not sure about the fit? See it on you in under a minute." One button. |
| 1 | Item | Tap the item (in store, this would be a tag scan). |
| 2 | Your fit | Usual size, fit preference (fitted / regular / relaxed), height. Three taps; only size is required. |
| 3 | See it | **Use my photo** → consent → camera (or upload), **or** **Use an avatar** → body shape + skin tone. |
| 4 | Result | Try-on preview, recommended size, fit note backed by review data, confidence level, a per-area fit map (shoulders/chest/length…), floor stock by size, and **Send to a fitting room**. |
| 5 | Erased | "Your photo has been permanently erased." Returns to the start screen after 8 seconds. |

## Acceptance criteria → how they're met

| Criterion | Implementation |
|---|---|
| **Explicit consent before upload** | Choosing "Use my photo" goes to a consent screen. The checkbox starts **unchecked** and "I agree — continue" stays disabled until it's checked. Both the camera and file upload check `state.consent` before running, so you can't skip ahead. Declining takes the shopper to the avatar path, so they can still finish without a photo. |
| **Photo not stored after the session** | The photo lives only in an in-memory `<canvas>`. It's never written to disk, `localStorage`, `sessionStorage`, IndexedDB, or a server. Camera tracks stop right after capture, and upload object URLs are revoked right after decoding. The photo is wiped (pixels cleared, canvas set to 0×0, reference dropped) when the shopper taps **End & erase**, after **60 s idle plus a 15 s "Still there?" warning**, or when the page is hidden or closed. A **Content-Security-Policy** (`connect-src 'none'; form-action 'none'`) means the page *cannot* send the photo anywhere. |
| **Output labeled as a simulation** | There are three labels: a "SIMULATION" badge on the preview, a "SIMULATION · Not an exact representation of fit" banner drawn into the image pixels, and a disclaimer under the preview. The consent screen also says it's a simulation. |

## How the fit note is decided (`js/fit-engine.js`)

1. **Review signal:** if at least 50% of reviewers say the item runs small, the engine adds one size; if at least 50% say it runs large, it takes one away.
2. **Preference vs. cut:** someone who likes a relaxed fit gets one size up in a slim, non-stretch cut. Someone who likes a fitted look gets one size down in a relaxed cut.
3. The result is clamped to the style's size range and flagged if the best size falls outside it. If the shopper's usual size isn't made in this style, the engine starts from the nearest one.
4. **Confidence:** high means 50+ reviews and at least 60% agreement; medium means 15+ reviews; otherwise low.
5. **Length notes** for petite and tall shoppers on length-sensitive items.
6. **Fit map:** previewing another size updates the per-area labels (Tight / Fitted / Just right / Relaxed / Roomy, and Short / Long for length). The garment is redrawn wider or narrower to match.

## Demo script (2 minutes)

1. **Start → Wrap Midi Dress → usual size S → Continue.**
2. **Use my photo.** Point out that the box is unchecked and the button is disabled. Check it, then **Turn on camera → Take photo**.
3. On the result: **"Runs small — size up · We suggest M"**, with "68% of 1,240 reviewers". Drag the dress to line it up and use the slider to match your shoulders.
4. Tap **S** to show the fit map change to *Tight*. Tap **L** to show "Online only" and the button change to *Order for pickup*.
5. **Send M to a fitting room** (shows the stylist confirmation).
6. **End & erase** → "Your photo has been permanently erased."
7. Optional: **Quilted Puffer**, usual M, **avatar** → "Runs large — size down". Then wait for the idle timeout to show the automatic erase.

## What's mocked vs. production path

| Prototype | Production |
|---|---|
| 2D garment overlay that you position by hand | Pose estimation for automatic alignment, then an image-based try-on model running **on the device or a store edge server** to keep the privacy guarantee |
| Hard-coded review fit votes | Review fit votes, return reasons ("too small"), and size-chart measurements from the product catalog |
| Mock floor stock and fitting-room request | Store inventory API and the associate clienteling app |
| Four demo products | Tag/UPC scan for any item |

## Metrics to watch in a pilot

- Conversion for kiosk users vs. matched shoppers who didn't use it
- Share of sessions that end in a fitting-room request
- Fit-related return rate on kiosk-assisted purchases
- Median session time (target: under 60 s) and avatar vs. photo usage

## Files

```
index.html          screens + CSP
css/styles.css      kiosk-first, responsive styling
js/fit-engine.js    size recommendation + fit map (pure, unit-tested)
js/catalog.js       demo products + garment SVGs
js/avatar.js        mannequin avatar renderer
js/app.js           flow, consent gate, camera, try-on stage, session erasure
tests/              node:test suite for the fit engine
```
