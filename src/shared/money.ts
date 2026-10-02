/** Money helpers. Prices are dollars; all sums go through cents to avoid float drift. */
export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const fromCents = (cents: number): number => cents / 100;

export function sumPrices(prices: number[]): number {
  return fromCents(prices.reduce((acc, p) => acc + toCents(p), 0));
}

/** "$1,234.50" — always two decimals so totals line up. */
export function formatPrice(dollars: number): string {
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
