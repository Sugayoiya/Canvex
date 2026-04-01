"use client";

import { CreditCard } from "lucide-react";

export default function AdminPricingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h1
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Pricing
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            lineHeight: 1.5,
            margin: "4px 0 0",
          }}
        >
          Manage pricing settings and configurations
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 64,
          borderRadius: 12,
          background: "var(--cv4-surface-primary)",
          border: "1px solid var(--cv4-border-subtle)",
        }}
      >
        <CreditCard size={48} style={{ color: "var(--cv4-text-muted)", marginBottom: 16, opacity: 0.5 }} />
        <p
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            margin: 0,
          }}
        >
          Coming in Phase 10
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            margin: "8px 0 0",
          }}
        >
          This section will be available after the current phase is complete.
        </p>
      </div>
    </div>
  );
}
