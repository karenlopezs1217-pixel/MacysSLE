// Ready-made sessions so each feature can be built and demoed on its own.
// Do not edit from a feature account.
import { CONTRACT_VERSION, type FeatureId, type ShopperSession } from "./types";

export function makeEmptySession(): ShopperSession {
  return {
    contractVersion: CONTRACT_VERSION,
    sessionId: `sess-${Math.random().toString(36).slice(2, 8)}`,
    request: null,
    shortlist: [],
    selectedOptionId: null,
    selectedProductIds: [],
    tryOn: null,
    holds: [],
    price: null,
    fulfillment: null,
    missedDemand: [],
  };
}

// What Feature A should produce for the demo request:
// "20 minutes, work outfit, size 16, under $150, this store" at Sample Store A.
export const DEMO_REQUEST_TEXT = "20 minutes, work outfit, size 16, under $150, this store";

function afterIntakeShortlist(): ShopperSession {
  return {
    ...makeEmptySession(),
    request: {
      rawText: DEMO_REQUEST_TEXT,
      timeMinutes: 20,
      occasion: "work",
      size: "16",
      budgetMax: 150,
      storeId: "S-A",
      clarifyingQuestion: null,
    },
    shortlist: [
      { id: "OPT1", productIds: ["P01", "P04"], totalPrice: 98, reason: "Both pieces are in stock in size 16 at this store, on one floor, so you can try them on within your 20 minutes.", isBestPick: true },
      { id: "OPT2", productIds: ["P08"], totalPrice: 79, reason: "One piece, no styling needed, and in stock here; it runs slightly large.", isBestPick: false },
      { id: "OPT3", productIds: ["P02", "P05"], totalPrice: 83, reason: "Lowest total price; the top runs small, so try one size up.", isBestPick: false },
    ],
    selectedOptionId: "OPT1",
    selectedProductIds: ["P01", "P04"],
  };
}

function afterTryOn(): ShopperSession {
  return {
    ...afterIntakeShortlist(),
    tryOn: {
      consentGiven: true,
      results: [
        { productId: "P01", recommendedSize: "16", fitNote: "True to size, relaxed through the body", isSimulation: true },
        { productId: "P04", recommendedSize: "16", fitNote: "True to size, hemmable length", isSimulation: true },
      ],
    },
  };
}

// Extra scenarios for testing stock-price-handoff edge cases standalone.
// "fallback-nearby": sheath dress P07 size 16 is out at Store A but in stock at Store B.
// "out-everywhere": blazer P09 size 16 is out at all stores, so ship-to-home is the only path.
// "best-offer": blazer P09 size 18 + knit top P02 size 16 ($133), where the $15-off-$100 offer beats 20% off tops.
export type HandoffScenario = "default" | "fallback-nearby" | "out-everywhere" | "best-offer";

export function makeHandoffScenario(name: HandoffScenario): ShopperSession {
  const base = afterTryOn();
  const tryOn = (results: { productId: string; recommendedSize: string; fitNote: string }[]) =>
    ({ consentGiven: true, results: results.map((r) => ({ ...r, isSimulation: true as const })) });
  switch (name) {
    case "default":
      return base;
    case "fallback-nearby":
      return { ...base, selectedOptionId: null, selectedProductIds: ["P07"],
        tryOn: tryOn([{ productId: "P07", recommendedSize: "16", fitNote: "True to size, structured fit" }]) };
    case "out-everywhere":
      return { ...base, selectedOptionId: null, selectedProductIds: ["P09"], tryOn: null };
    case "best-offer":
      return { ...base, selectedOptionId: null, selectedProductIds: ["P09", "P02"],
        tryOn: tryOn([
          { productId: "P09", recommendedSize: "18", fitNote: "Runs small in the shoulders, size up" },
          { productId: "P02", recommendedSize: "16", fitNote: "Runs small, size up" },
        ]) };
  }
}

export function makeStandaloneSession(featureId: FeatureId): ShopperSession {
  switch (featureId) {
    case "intake-shortlist":
      return makeEmptySession();
    case "try-on":
      return afterIntakeShortlist();
    case "stock-price-handoff":
      return afterTryOn();
  }
}
