// STUB for feature "intake-shortlist". The builder for this feature replaces this file
// (and adds files in this folder). See docs/ for the spec. Keep the default export.
import type { FeatureProps } from "../../shared/types";

const NEXT = { "intake-shortlist": "try-on", "try-on": "stock-price-handoff", "stock-price-handoff": "done" } as const;

export default function Feature({ session, onNavigate }: FeatureProps) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
      <p><strong>intake-shortlist</strong> is not built yet (stub).</p>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Session has {session.selectedProductIds.length} selected product(s).</p>
      <button onClick={() => onNavigate(NEXT["intake-shortlist"])}>Skip to next step</button>
    </div>
  );
}
