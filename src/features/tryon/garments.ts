/**
 * Simple SVG garment overlays for the MOCK try-on. Every garment shares one coordinate system:
 * 300 units wide, centered on x=150. Shoulder-anchored garments have their shoulder seams at y=40
 * and 160 units apart; waist-anchored garments (bottoms) start at y=0 at the waistband.
 */
export const GARMENT = { width: 300, shoulderY: 40, shoulderSpan: 160 } as const;

export type GarmentStyle = 'sweater' | 'dress' | 'blazer' | 'puffer' | 'trouser' | 'skirt';

/** Which drawing represents which product. Unlisted products fall back by category. */
const STYLE_BY_PRODUCT: Record<string, GarmentStyle> = {
  'prod-fleece-jacket': 'puffer',
  'prod-pencil-skirt': 'skirt',
  'prod-satin-skirt': 'skirt',
};
const STYLE_BY_CATEGORY: Record<string, GarmentStyle> = {
  top: 'sweater',
  dress: 'dress',
  outerwear: 'blazer',
  bottom: 'trouser',
};

export function garmentStyleFor(productId: string, category: string): GarmentStyle {
  return STYLE_BY_PRODUCT[productId] ?? STYLE_BY_CATEGORY[category] ?? 'sweater';
}

export const isWaistAnchored = (style: GarmentStyle) => style === 'trouser' || style === 'skirt';

/** Painter's order: bottoms first, then tops/dresses, outerwear last. */
export const LAYER_ORDER: Record<GarmentStyle, number> = { trouser: 0, skirt: 0, sweater: 1, dress: 1, blazer: 2, puffer: 2 };

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const svg = (height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${height}" viewBox="0 0 300 ${height}">${body}</svg>`;

const DRAW: Record<GarmentStyle, (c: string) => string> = {
  sweater(c) {
    const d = shade(c, 0.22);
    return svg(300, `
        <path d="M122,30 Q150,62 178,30 L232,42 Q252,50 256,80 L266,252 L238,254 L232,120 L230,292 L70,292 L68,120 L62,254 L34,252 L44,80 Q48,50 68,42 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <g stroke="${d}" stroke-opacity=".35" stroke-width="2" fill="none"><path d="M100,70 V280 M125,74 V280 M150,78 V280 M175,74 V280 M200,70 V280"/></g>
        <path d="M122,30 Q150,62 178,30" stroke="${d}" stroke-width="9" fill="none"/>
        <rect x="70" y="276" width="160" height="16" fill="${d}" opacity=".55"/>`);
  },
  dress(c) {
    const d = shade(c, 0.25);
    return svg(500, `
        <path d="M80,185 L220,185 L268,478 Q150,500 32,478 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <path d="M118,30 L150,132 L182,30 L232,44 Q250,52 254,74 L258,110 L232,114 L228,96 L222,190 L78,190 L72,96 L68,114 L42,110 L46,74 Q50,52 68,44 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <path d="M118,30 L150,132 L182,30" stroke="${d}" stroke-width="5" fill="none"/>
        <rect x="78" y="178" width="144" height="14" fill="${d}"/>`);
  },
  blazer(c) {
    const d = shade(c, 0.3);
    return svg(330, `
        <path d="M120,30 L180,30 L232,42 Q254,50 258,82 L268,290 L238,292 L232,124 L234,322 L66,322 L68,124 L62,292 L32,290 L42,82 Q46,50 68,42 Z" fill="${c}" stroke="${d}" stroke-width="2" fill-opacity=".94"/>
        <path d="M120,30 L150,162 L128,104 L104,74 L118,62 L108,40 Z M180,30 L150,162 L172,104 L196,74 L182,62 L192,40 Z" fill="${d}" opacity=".6"/>
        <path d="M150,162 V322 M80,252 H128 M172,252 H220" stroke="${d}" stroke-width="3" fill="none"/>
        <circle cx="157" cy="194" r="5" fill="${d}"/><circle cx="157" cy="238" r="5" fill="${d}"/>`);
  },
  puffer(c) {
    const d = shade(c, 0.3);
    return svg(330, `
        <path d="M118,26 L182,26 L234,44 Q262,54 266,90 L276,292 L240,296 L234,128 L238,330 L62,330 L66,128 L60,296 L24,292 L34,90 Q38,54 66,44 Z" fill="${c}" stroke="${d}" stroke-width="2" fill-opacity=".94"/>
        <g stroke="${d}" stroke-width="3" stroke-opacity=".7" fill="none"><path d="M66,90 H234 M66,140 H234 M66,190 H236 M64,240 H236 M62,290 H238 M150,26 V330"/></g>`);
  },
  trouser(c) {
    const d = shade(c, 0.28);
    return svg(300, `
        <path d="M72,0 H228 L240,298 H162 L150,96 L138,298 H60 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <rect x="72" y="0" width="156" height="12" fill="${d}" opacity=".6"/>
        <path d="M150,12 V96" stroke="${d}" stroke-width="3" fill="none"/>`);
  },
  skirt(c) {
    const d = shade(c, 0.28);
    return svg(210, `
        <path d="M74,0 H226 L254,206 H46 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <rect x="74" y="0" width="152" height="12" fill="${d}" opacity=".6"/>
        <path d="M150,12 V206" stroke="${d}" stroke-width="2" stroke-opacity=".4" fill="none"/>`);
  },
};

export function garmentDataUri(style: GarmentStyle, colorHex: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DRAW[style](colorHex))}`;
}
