// Shared app shell: runs the merged flow, or one feature standalone for development.
// Do not edit from a feature account.
import { useMemo, useState } from "react";
import IntakeShortlist from "../features/intake-shortlist";
import TryOn from "../features/try-on";
import StockPriceHandoff from "../features/stock-price-handoff";
import { CONTRACT_VERSION, type FeatureComponent, type FeatureId, type NavTarget, type ShopperSession } from "../shared/types";
import { createSampleDataProvider } from "../shared/sampleData";
import { makeEmptySession, makeStandaloneSession } from "../shared/fixtures";

const FEATURES: Record<FeatureId, { label: string; Component: FeatureComponent }> = {
  "intake-shortlist": { label: "1. Tell us what you need", Component: IntakeShortlist },
  "try-on": { label: "2. Preview the fit", Component: TryOn },
  "stock-price-handoff": { label: "3. Hold, price & checkout", Component: StockPriceHandoff },
};
const ORDER: FeatureId[] = ["intake-shortlist", "try-on", "stock-price-handoff"];

type Mode = "flow" | FeatureId;

export default function AppShell() {
  const data = useMemo(() => createSampleDataProvider(), []);
  const [mode, setMode] = useState<Mode>("flow");
  const [step, setStep] = useState<NavTarget>("intake-shortlist");
  const [session, setSession] = useState<ShopperSession>(makeEmptySession());

  const onUpdate = (patch: Partial<ShopperSession>) => setSession((s) => ({ ...s, ...patch }));
  const onNavigate = (to: NavTarget) => setStep(to);

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === "flow") { setSession(makeEmptySession()); setStep("intake-shortlist"); }
    else { setSession(makeStandaloneSession(m)); setStep(m); }
  };

  // Restarting creates a new sessionId, which remounts the feature and discards any try-on photo.
  const restart = () => switchMode(mode);

  const current = step === "done" ? null : FEATURES[step];

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <div role="note" style={{ background: "var(--color-sample-bg)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
        <strong>SAMPLE DATA</strong> — workshop prototype. Products, stores, stock, offers and prices are invented and are not real Macy's data.
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap", fontSize: 13 }}>
        <label htmlFor="mode">Dev view:</label>
        <select id="mode" value={mode} onChange={(e: { target: { value: string } }) => switchMode(e.target.value as Mode)}>
          <option value="flow">Full flow (merged app)</option>
          {ORDER.map((id) => <option key={id} value={id}>Standalone: {id}</option>)}
        </select>
        <button onClick={restart}>Restart session</button>
      </div>

      {mode === "flow" && (
        <ol style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "0 0 12px", fontSize: 12 }}>
          {ORDER.map((id) => (
            <li key={id} style={{ flex: 1, padding: 6, borderRadius: 6, textAlign: "center",
              background: step === id ? "var(--color-navy)" : "var(--color-border)", color: step === id ? "#fff" : "inherit" }}>
              {FEATURES[id].label}
            </li>
          ))}
        </ol>
      )}

      {session.contractVersion !== CONTRACT_VERSION && (
        <div role="alert" style={{ color: "var(--color-danger)" }}>
          Contract version mismatch: session {session.contractVersion}, app {CONTRACT_VERSION}.
        </div>
      )}

      {current ? (
        <current.Component key={`${mode}-${step}-${session.sessionId}`} session={session} data={data} onUpdate={onUpdate} onNavigate={onNavigate} />
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
          <h2>All set</h2>
          <p>Thanks for shopping. Your session data is cleared when you restart.</p>
          <details>
            <summary>Merchant view: missed demand logged this session ({session.missedDemand.length})</summary>
            <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(session.missedDemand, null, 2)}</pre>
          </details>
          <button onClick={restart}>Start a new session</button>
        </div>
      )}

      <details style={{ marginTop: 16, fontSize: 12 }}>
        <summary>Debug: current session</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(session, null, 2)}</pre>
      </details>
    </div>
  );
}
