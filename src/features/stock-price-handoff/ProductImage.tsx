// Placeholder product art drawn from the SAMPLE catalog's swatchHex. No real product photos or logos.
import type { Product } from "../../shared/types";

const SHAPES: Record<Product["category"], string> = {
  top: "M30 22 L45 14 Q50 20 55 14 L70 22 L80 40 L70 45 L68 38 L68 86 L32 86 L32 38 L30 45 L20 40 Z",
  bottom: "M33 14 L67 14 L72 88 L54 88 L50 40 L46 88 L28 88 Z",
  dress: "M40 12 L60 12 L62 30 L76 88 L24 88 L38 30 Z",
  outerwear: "M30 16 L44 12 L50 40 L56 12 L70 16 L82 46 L72 50 L70 40 L70 88 L30 88 L30 40 L28 50 L18 46 Z",
  shoes: "M18 62 L44 58 Q52 70 70 70 L84 72 Q86 82 80 82 L18 82 Z",
  accessory: "M30 20 Q50 70 70 20 M36 44 L50 62 L64 44 L50 78 Z",
};

export default function ProductImage({ product, size = 88 }: { product: Product; size?: number }) {
  return (
    <svg
      className="stock-price-handoff__img"
      width={size} height={Math.round(size * 1.15)} viewBox="0 0 100 115"
      role="img" aria-label={`Placeholder image of ${product.name} (sample)`}
    >
      <rect width="100" height="115" rx="8" fill="#F5F5F5" />
      <path d={SHAPES[product.category]} fill={product.swatchHex} stroke="#000" strokeOpacity=".35" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="50" y="106" textAnchor="middle" fontSize="9" fill="#555">Sample image</text>
    </svg>
  );
}
