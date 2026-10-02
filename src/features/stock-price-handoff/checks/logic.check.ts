// Verifies Components 4 + 5 against the spec's test scenarios (docs/feature-C-stock-price-handoff.md).
// Run: npx esbuild src/features/stock-price-handoff/checks/logic.check.ts --bundle --platform=node --log-level=warning | node
import { createSampleDataProvider } from "../../../shared/sampleData";
import { makeHandoffScenario, type HandoffScenario } from "../../../shared/fixtures";
import type { Offer, Product } from "../../../shared/types";
import {
  adjacentSizeInStock, computePrice, createHold, findFallbackStore, formatDay, getStock, missedDemandFor,
  pickupReadyBy, pickupStoresForAll, resolveLines, shipEta,
} from "../logic";

declare const process: { exitCode: number };
const data = createSampleDataProvider();
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const load = (s: HandoffScenario) => {
  const session = makeHandoffScenario(s);
  const { lines } = resolveLines(session, data, {});
  return { session, lines, price: computePrice(lines.map((l) => l.product), data.getOffers(), data.now()) };
};

// default
{
  const { lines, price } = load("default");
  check("default: sizes 16/16", lines.map((l) => l.size).join() === "16,16");
  const s1 = getStock(data, "S-A", "P01", "16"), s4 = getStock(data, "S-A", "P04", "16");
  check("default: blouse in stock, floor 2", s1.level === "in-stock" && s1.floor === "2" && s1.department === "Women's Career & Tops");
  check("default: trouser last one", s4.level === "last-one");
  check("default: subtotal 98 / discount 19.60 / pay 78.40", price.subtotal === 98 && price.discount === 19.6 && price.youPay === 78.4, JSON.stringify(price));
  check("default: O1 applied", price.appliedOffer?.id === "O1");
  check("default: min-spend note", price.notes.some((n) => n.includes("Minimum spend $100 not met")));
  check("default: sign-in note", price.notes.some((n) => n.includes("Requires sign-in")));
  check("default: no shoe note (no shoes in bag)", !price.notes.some((n) => n.includes("Starts Oct 15")));
  check("default: pay-here store list includes S-A first", pickupStoresForAll(data, lines, "S-A")[0]?.id === "S-A");
}
// fallback-nearby
{
  const { lines, price, session } = load("fallback-nearby");
  check("fallback: P07 out at S-A", getStock(data, "S-A", "P07", "16").level === "out");
  const fb = findFallbackStore(data, "S-A", "P07", "16");
  check("fallback: nearest is S-B", fb?.store.id === "S-B");
  check("fallback: ready by Sat Oct 3 12:00 PM", pickupReadyBy(data, "S-B", "S-A").getTime() === new Date(2026, 9, 3, 12, 0).getTime());
  check("fallback: pay 71.20", price.youPay === 71.2 && price.discount === 17.8, JSON.stringify(price));
  const md = missedDemandFor(lines, data, "S-A", session.missedDemand);
  check("fallback: one missed-demand event", md.length === 1 && md[0].reason === "size-out-of-stock" && md[0].productId === "P07");
  check("fallback: dedupes on second call", missedDemandFor(lines, data, "S-A", md).length === 0);
  check("fallback: no fitting-room hold at S-A", createHold(data, "fitting-room", "P07", "16", "S-A", "S-A") === null);
  check("fallback: no fitting-room hold at another store", createHold(data, "fitting-room", "P07", "16", "S-B", "S-A") === null);
  check("fallback: pickup hold at S-B allowed", createHold(data, "pickup", "P07", "16", "S-B", "S-A")?.storeId === "S-B");
}
// out-everywhere
{
  const { lines, price } = load("out-everywhere");
  check("out-everywhere: no store has P09/16", findFallbackStore(data, "S-A", "P09", "16") === null && getStock(data, "S-A", "P09", "16").level === "out");
  check("out-everywhere: no pickup store", pickupStoresForAll(data, lines, "S-A").length === 0);
  check("out-everywhere: ETA Wed, Oct 7", formatDay(shipEta(data.now())) === "Wed, Oct 7", formatDay(shipEta(data.now())));
  check("out-everywhere: size 18 in stock here", adjacentSizeInStock(data, "S-A", lines[0].product, "16") === "18");
  check("out-everywhere: pay 99.00, no offer", price.youPay === 99 && price.discount === 0 && price.appliedOffer === null);
  check("out-everywhere: expired outerwear note", price.notes.some((n) => n.includes("Expired Sep 30")));
  check("out-everywhere: O1 not valid on outerwear", price.notes.some((n) => n.includes("Not valid on outerwear")));
  check("out-everywhere: min spend note", price.notes.some((n) => n.includes("Minimum spend $100 not met")));
}
// best-offer
{
  const { lines, price } = load("best-offer");
  check("best-offer: sizes 18/16", lines.map((l) => l.size).join() === "18,16");
  check("best-offer: both in stock here", lines.every((l) => getStock(data, "S-A", l.product.id, l.size!).qty > 0));
  check("best-offer: O2 beats O1, pay 118", price.appliedOffer?.id === "O2" && price.youPay === 118, JSON.stringify(price));
  check("best-offer: O1 marked not combined", price.notes.some((n) => n.includes("not combined")));
}
// failure cases
{
  const shoe = data.getProduct("P11")!;
  const shoePrice = computePrice([shoe], data.getOffers(), data.now());
  check("shoe: $25 offer not yet active", shoePrice.discount === 0 && shoePrice.notes.some((n) => n.includes("Starts Oct 15")));
  check("empty bag: $0", computePrice([], data.getOffers(), data.now()).youPay === 0);
  const fake: Offer = { id: "X", label: "x", type: "amount", value: 500, validFrom: "2026-01-01", validTo: "2026-12-31", requiresLogin: false, stackable: false, isSampleData: true };
  const cheap = data.getProduct("P14")! as Product;
  check("amount discount capped at eligible subtotal", computePrice([cheap], [fake], data.now()).youPay === 0);
  const pct: Offer = { ...fake, type: "percent", value: 33 };
  check("percent discount rounds down (shopper not favored)", computePrice([cheap], [pct], data.now()).discount === 6.27);
  const s = makeHandoffScenario("default");
  const noSize = resolveLines({ ...s, tryOn: null, request: { ...s.request!, size: null } }, data, {});
  check("no size anywhere: line needs a size", noSize.lines.every((l) => l.size === null));
  check("unknown product id reported", resolveLines({ ...s, selectedProductIds: ["NOPE"] }, data, {}).unknownIds[0] === "NOPE");
  const fr = createHold(data, "fitting-room", "P01", "16", "S-A", "S-A")!;
  check("fitting-room hold expires in 30 min", new Date(fr.expiresAt).getTime() - data.now().getTime() === 30 * 60_000 && /^H-\d{4}$/.test(fr.holdId));
}
console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
process.exitCode = failures ? 1 : 0;
