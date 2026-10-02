import type { CompleteShopperRequest, Outfit } from '../../shared/types';
import { INVENTORY, OCCASIONS, PRODUCTS, PRODUCT_OCCASIONS, STORES, getProduct } from '../../shared/sampleData';
import { toCents } from '../../shared/money';
import {
  MAX_OPTIONS,
  SAMPLE_CATALOG,
  buildShortlist,
  getSwapCandidates,
  summarizeShortlist,
  swapPiece,
} from './buildShortlist';

const req = (over: Partial<CompleteShopperRequest> = {}): CompleteShopperRequest => ({
  timeMinutes: 20,
  occasion: 'work',
  size: '16',
  budget: 150,
  storeId: 'store-downtown',
  ...over,
});

function assertQualifies(outfit: Outfit, r: CompleteShopperRequest) {
  let total = 0;
  for (const id of outfit.productIds) {
    const p = getProduct(id)!;
    expect(p.availableSizes).toContain(r.size);
    expect(PRODUCT_OCCASIONS[id]).toContain(r.occasion);
    const rec = INVENTORY.find((x) => x.productId === id && x.storeId === r.storeId && x.size === r.size);
    expect(rec, `${id} has sample availability`).toBeDefined();
    expect(rec!.stockStatus).not.toBe('out_of_stock');
    total += toCents(p.price);
  }
  expect(toCents(outfit.totalPrice)).toBe(total);
  expect(total).toBeLessThanOrEqual(toCents(r.budget));
}

describe('buildShortlist constraints', () => {
  it('every outfit satisfies size, store availability, occasion and total budget — across the whole sample space', () => {
    const sizes = Array.from(new Set(PRODUCTS.flatMap((p) => p.availableSizes)));
    let checked = 0;
    for (const store of STORES)
      for (const occ of OCCASIONS)
        for (const size of sizes)
          for (const budget of [30, 60, 90, 120, 150, 250, 400]) {
            const r = req({ storeId: store.id, occasion: occ.id, size, budget });
            const outfits = buildShortlist(r);
            expect(outfits.length).toBeLessThanOrEqual(MAX_OPTIONS);
            expect(outfits.filter((o) => o.isBestPick)).toHaveLength(outfits.length ? 1 : 0);
            if (outfits.length) expect(outfits[0].isBestPick).toBe(true);
            outfits.forEach((o) => assertQualifies(o, r));
            checked += outfits.length;
          }
    expect(checked).toBeGreaterThan(100);
  });

  it('returns up to three distinct outfits for the canonical request', () => {
    const outfits = buildShortlist(req());
    expect(outfits).toHaveLength(3);
    expect(new Set(outfits.map((o) => o.productIds.join())).size).toBe(3);
    expect(outfits[0].isBestPick).toBe(true);
  });

  it('accepts an outfit exactly at the budget (inclusive)', () => {
    // The sheath dress is $98 and in stock at Westgate in size 16.
    const outfits = buildShortlist(req({ storeId: 'store-westgate', budget: 98 }));
    expect(outfits.map((o) => o.totalPrice)).toContain(98);
    expect(buildShortlist(req({ storeId: 'store-westgate', budget: 97.99 })).map((o) => o.totalPrice)).not.toContain(98);
  });

  it('shows fewer than three when fewer qualify', () => {
    const outfits = buildShortlist(req({ storeId: 'store-westgate' }));
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits.length).toBeLessThan(3);
  });

  it('never returns out-of-stock or not-carried pieces', () => {
    // Downtown is out of the size-18 blazer; Westgate does not carry blazers at all.
    const downtown = buildShortlist(req({ size: '18', budget: 400 }));
    expect(downtown.flatMap((o) => o.productIds)).not.toContain('prod-tailored-blazer');
    const westgate = buildShortlist(req({ storeId: 'store-westgate', budget: 400 }));
    expect(westgate.flatMap((o) => o.productIds)).not.toContain('prod-tailored-blazer');
  });

  it('falls back to individual qualifying items when no complete outfit fits the budget', () => {
    const r = req({ budget: 50 });
    const outfits = buildShortlist(r);
    expect(summarizeShortlist(r).mode).toBe('items');
    expect(summarizeShortlist(r).message).toMatch(/No complete outfit fits \$50\.00/);
    expect(outfits.length).toBeGreaterThan(0);
    outfits.forEach((o) => {
      expect(o.productIds).toHaveLength(1);
      assertQualifies(o, r);
    });
  });
});

describe('buildShortlist empty states (no relaxing, no invention)', () => {
  it('explains when nothing is in stock for the size and store', () => {
    const r = req({ size: '2' });
    expect(buildShortlist(r)).toEqual([]);
    expect(summarizeShortlist(r)).toMatchObject({ mode: 'none' });
    expect(summarizeShortlist(r).message).toMatch(/Nothing is in stock in size 2 at Downtown Flagship/);
  });

  it('explains when stocked pieces do not suit the occasion', () => {
    const r = req({ size: 'M', occasion: 'work' });
    expect(buildShortlist(r)).toEqual([]);
    expect(summarizeShortlist(r).message).toMatch(/none are suited to work/);
  });

  it('explains when everything exceeds the budget, with the real lowest price', () => {
    const r = req({ budget: 10 });
    expect(buildShortlist(r)).toEqual([]);
    expect(summarizeShortlist(r).message).toMatch(/least expensive qualifying piece is \$34\.00/);
  });
});

describe('swapPiece', () => {
  const r = req();

  it('replaces one piece, keeps every constraint, and recalculates the total', () => {
    const outfits = buildShortlist(r);
    const target = outfits[0];
    const piece = target.productIds[0];
    expect(getSwapCandidates(target, piece, r).length).toBeGreaterThan(0);
    const result = swapPiece(outfits, target.id, piece, r);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = result.outfits.find((o) => o.id === target.id)!;
    expect(updated.id).toBe(target.id);
    expect(updated.isBestPick).toBe(target.isBestPick);
    expect(updated.productIds).not.toContain(piece);
    expect(updated.productIds).toContain(result.to.id);
    expect(result.to.category).toBe(result.from.category);
    expect(updated.totalPrice).not.toBe(target.totalPrice);
    assertQualifies(updated, r);
    // other options untouched
    expect(result.outfits.filter((o) => o.id !== target.id)).toEqual(outfits.filter((o) => o.id !== target.id));
  });

  it('never exceeds the budget however many times you swap', () => {
    let outfits = buildShortlist(r);
    for (let i = 0; i < 25; i++) {
      for (const o of outfits) {
        const res = swapPiece(outfits, o.id, o.productIds[i % o.productIds.length], r);
        if (res.ok) outfits = res.outfits;
      }
    }
    outfits.forEach((o) => assertQualifies(o, r));
  });

  it('refuses (without relaxing the budget) when alternatives exist but none fit', () => {
    // $79 = shell top $34 + pencil skirt $45. Other tops/bottoms are in stock but cost too much.
    const tight = req({ budget: 79 });
    const outfits = buildShortlist(tight);
    const target = outfits.find((o) => o.productIds.length === 2)!;
    expect(target.totalPrice).toBe(79);
    for (const id of target.productIds) {
      expect(getSwapCandidates(target, id, tight)).toEqual([]);
      const res = swapPiece(outfits, target.id, id, tight);
      expect(res.ok).toBe(false);
    }
  });

  it('refuses a piece that is not in the outfit', () => {
    const outfits = buildShortlist(r);
    expect(swapPiece(outfits, outfits[0].id, 'prod-does-not-exist', r).ok).toBe(false);
  });

  it('reports a clear failure when the only qualifying piece in a category is already used', () => {
    const r2 = req({ storeId: 'store-westgate', occasion: 'evening', size: '20', budget: 300 });
    const outfits = buildShortlist(r2);
    expect(outfits).toHaveLength(1);
    const res = swapPiece(outfits, outfits[0].id, outfits[0].productIds[0], r2);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/No other dress/);
  });
});

it('uses the shared sample catalog by default', () => {
  expect(SAMPLE_CATALOG.products).toBe(PRODUCTS);
  expect(SAMPLE_CATALOG.inventory).toBe(INVENTORY);
});
