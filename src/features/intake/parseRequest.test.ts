import { OCCASIONS, STORES } from '../../shared/sampleData';
import { missingFields } from '../../shared/session';
import { buildClarifyingQuestion, extractBudget, extractTime, parseShopperText } from './parseRequest';

const ctx = { stores: STORES, occasions: OCCASIONS, selectedStoreId: 'store-lakeside' as string | null };
const labels = { occasion: (id: string) => id, store: (id: string) => id };

describe('parseShopperText', () => {
  it('extracts every field from the canonical example and resolves "this store"', () => {
    const r = parseShopperText('20 minutes, work outfit, size 16, under $150, this store', ctx);
    expect(r.fields).toEqual({
      timeMinutes: 20,
      occasion: 'work',
      size: '16',
      budget: 150,
      storeId: 'store-lakeside',
    });
  });

  it('does not confuse "under 20 minutes" or "size 16" with a budget', () => {
    const r = parseShopperText('under 20 minutes, casual, size 16', ctx);
    expect(r.fields.timeMinutes).toBe(20);
    expect(r.fields.size).toBe('16');
    expect(r.fields.budget).toBeUndefined();
  });

  it('never assumes size or budget when they are absent', () => {
    const r = parseShopperText('I have half an hour for a wedding', ctx);
    expect(r.fields).toEqual({ timeMinutes: 30, occasion: 'wedding-guest' });
    expect(missingFields({ timeMinutes: 30, occasion: 'wedding-guest', size: null, budget: null, storeId: null })).toEqual([
      'size',
      'budget',
      'storeId',
    ]);
  });

  it('supports hours, number words, letter sizes and dollar words', () => {
    expect(extractTime('1 hour').value).toBe(60);
    expect(extractTime('an hour and a half').value).toBe(90);
    expect(extractTime('1 hour 15 minutes').value).toBe(75);
    expect(extractTime('twenty minutes').value).toBe(20);
    expect(extractTime('0 minutes').value).toBeNull();
    expect(extractBudget('around 200 dollars')).toBe(200);
    expect(extractBudget('budget of $1,250.50')).toBe(1250.5);
    const r = parseShopperText('casual look, size medium, 45 min, 80 bucks', ctx);
    expect(r.fields).toMatchObject({ size: 'M', timeMinutes: 45, budget: 80, occasion: 'casual' });
  });

  it('rejects out-of-range sizes instead of guessing', () => {
    expect(parseShopperText('size 150, work', ctx).fields.size).toBeUndefined();
  });

  it('matches a named store over "this store"', () => {
    const r = parseShopperText('work outfit at Westgate Mall, size 8, $90, 15 min', ctx);
    expect(r.fields.storeId).toBe('store-westgate');
  });

  it('leaves "this store" unresolved when no store is selected', () => {
    const r = parseShopperText('20 min work size 16 $150 this store', { ...ctx, selectedStoreId: null });
    expect(r.fields.storeId).toBeUndefined();
    expect(r.thisStoreUnresolved).toBe(true);
  });

  it('does not pick between conflicting occasions', () => {
    const r = parseShopperText('work dinner, size 12', ctx);
    expect(r.fields.occasion).toBeUndefined();
    expect(r.ambiguous.occasion).toEqual(['work', 'evening']);
  });
});

describe('buildClarifyingQuestion', () => {
  it('groups all missing essentials into one question', () => {
    const parsed = parseShopperText('work outfit this store', ctx);
    const q = buildClarifyingQuestion(['size', 'budget', 'timeMinutes'], parsed, labels)!;
    expect(q.match(/\?/g)).toHaveLength(1);
    expect(q).toContain('your size');
    expect(q).toContain('your total budget');
    expect(q).toContain('how much time');
  });

  it('returns null when nothing is missing', () => {
    expect(buildClarifyingQuestion([], parseShopperText('x', ctx), labels)).toBeNull();
  });
});
