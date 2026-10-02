import type { Occasion, ShopperRequest, Store } from '../../shared/types';
import type { EssentialField } from '../../shared/session';

export interface ParseContext {
  stores: Store[];
  occasions: Occasion[];
  /** What "this store" means. `null` when the shopper has not selected a store. */
  selectedStoreId: string | null;
}

export interface ParseResult {
  /** Only the fields actually found in the text. Never contains guesses. */
  fields: Partial<ShopperRequest>;
  /** Several different occasions / stores were mentioned, so none was chosen. */
  ambiguous: { occasion: string[]; store: string[] };
  /** The text said "this store" but no store is selected. */
  thisStoreUnresolved: boolean;
}

const NUMBER_WORDS: Record<string, number> = {
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  'forty five': 45,
  'forty-five': 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
};
const NUM = `(\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|')})`;

const MAX_MINUTES = 8 * 60;

function toNumber(token: string): number {
  const word = NUMBER_WORDS[token.toLowerCase()];
  return word ?? Number(token);
}

/** Replace the matched span with spaces so later extractors can't re-read it. */
function consume(source: string, match: RegExpExecArray): string {
  return source.slice(0, match.index) + ' '.repeat(match[0].length) + source.slice(match.index + match[0].length);
}

export function extractTime(text: string): { value: number | null; rest: string } {
  const attempts: Array<[RegExp, (m: RegExpExecArray) => number]> = [
    [new RegExp(`\\b${NUM}\\s*(?:hours?|hrs?)\\s*(?:and\\s*)?(\\d+)\\s*(?:minutes?|mins?)\\b`), (x) => toNumber(x[1]) * 60 + Number(x[2])],
    [/\bhalf\s+(?:an?\s+)?hour\b/, () => 30],
    [/\bquarter\s+of\s+an\s+hour\b/, () => 15],
    [/\ban\s+hour\s+and\s+a\s+half\b/, () => 90],
    [/\b(?:an|one)\s+hour\b/, () => 60],
    [new RegExp(`\\b${NUM}\\s*(?:hours?|hrs?)\\b`), (x) => toNumber(x[1]) * 60],
    [new RegExp(`\\b${NUM}\\s*(?:minutes?|mins?)\\b`), (x) => toNumber(x[1])],
  ];

  const rest = text.toLowerCase();
  for (const [re, calc] of attempts) {
    const m = re.exec(rest);
    if (m) {
      const minutes = Math.round(calc(m));
      // Reject nonsense like "0 minutes" or "5000 minutes": treat as not provided.
      return { value: minutes >= 1 && minutes <= MAX_MINUTES ? minutes : null, rest: consume(rest, m) };
    }
  }
  return { value: null, rest };
}

const SIZE_WORDS: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  'extra small': 'XS',
  'extra-small': 'XS',
  'extra large': 'XL',
  'extra-large': 'XL',
};
const LETTER_SIZE = 'xxs|xs|s|m|l|xl|xxl|xxxl|extra[- ]small|extra[- ]large|small|medium|large';

function normalizeSize(raw: string): string | null {
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (SIZE_WORDS[lower]) return SIZE_WORDS[lower];
  if (/^\d{1,2}[wp]?$/.test(lower)) {
    const n = parseInt(lower, 10);
    // Apparel sizes 0–30; anything else ("size 150") is not a size.
    return n >= 0 && n <= 30 ? lower.toUpperCase() : null;
  }
  if (/^(xxs|xs|s|m|l|xl|xxl|xxxl)$/.test(lower)) return lower.toUpperCase();
  return null;
}

export function extractSize(lowered: string): { value: string | null; rest: string } {
  const attempts: RegExp[] = [
    new RegExp(`\\b(?:size|sz)\\s*[:\\-]?\\s*(\\d{1,3}[wp]?|${LETTER_SIZE})\\b`),
    // "I wear a 16", "I'm a 14" — numbers and unambiguous letter sizes only.
    new RegExp(`\\b(?:i\\s*wear|i\\s*am|i'm|wearing)\\s+(?:a\\s+|an\\s+)?(\\d{1,3}[wp]?|xxs|xs|xl|xxl|xxxl|small|medium|large)\\b`),
  ];
  for (const re of attempts) {
    const m = re.exec(lowered);
    if (m) {
      const value = normalizeSize(m[1]);
      return { value, rest: consume(lowered, m) };
    }
  }
  return { value: null, rest: lowered };
}

export function extractBudget(lowered: string): number | null {
  const amount = '(\\d[\\d,]*(?:\\.\\d{1,2})?)';
  const keyword =
    '(?:under|below|less\\s+than|up\\s+to|at\\s+most|no\\s+more\\s+than|within|max(?:imum)?(?:\\s+of)?|budget(?:\\s+is|\\s+of)?|total\\s+of)';
  const attempts: RegExp[] = [
    new RegExp(`\\$\\s*${amount}`),
    new RegExp(`\\b${amount}\\s*(?:dollars?|bucks|usd)\\b`),
    // "under 150" — safe because time and size spans were already consumed from the text.
    new RegExp(`\\b${keyword}\\s+${amount}\\b`),
  ];
  for (const re of attempts) {
    const m = re.exec(lowered);
    if (m) {
      const value = Number(m[1].replace(/,/g, ''));
      return Number.isFinite(value) && value > 0 ? value : null;
    }
  }
  return null;
}

const OCCASION_KEYWORDS: Record<string, RegExp> = {
  work: /\b(work|office|business|professional|interview|meeting|corporate)\b/,
  casual: /\b(casual|everyday|weekend|errands|brunch|relaxed)\b/,
  evening: /\b(evening|night\s+out|date\s+night|dinner|party|cocktail|gala)\b/,
  'wedding-guest': /\b(wedding|bridal\s+shower|ceremony)\b/,
};

export function extractOccasions(lowered: string, occasions: Occasion[]): string[] {
  return occasions.filter((o) => OCCASION_KEYWORDS[o.id]?.test(lowered)).map((o) => o.id);
}

const THIS_STORE = /\b(?:this|current|selected|my)\s+(?:store|location)\b/;

export function extractStores(lowered: string, stores: Store[]): string[] {
  return stores
    .filter((s) => {
      const name = s.name.toLowerCase();
      const distinctive = name.split(/\s+/)[0];
      return lowered.includes(name) || new RegExp(`\\b${distinctive}\\b`).test(lowered);
    })
    .map((s) => s.id);
}

export function parseShopperText(text: string, ctx: ParseContext): ParseResult {
  const fields: Partial<ShopperRequest> = {};
  const ambiguous: ParseResult['ambiguous'] = { occasion: [], store: [] };
  let thisStoreUnresolved = false;

  const time = extractTime(text);
  if (time.value !== null) fields.timeMinutes = time.value;

  const size = extractSize(time.rest);
  if (size.value !== null) fields.size = size.value;

  const budget = extractBudget(size.rest);
  if (budget !== null) fields.budget = budget;

  const lowered = text.toLowerCase();

  const occasionIds = extractOccasions(lowered, ctx.occasions);
  if (occasionIds.length === 1) fields.occasion = occasionIds[0];
  else if (occasionIds.length > 1) ambiguous.occasion = occasionIds;

  const named = extractStores(lowered, ctx.stores);
  if (named.length === 1) {
    fields.storeId = named[0];
  } else if (named.length > 1) {
    ambiguous.store = named;
  } else if (THIS_STORE.test(lowered)) {
    if (ctx.selectedStoreId && ctx.stores.some((s) => s.id === ctx.selectedStoreId)) {
      fields.storeId = ctx.selectedStoreId;
    } else {
      thisStoreUnresolved = true;
    }
  }

  return { fields, ambiguous, thisStoreUnresolved };
}

const FIELD_PHRASES: Record<EssentialField, string> = {
  occasion: 'the occasion',
  size: 'your size',
  budget: 'your total budget',
  timeMinutes: 'how much time you have',
  storeId: 'which store you are shopping at',
};

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * ONE question that groups every missing essential. Returns null when nothing is missing.
 * `labels` turns ambiguous ids into readable names for the hint in parentheses.
 */
export function buildClarifyingQuestion(
  missing: EssentialField[],
  parsed: ParseResult,
  labelFor: { occasion: (id: string) => string; store: (id: string) => string },
): string | null {
  if (missing.length === 0) return null;
  const parts = missing.map((f) => {
    if (f === 'occasion' && parsed.ambiguous.occasion.length > 1) {
      const names = parsed.ambiguous.occasion.map(labelFor.occasion).join(' and ');
      return `the occasion (I saw ${names})`;
    }
    if (f === 'storeId' && parsed.ambiguous.store.length > 1) {
      const names = parsed.ambiguous.store.map(labelFor.store).join(' and ');
      return `which store (I saw ${names})`;
    }
    if (f === 'storeId' && parsed.thisStoreUnresolved) return 'which store ("this store" isn\'t selected yet)';
    return FIELD_PHRASES[f];
  });
  return `Quick question so I don't guess: can you tell me ${joinList(parts)}?`;
}
