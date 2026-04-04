"use client";

import { AppShell } from "@/components/layout/app-shell";
import { BillingDashboard } from "@/components/billing/billing-dashboard";

export default function BillingPage() {
  return (
    <AppShell>
      <BillingDashboard />
    </AppShell>
  );
}
