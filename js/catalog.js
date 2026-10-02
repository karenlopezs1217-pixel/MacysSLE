/*
 * Demo catalog. Brands, prices, review counts and floor stock are mock data.
 *
 * Every garment SVG shares one coordinate system so the stage can place any
 * item the same way: 300 units wide, centered on x=150, with the shoulder
 * seams at y=40 and 160 units apart (x=70 to x=230).
 */
(function (root) {
  'use strict';

  const GARMENT = { width: 300, shoulderY: 40, shoulderSpan: 160 };

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  function svg(height, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${height}" viewBox="0 0 300 ${height}">${body}</svg>`;
  }

  const DRAW = {
    sweater(c) {
      const d = shade(c, 0.22);
      return svg(300, `
        <path d="M122,30 Q150,62 178,30 L232,42 Q252,50 256,80 L266,252 L238,254 L232,120 L230,292 L70,292 L68,120 L62,254 L34,252 L44,80 Q48,50 68,42 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <g stroke="${d}" stroke-opacity=".35" stroke-width="2" fill="none">
          <path d="M100,70 V280 M125,74 V280 M150,78 V280 M175,74 V280 M200,70 V280"/>
        </g>
        <path d="M122,30 Q150,62 178,30" stroke="${d}" stroke-width="9" fill="none"/>
        <rect x="70" y="276" width="160" height="16" fill="${d}" opacity=".55"/>
        <path d="M35,238 L63,240 L62,254 L34,252 Z M237,240 L265,238 L266,252 L238,254 Z" fill="${d}" opacity=".55"/>`);
    },
    dress(c) {
      const d = shade(c, 0.25);
      return svg(500, `
        <path d="M80,185 L220,185 L268,478 Q150,500 32,478 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <path d="M118,30 L150,132 L182,30 L232,44 Q250,52 254,74 L258,110 L232,114 L228,96 L222,190 L78,190 L72,96 L68,114 L42,110 L46,74 Q50,52 68,44 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <path d="M118,30 L150,132 L182,30" stroke="${d}" stroke-width="5" fill="none"/>
        <path d="M150,132 L214,186 M204,190 L176,490" stroke="${d}" stroke-width="3" stroke-opacity=".6" fill="none"/>
        <rect x="78" y="178" width="144" height="14" fill="${d}"/>
        <path d="M206,190 L222,250 L212,252 Z M214,190 L238,240 L228,244 Z" fill="${d}"/>`);
    },
    blazer(c) {
      const d = shade(c, 0.3);
      return svg(330, `
        <path d="M120,30 L180,30 L232,42 Q254,50 258,82 L268,290 L238,292 L232,124 L234,322 L66,322 L68,124 L62,292 L32,290 L42,82 Q46,50 68,42 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <path d="M120,30 L180,30 L150,162 Z" fill="#f3efe8"/>
        <path d="M120,30 L150,162 L128,104 L104,74 L118,62 L108,40 Z M180,30 L150,162 L172,104 L196,74 L182,62 L192,40 Z" fill="${d}" opacity=".6"/>
        <path d="M150,162 V322 M80,252 H128 M172,252 H220" stroke="${d}" stroke-width="3" fill="none"/>
        <circle cx="157" cy="194" r="5" fill="${d}"/><circle cx="157" cy="238" r="5" fill="${d}"/>`);
    },
    puffer(c) {
      const d = shade(c, 0.3);
      return svg(330, `
        <path d="M118,26 L182,26 L234,44 Q262,54 266,90 L276,292 L240,296 L234,128 L238,330 L62,330 L66,128 L60,296 L24,292 L34,90 Q38,54 66,44 Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <rect x="116" y="6" width="68" height="32" rx="10" fill="${d}"/>
        <g stroke="${d}" stroke-width="3" stroke-opacity=".7" fill="none">
          <path d="M66,90 H234 M66,140 H234 M66,190 H236 M64,240 H236 M62,290 H238"/>
          <path d="M30,150 H62 M28,210 H62 M238,150 H270 M238,210 H272"/>
          <path d="M150,26 V330"/>
        </g>`);
    },
  };

  const PRODUCTS = [
    {
      id: 'wrap-dress',
      name: 'Wrap Midi Dress',
      brand: 'Avery Lane',
      price: 89.5,
      category: 'dress',
      garment: 'dress',
      cut: 'slim',
      stretch: 'none',
      lengthSensitive: true,
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      reviews: { runsSmall: 842, trueToSize: 318, runsLarge: 80 },
      fitAreas: ['Bust', 'Waist', 'Hips', 'Length'],
      areaOffsets: { Hips: 0.5 },
      colors: [
        { name: 'Ruby', hex: '#C8102E' },
        { name: 'Emerald', hex: '#1E6B52' },
        { name: 'Black', hex: '#1F1F1F' },
      ],
      stock: { XS: 2, S: 4, M: 3, L: 0, XL: 1 },
    },
    {
      id: 'crew-sweater',
      name: 'Cable-Knit Crewneck Sweater',
      brand: 'Hearth & Co.',
      price: 59.5,
      category: 'top',
      garment: 'sweater',
      cut: 'regular',
      stretch: 'some',
      lengthSensitive: false,
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      reviews: { runsSmall: 120, trueToSize: 780, runsLarge: 90 },
      fitAreas: ['Shoulders', 'Chest', 'Sleeves', 'Length'],
      colors: [
        { name: 'Ivory', hex: '#E9E1CF' },
        { name: 'Navy', hex: '#1F2A44' },
        { name: 'Berry', hex: '#8C1D40' },
      ],
      stock: { XS: 5, S: 6, M: 8, L: 4, XL: 2, XXL: 1 },
    },
    {
      id: 'puffer',
      name: 'Quilted Puffer Jacket',
      brand: 'Northline',
      price: 149,
      category: 'outerwear',
      garment: 'puffer',
      cut: 'relaxed',
      stretch: 'none',
      lengthSensitive: false,
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      reviews: { runsSmall: 40, trueToSize: 210, runsLarge: 388 },
      fitAreas: ['Shoulders', 'Chest', 'Sleeves', 'Length'],
      colors: [
        { name: 'Black', hex: '#222222' },
        { name: 'Camel', hex: '#B08A5A' },
        { name: 'Sage', hex: '#8A9A7B' },
      ],
      stock: { XS: 1, S: 3, M: 2, L: 2, XL: 0, XXL: 0 },
    },
    {
      id: 'blazer',
      name: 'Tailored One-Button Blazer',
      brand: 'Studio 34',
      price: 119,
      category: 'outerwear',
      garment: 'blazer',
      cut: 'slim',
      stretch: 'some',
      lengthSensitive: false,
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      reviews: { runsSmall: 9, trueToSize: 11, runsLarge: 2 },
      fitAreas: ['Shoulders', 'Chest', 'Sleeves', 'Length'],
      areaOffsets: { Shoulders: 0.25 },
      colors: [
        { name: 'Charcoal', hex: '#3A3D42' },
        { name: 'Camel', hex: '#B9925E' },
        { name: 'Ivory', hex: '#ECE6D8' },
      ],
      stock: { XS: 0, S: 2, M: 3, L: 2, XL: 1 },
    },
  ];

  function garmentSvg(product, colorHex) {
    return DRAW[product.garment](colorHex);
  }

  function garmentDataUri(product, colorHex) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(garmentSvg(product, colorHex))}`;
  }

  root.Catalog = { GARMENT, PRODUCTS, garmentSvg, garmentDataUri };
})(typeof self !== 'undefined' ? self : this);
