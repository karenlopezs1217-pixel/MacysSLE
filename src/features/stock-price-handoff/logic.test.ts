import type { Offer, Product } from '../../shared/types';
import { createSampleDataProvider } from '../../shared/dataProvider';
import {
  adjacentSizeInStock, computePrice, createHold, findFallbackStore, formatDay, getStock, missedDemandFor,
  pickupReadyBy, pickupStoresForAll, resolveLines, resolveStore, shipEta,
} from './logic';

const data = createSampleDataProvider();
const product = (id: string) => data.getProduct(id)!;
const price = (ids: string[], offers = data.getOffers()) => computePrice(ids.map(product), offers, data.now());
const DT = 'store-downtown';

describe('stock and location (Component 4)', () => {
  it('reports sample status, floor and department', () => {
    const s = getStock(data, DT, 'prod-ponte-trouser', '16');
    expect(s.level).toBe('in-stock');
    expect(s.floor).toBe(2);
    expect(s.department).toBe("Women's Bottoms");
    expect(getStock(data, DT, 'prod-wide-leg-trouser', '16').level).toBe('low-stock');
  });

  it('treats out-of-stock, unknown size and not-carried distinctly', () => {
    expect(getStock(data, DT, 'prod-silk-blouse', '18').level).toBe('out');
    expect(getStock(data, DT, 'prod-silk-blouse', '3').level).toBe('not-carried');
    expect(getStock(data, 'store-westgate', 'prod-tailored-blazer', '16').level).toBe('not-carried');
  });

  it('offers the nearest other sample store that has the size, or none', () => {
    const fb = findFallbackStore(data, DT, 'prod-silk-blouse', '18');
    expect(fb?.store.id).toBe('store-lakeside');
    expect(data.distanceMiles(DT, 'store-lakeside')).toBe(6.2);
    expect(findFallbackStore(data, DT, 'prod-pencil-skirt', '18')).toBeNull();
  });

  it('suggests the adjacent size when the fit runs small and that size is in stock here', () => {
    expect(adjacentSizeInStock(data, 'store-lakeside', product('prod-silk-blouse'), '16')).toBe('18');
    expect(adjacentSizeInStock(data, DT, product('prod-silk-blouse'), '16')).toBeNull(); // 18 out at downtown
    expect(adjacentSizeInStock(data, DT, product('prod-ponte-trouser'), '16')).toBeNull(); // true to size
  });

  it('logs one missed-demand event per out-of-stock size and dedupes', () => {
    const { lines } = resolveLines(
      { productIds: ['prod-silk-blouse'], requestedSize: '16', tryOnSizes: { 'prod-silk-blouse': '18' }, overrides: {} },
      data,
    );
    const first = missedDemandFor(lines, data, DT, []);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ reason: 'size-out-of-stock', productId: 'prod-silk-blouse', size: '18', source: 'stock-price-handoff' });
    expect(missedDemandFor(lines, data, DT, first)).toHaveLength(0);
  });
});

describe('simulated holds', () => {
  it('only allows a fitting-room hold at the selected store, when in stock', () => {
    expect(createHold(data, 'fitting-room', 'prod-ponte-trouser', '16', DT, DT)?.type).toBe('fitting-room');
    expect(createHold(data, 'fitting-room', 'prod-ponte-trouser', '16', 'store-lakeside', DT)).toBeNull();
    expect(createHold(data, 'fitting-room', 'prod-silk-blouse', '18', DT, DT)).toBeNull(); // out of stock
  });

  it('allows pickup holds at another store with stock; fitting-room holds expire after 30 minutes', () => {
    expect(createHold(data, 'pickup', 'prod-silk-blouse', '18', 'store-lakeside', DT)?.storeId).toBe('store-lakeside');
    expect(createHold(data, 'pickup', 'prod-silk-blouse', '18', DT, DT)).toBeNull();
    const h = createHold(data, 'fitting-room', 'prod-ponte-trouser', '16', DT, DT)!;
    expect(new Date(h.expiresAt).getTime() - data.now().getTime()).toBe(30 * 60_000);
  });

  it('readiness: now at the selected store, noon next day elsewhere', () => {
    expect(pickupReadyBy(data, DT, DT).getTime()).toBe(data.now().getTime());
    expect(pickupReadyBy(data, 'store-lakeside', DT).getTime()).toBe(new Date(2026, 9, 3, 12, 0).getTime());
  });

  it('pickup stores require every item in the chosen size', () => {
    const mk = (size: string) =>
      resolveLines({ productIds: ['prod-silk-blouse', 'prod-ponte-trouser'], requestedSize: size, tryOnSizes: {}, overrides: {} }, data).lines;
    expect(pickupStoresForAll(data, mk('16'), DT).map((s) => s.id)[0]).toBe(DT);
    const lines = resolveLines({ productIds: ['prod-pencil-skirt'], requestedSize: '18', tryOnSizes: {}, overrides: {} }, data).lines;
    expect(pickupStoresForAll(data, lines, DT)).toEqual([]);
  });
});

describe('price (Component 5): only sample offers, only when eligible', () => {
  it('applies the largest single valid offer', () => {
    // shell $34 + skirt $45 + cardigan $52 = $131. O1 = 20% of $79 = $15.80 beats O2 ($15 off $100+).
    const p = price(['prod-shell-top', 'prod-pencil-skirt', 'prod-longline-cardigan']);
    expect(p.subtotal).toBe(131);
    expect(p.appliedOffer?.id).toBe('O1');
    expect(p.discount).toBe(15.8);
    expect(p.youPay).toBe(115.2);
    expect(p.notes.some((n) => n.includes('not combined'))).toBe(true);
  });

  it('applies no discount when no sample offer is eligible, and says why', () => {
    const p = price(['prod-tailored-blazer']); // outerwear: O1 not valid on it, O4 expired, O2 needs $100
    expect(p.appliedOffer).toBeNull();
    expect(p.discount).toBe(0);
    expect(p.youPay).toBe(89);
    expect(p.notes.join('|')).toMatch(/Expired Sep 30/);
    expect(p.notes.join('|')).toMatch(/Not valid on outerwear/);
    expect(p.notes.join('|')).toMatch(/Minimum spend \$100 not met/);
    expect(p.notes[0]).toMatch(/No sample offer applies/);
  });

  it('never applies sign-in offers, not-yet-active offers or invented offers', () => {
    const p = price(['prod-sheath-dress', 'prod-wrap-dress']);
    expect(p.appliedOffer?.requiresLogin).toBe(false);
    expect(p.notes.join('|')).toMatch(/Requires sign-in/);
    expect(price(['prod-silk-blouse'], []).discount).toBe(0); // no offers defined -> no discount
  });

  it('respects offer dates inclusively', () => {
    const o: Offer = { id: 'T', label: 't', type: 'amount', value: 5, validFrom: '2026-10-02', validTo: '2026-10-02', requiresLogin: false, stackable: false };
    expect(computePrice([product('prod-silk-blouse')], [o], new Date(2026, 9, 2, 23, 59)).discount).toBe(5);
    expect(computePrice([product('prod-silk-blouse')], [o], new Date(2026, 9, 3, 0, 1)).discount).toBe(0);
  });

  it('caps amount discounts at the eligible subtotal and rounds percent discounts down', () => {
    const big: Offer = { id: 'X', label: 'x', type: 'amount', value: 500, validFrom: '2026-01-01', validTo: '2026-12-31', requiresLogin: false, stackable: false };
    expect(computePrice([product('prod-cotton-tee')], [big], data.now())).toMatchObject({ discount: 18, youPay: 0 });
    const pct: Offer = { id: 'P', label: 'p', type: 'percent', value: 15, validFrom: '2026-01-01', validTo: '2026-12-31', requiresLogin: false, stackable: false };
    // 15% of $18 = $2.70; 15% of $34 = $5.10 (exact). 15% of $45 = $6.75; sanity-check floor with a non-exact case:
    const odd = { ...product('prod-cotton-tee'), price: 19.99 } as Product;
    expect(computePrice([odd], [pct], data.now()).discount).toBe(2.99); // 2.9985 floored, never rounded up
  });

  it('empty bag is $0 and unknown product IDs are reported, not priced', () => {
    expect(price([]).youPay).toBe(0);
    const { lines, unknownIds } = resolveLines({ productIds: ['prod-nope'], requestedSize: '16', tryOnSizes: {}, overrides: {} }, data);
    expect(lines).toEqual([]);
    expect(unknownIds).toEqual(['prod-nope']);
  });
});

describe('handoff estimates and size resolution', () => {
  it('ship ETA is 3 business days after the demo clock (sample rule)', () => {
    expect(formatDay(shipEta(data.now()))).toBe('Wed, Oct 7');
  });

  it('size priority: shopper override > try-on > requested > none', () => {
    const base = { productIds: ['prod-ponte-trouser'], requestedSize: '16' as string | null };
    const size = (tryOnSizes: Record<string, string>, overrides: Record<string, string>, requestedSize = base.requestedSize) =>
      resolveLines({ ...base, requestedSize, tryOnSizes, overrides }, data).lines[0];
    expect(size({}, {})).toMatchObject({ size: '16', sizeSource: 'request' });
    expect(size({ 'prod-ponte-trouser': '14' }, {})).toMatchObject({ size: '14', sizeSource: 'try-on' });
    expect(size({ 'prod-ponte-trouser': '14' }, { 'prod-ponte-trouser': '12' })).toMatchObject({ size: '12', sizeSource: 'shopper' });
    expect(size({}, {}, null)).toMatchObject({ size: null, sizeSource: 'none' });
    expect(size({ 'prod-ponte-trouser': '99' }, {}, '16')).toMatchObject({ sizeSource: 'request' }); // invalid size ignored
  });

  it('falls back to a visible default store only when none is selected', () => {
    expect(resolveStore('store-lakeside', data)).toMatchObject({ wasDefaulted: false });
    expect(resolveStore(null, data)).toMatchObject({ wasDefaulted: true });
  });
});
