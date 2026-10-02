/// <reference types="vite/client" />
// DEV-ONLY: loads the spec's test scenarios from src/shared/fixtures.ts into the session.
// Hidden in production builds (import.meta.env.DEV is false there).
import { useState } from "react";
import { makeHandoffScenario, type HandoffScenario } from "../../shared/fixtures";
import type { ShopperSession } from "../../shared/types";

const SCENARIOS: { id: HandoffScenario; label: string }[] = [
  { id: "default", label: "default: Blouse + Trouser (16), expect $78.40" },
  { id: "fallback-nearby", label: "fallback-nearby: Sheath Dress (16), expect Store B + $71.20" },
  { id: "out-everywhere", label: "out-everywhere: Blazer (16), expect ship + $99.00" },
  { id: "best-offer", label: "best-offer: Blazer (18) + Knit Top (16), expect $118.00" },
];

export default function DevScenarioSwitcher({ onUpdate }: { onUpdate: (patch: Partial<ShopperSession>) => void }) {
  const [pick, setPick] = useState<HandoffScenario>("default");
  if (!import.meta.env.DEV) return null;
  return (
    <details className="stock-price-handoff__dev">
      <summary>Dev only: test scenarios</summary>
      <div className="stock-price-handoff__dev-row">
        <label htmlFor="sph-scenario" className="mc-visually-hidden">Scenario</label>
        <select id="sph-scenario" className="stock-price-handoff__select" value={pick}
          onChange={(e) => setPick(e.target.value as HandoffScenario)}>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {/* A scenario has a new sessionId, so the shell remounts this feature with clean local state. */}
        <button type="button" className="mc-btn mc-btn--small" onClick={() => onUpdate(makeHandoffScenario(pick))}>Load</button>
      </div>
    </details>
  );
}
