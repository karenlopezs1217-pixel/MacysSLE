import { PRODUCTS, PRODUCT_FIT } from '../../shared/sampleData';
import { fitMap, recommend, sizeDelta, type Shopper } from './fitEngine';

const product = (id: string) => PRODUCTS.find((p) => p.id === id)!;
const fit = (id: string) => PRODUCT_FIT[id];
const shopper = (over: Partial<Shopper> = {}): Shopper => ({ usualSize: '16', fitPreference: 'regular', height: 'regular', ...over });

describe('fit engine', () => {
  it('a runs-small item tells the shopper to size up', () => {
    const r = recommend(product('prod-silk-blouse'), fit('prod-silk-blouse'), shopper());
    expect(r.size).toBe('18');
    expect(r.headline).toBe('Runs small — size up');
    expect(r.advice).toBe('We suggest 18 instead of 16.');
    expect(r.evidence).toBe('55% of 760 sample reviewers say it runs small.');
    expect(r.confidence).toBe('medium');
  });

  it('a runs-large item tells the shopper to size down', () => {
    const r = recommend(product('prod-boxy-tee'), fit('prod-boxy-tee'), shopper());
    expect(r.size).toBe('14');
    expect(r.headline).toBe('Runs large — size down');
    expect(r.confidence).toBe('high');
  });

  it('a true-to-size item keeps the shopper size', () => {
    const r = recommend(product('prod-ponte-trouser'), fit('prod-ponte-trouser'), shopper());
    expect(r.size).toBe('16');
    expect(r.headline).toBe('True to size');
    expect(r.advice).toBe('Stick with your size 16.');
  });

  it('works on letter sizes', () => {
    const r = recommend(product('prod-fleece-jacket'), fit('prod-fleece-jacket'), shopper({ usualSize: 'M' }));
    expect(r.size).toBe('S');
  });

  it('few reviews lower confidence', () => {
    const f = { ...fit('prod-pencil-skirt'), reviews: { runsSmall: 1, trueToSize: 2, runsLarge: 0 } };
    expect(recommend(product('prod-pencil-skirt'), f, shopper()).confidence).toBe('low');
  });

  it('a relaxed preference on a slim cut sizes up again; fitted on a relaxed cut sizes down', () => {
    const slim = recommend(product('prod-shell-top'), fit('prod-shell-top'), shopper({ fitPreference: 'relaxed' }));
    expect(slim.size).toBe('18');
    expect(slim.notes.join(' ')).toMatch(/relaxed fit/);
    const relaxed = recommend(product('prod-knit-sweater'), fit('prod-knit-sweater'), shopper({ fitPreference: 'fitted' }));
    expect(relaxed.size).toBe('14');
  });

  it('clamps to the size run and flags it', () => {
    const r = recommend(product('prod-pencil-skirt'), fit('prod-pencil-skirt'), shopper({ usualSize: '18' }));
    expect(r.size).toBe('18'); // skirt is made up to 18; ideal size 20 is out of range
    expect(r.outOfRange).toBe(true);
    expect(r.notes.join(' ')).toMatch(/outside the sizes/);
  });

  it('snaps a missing usual size to the nearest size on the same scale', () => {
    const r = recommend(product('prod-shell-top'), fit('prod-shell-top'), shopper({ usualSize: '4' }));
    expect(r.size).toBe('6');
    expect(r.notes.join(' ')).toMatch(/doesn't come in 4/);
  });

  it('adds length notes only for length-sensitive items', () => {
    const dress = recommend(product('prod-sheath-dress'), fit('prod-sheath-dress'), shopper({ height: 'petite' }));
    expect(dress.notes.join(' ')).toMatch(/run long/);
    const tee = recommend(product('prod-cotton-tee'), fit('prod-cotton-tee'), shopper({ usualSize: 'M', height: 'petite' }));
    expect(tee.notes).toHaveLength(0);
  });

  it('fit map reads tighter below and roomier above the matched size', () => {
    const p = product('prod-oxford-shirt');
    const label = (size: string, area: string) => fitMap(p, fit(p.id), shopper(), size).find((a) => a.area === area)!.label;
    expect(label('16', 'Chest')).toBe('Just right');
    expect(label('14', 'Chest')).toBe('Tight');
    expect(label('18', 'Chest')).toBe('Roomy');
    // Relaxed cuts read roomier at the same size than slim ones.
    const relaxed = product('prod-knit-sweater');
    expect(fitMap(relaxed, fit(relaxed.id), shopper(), '16').find((a) => a.area === 'Chest')!.label).toBe('Relaxed');
  });

  it('size delta is zero at the body-matched size', () => {
    const p = product('prod-silk-blouse');
    expect(sizeDelta(p, fit(p.id), shopper(), '18')).toBe(0);
    expect(sizeDelta(p, fit(p.id), shopper(), '16')).toBe(-1);
  });

  it('every catalog product has sample fit data', () => {
    for (const p of PRODUCTS) expect(PRODUCT_FIT[p.id], p.id).toBeDefined();
  });
});
