"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { BillingDashboard } from "@/components/billing/billing-dashboard";

export default function BillingPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <BillingDashboard />
      </div>
    </div>
  );
}
