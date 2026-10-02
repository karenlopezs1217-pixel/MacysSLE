/**
 * Fit engine (ported from the Fit Studio prototype): turns the shopper's size plus a product's
 * SAMPLE fit signals into a size recommendation and a plain-language fit note.
 * Pure functions: no DOM, no network. Guidance only, based on invented sample data.
 */
import type { ProductFit } from '../../shared/types';

export type FitPreference = 'fitted' | 'regular' | 'relaxed';
export type Height = 'petite' | 'regular' | 'tall';

export interface Shopper {
  usualSize: string;
  fitPreference: FitPreference;
  height: Height;
}

/** The slice of Product the engine needs: sizes ordered smallest to largest. */
export interface SizedProduct {
  availableSizes: string[];
  category: string;
}

export type Direction = 'small' | 'large' | 'true' | 'unknown';

export interface Recommendation {
  size: string;
  headline: string;
  advice: string;
  evidence: string | null;
  notes: string[];
  confidence: 'high' | 'medium' | 'low';
  direction: Direction;
  /** The ideal size is outside the sizes this item is made in. */
  outOfRange: boolean;
}

const LETTER_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
/** Share of reviewers that must agree before we tell someone to change size. */
const CONSENSUS = 0.5;

export function reviewSignal(reviews: ProductFit['reviews']): { direction: Direction; shift: number; share: number; total: number } {
  const total = reviews.runsSmall + reviews.trueToSize + reviews.runsLarge;
  if (!total) return { direction: 'unknown', shift: 0, share: 0, total: 0 };
  if (reviews.runsSmall / total >= CONSENSUS) return { direction: 'small', shift: 1, share: reviews.runsSmall / total, total };
  if (reviews.runsLarge / total >= CONSENSUS) return { direction: 'large', shift: -1, share: reviews.runsLarge / total, total };
  return { direction: 'true', shift: 0, share: reviews.trueToSize / total, total };
}

function preferenceSignal(fit: ProductFit, preference: FitPreference): { shift: number; reason: string | null } {
  if (preference === 'relaxed' && fit.cut === 'slim' && fit.stretch !== 'high') {
    return { shift: 1, reason: 'You like a relaxed fit and this is a slim cut, so we went one size up.' };
  }
  if (preference === 'fitted' && fit.cut === 'relaxed') {
    return { shift: -1, reason: 'You like a fitted look and this is a relaxed cut, so we went one size down.' };
  }
  return { shift: 0, reason: null };
}

function confidenceFor(signal: { total: number; share: number }): 'high' | 'medium' | 'low' {
  if (signal.total >= 50 && signal.share >= 0.6) return 'high';
  if (signal.total >= 15) return 'medium';
  return 'low';
}

const rank = (size: string): number | null => {
  if (/^\d+$/.test(size)) return Number(size);
  const i = LETTER_ORDER.indexOf(size);
  return i === -1 ? null : i;
};

/** Index of the shopper's size in this product's size run; snaps to the nearest size on the same scale. */
function usualIndex(sizes: string[], usual: string): { index: number; snapped: boolean } {
  const exact = sizes.indexOf(usual);
  if (exact !== -1) return { index: exact, snapped: false };
  const target = rank(usual);
  let best = Math.floor((sizes.length - 1) / 2);
  let bestDist = Infinity;
  sizes.forEach((s, i) => {
    const r = rank(s);
    if (target === null || r === null || /^\d+$/.test(s) !== /^\d+$/.test(usual)) return;
    if (Math.abs(r - target) < bestDist) {
      best = i;
      bestDist = Math.abs(r - target);
    }
  });
  return { index: best, snapped: true };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => Math.round(n * 100);

function lengthNote(fit: ProductFit, height: Height): string | null {
  if (!fit.lengthSensitive) return null;
  if (height === 'petite') return 'On petite frames the length may run long.';
  if (height === 'tall') return 'On tall frames the length may run short.';
  return null;
}

export function recommend(product: SizedProduct, fit: ProductFit, shopper: Shopper): Recommendation {
  const sizes = product.availableSizes;
  const usual = usualIndex(sizes, shopper.usualSize);
  const review = reviewSignal(fit.reviews);
  const pref = preferenceSignal(fit, shopper.fitPreference);
  const wanted = usual.index + review.shift + pref.shift;
  const index = clamp(wanted, 0, sizes.length - 1);
  const size = sizes[index];

  const headline =
    review.direction === 'small' ? 'Runs small — size up'
    : review.direction === 'large' ? 'Runs large — size down'
    : review.direction === 'true' ? 'True to size'
    : 'Not enough reviews yet';

  let evidence: string | null = null;
  if (review.total) {
    const what = review.direction === 'small' ? 'runs small' : review.direction === 'large' ? 'runs large' : 'fits true to size';
    evidence = `${pct(review.share)}% of ${review.total.toLocaleString('en-US')} sample reviewers say it ${what}.`;
  }

  const advice = size === shopper.usualSize ? `Stick with your size ${shopper.usualSize}.` : `We suggest ${size} instead of ${shopper.usualSize}.`;

  const notes: string[] = [];
  if (pref.reason) notes.push(pref.reason);
  const len = lengthNote(fit, shopper.height);
  if (len) notes.push(len);
  if (index !== wanted) notes.push('Your best size may be outside the sizes this item is made in — ask an associate about alternatives.');
  else if (usual.snapped) notes.push(`This item doesn't come in ${shopper.usualSize}, so we started from the closest size.`);

  return { size, headline, advice, evidence, notes, confidence: confidenceFor(review), direction: review.direction, outOfRange: index !== wanted };
}

/** How many sizes bigger (+) or smaller (−) `chosenSize` is than the size that matches the shopper's body. */
export function sizeDelta(product: SizedProduct, fit: ProductFit, shopper: Shopper, chosenSize: string): number {
  const usual = usualIndex(product.availableSizes, shopper.usualSize).index;
  return product.availableSizes.indexOf(chosenSize) - (usual + reviewSignal(fit.reviews).shift);
}

const CUT_OFFSET = { slim: -0.5, regular: 0, relaxed: 0.5 } as const;

export const FIT_AREAS: Record<string, string[]> = {
  top: ['Shoulders', 'Chest', 'Sleeves', 'Length'],
  outerwear: ['Shoulders', 'Chest', 'Sleeves', 'Length'],
  dress: ['Bust', 'Waist', 'Hips', 'Length'],
  bottom: ['Waist', 'Hips', 'Thigh', 'Length'],
};

const isLengthArea = (area: string) => area === 'Length' || area === 'Sleeves';

function widthLabel(v: number): string {
  if (v <= -1) return 'Tight';
  if (v <= -0.25) return 'Fitted';
  if (v < 0.25) return 'Just right';
  if (v < 1) return 'Relaxed';
  return 'Roomy';
}

function lengthLabel(v: number): string {
  if (v >= 0.75) return 'Long';
  if (v <= -0.75) return 'Short';
  return 'Just right';
}

/** Per-area fit for whichever size is being previewed. */
export function fitMap(product: SizedProduct, fit: ProductFit, shopper: Shopper, chosenSize: string): Array<{ area: string; label: string }> {
  const delta = sizeDelta(product, fit, shopper, chosenSize);
  const cut = CUT_OFFSET[fit.cut];
  const heightOffset = { petite: 1, regular: 0, tall: -1 }[shopper.height];
  const lengthWeight = fit.lengthSensitive ? 1 : 0.5;
  return (FIT_AREAS[product.category] ?? FIT_AREAS.top).map((area) =>
    isLengthArea(area)
      ? { area, label: lengthLabel(heightOffset * lengthWeight + 0.5 * delta) }
      : { area, label: widthLabel(delta + cut) },
  );
}
