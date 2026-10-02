/*
 * Fit engine: turns a shopper's usual size + a product's fit signals into a
 * size recommendation and a plain-language fit note ("Runs small — size up").
 *
 * Pure functions, no DOM, no network. Loaded as a browser global (FitEngine)
 * and as a CommonJS module for the Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FitEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Share of reviewers that must agree before we tell someone to change size.
  const CONSENSUS = 0.5;

  function reviewSignal(reviews) {
    const r = reviews || {};
    const small = r.runsSmall || 0;
    const tts = r.trueToSize || 0;
    const large = r.runsLarge || 0;
    const total = small + tts + large;
    if (!total) return { direction: 'unknown', shift: 0, share: 0, total: 0 };
    if (small / total >= CONSENSUS) return { direction: 'small', shift: 1, share: small / total, total };
    if (large / total >= CONSENSUS) return { direction: 'large', shift: -1, share: large / total, total };
    return { direction: 'true', shift: 0, share: tts / total, total };
  }

  // A shopper who likes room shouldn't get their usual size in a slim,
  // non-stretch cut; one who likes things fitted can size down in a relaxed cut.
  function preferenceSignal(product, fitPreference) {
    if (fitPreference === 'relaxed' && product.cut === 'slim' && product.stretch !== 'high') {
      return { shift: 1, reason: 'You like a relaxed fit and this is a slim cut, so we went one size up.' };
    }
    if (fitPreference === 'fitted' && product.cut === 'relaxed') {
      return { shift: -1, reason: 'You like a fitted look and this is a relaxed cut, so we went one size down.' };
    }
    return { shift: 0, reason: null };
  }

  function confidenceFor(signal) {
    if (signal.total >= 50 && signal.share >= 0.6) return 'high';
    if (signal.total >= 15) return 'medium';
    return 'low';
  }

  // Index of the shopper's usual size within this product's size run. If the
  // product doesn't carry it, snap to the nearest size it does carry.
  function usualIndex(product, usualSize) {
    const exact = product.sizes.indexOf(usualSize);
    if (exact !== -1) return { index: exact, snapped: false };
    const target = SIZE_ORDER.indexOf(usualSize);
    let best = 0;
    let bestDist = Infinity;
    product.sizes.forEach((s, i) => {
      const d = Math.abs(SIZE_ORDER.indexOf(s) - target);
      if (d < bestDist) { best = i; bestDist = d; }
    });
    return { index: best, snapped: true };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function pct(n) {
    return Math.round(n * 100);
  }

  function lengthNote(product, height) {
    if (!product.lengthSensitive) return null;
    if (height === 'petite') return 'On petite frames the length may run long.';
    if (height === 'tall') return 'On tall frames the length may run short.';
    return null;
  }

  function recommend(product, shopper) {
    const usual = usualIndex(product, shopper.usualSize);
    const review = reviewSignal(product.reviews);
    const pref = preferenceSignal(product, shopper.fitPreference);
    const wanted = usual.index + review.shift + pref.shift;
    const index = clamp(wanted, 0, product.sizes.length - 1);
    const size = product.sizes[index];
    const usualLabel = shopper.usualSize;

    let headline;
    if (review.direction === 'small') headline = 'Runs small — size up';
    else if (review.direction === 'large') headline = 'Runs large — size down';
    else if (review.direction === 'true') headline = 'True to size';
    else headline = 'Not enough reviews yet';

    let evidence = null;
    if (review.total) {
      const what = review.direction === 'small' ? 'runs small'
        : review.direction === 'large' ? 'runs large'
          : 'fits true to size';
      evidence = `${pct(review.share)}% of ${review.total.toLocaleString('en-US')} reviewers say it ${what}.`;
    }

    let advice;
    if (size === usualLabel) advice = `Stick with your usual ${usualLabel}.`;
    else advice = `We suggest ${size} instead of your usual ${usualLabel}.`;

    const notes = [];
    if (pref.reason) notes.push(pref.reason);
    const len = lengthNote(product, shopper.height);
    if (len) notes.push(len);
    if (index !== wanted) notes.push('Your best size may be outside this style’s size range — ask an associate about alternatives.');
    else if (usual.snapped) notes.push(`This style doesn’t come in ${usualLabel}, so we started from the closest size.`);

    return {
      size,
      index,
      headline,
      advice,
      evidence,
      notes,
      confidence: confidenceFor(review),
      direction: review.direction,
    };
  }

  // How many sizes bigger (+) or smaller (−) the chosen size is than the size
  // that actually matches the shopper's body in this garment.
  function sizeDelta(product, shopper, chosenSize) {
    const usual = usualIndex(product, shopper.usualSize).index;
    const matched = usual + reviewSignal(product.reviews).shift;
    return product.sizes.indexOf(chosenSize) - matched;
  }

  const CUT_OFFSET = { slim: -0.5, regular: 0, relaxed: 0.5 };
  const LENGTH_AREAS = ['Length', 'Sleeves'];

  function widthLabel(v) {
    if (v <= -1) return 'Tight';
    if (v <= -0.25) return 'Fitted';
    if (v < 0.25) return 'Just right';
    if (v < 1) return 'Relaxed';
    return 'Roomy';
  }

  function lengthLabel(v) {
    if (v >= 0.75) return 'Long';
    if (v <= -0.75) return 'Short';
    return 'Just right';
  }

  // Per-area fit for whichever size the shopper is previewing.
  function fitMap(product, shopper, chosenSize) {
    const delta = sizeDelta(product, shopper, chosenSize);
    const cut = CUT_OFFSET[product.cut] || 0;
    const heightOffset = { petite: 1, regular: 0, tall: -1 }[shopper.height] || 0;
    const lengthWeight = product.lengthSensitive ? 1 : 0.5;
    return product.fitAreas.map((area) => {
      if (LENGTH_AREAS.includes(area)) {
        return { area, label: lengthLabel(heightOffset * lengthWeight + 0.5 * delta) };
      }
      const offset = (product.areaOffsets && product.areaOffsets[area]) || 0;
      return { area, label: widthLabel(delta + cut + offset) };
    });
  }

  return { SIZE_ORDER, recommend, sizeDelta, fitMap, reviewSignal };
});
