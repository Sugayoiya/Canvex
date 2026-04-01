"use client";

import { AdminGuard } from "@/components/auth/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { Toaster } from "sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--cv4-surface-primary)",
            color: "var(--cv4-text-primary)",
            border: "1px solid var(--cv4-border-default)",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            borderRadius: 8,
          },
        }}
      />
    </AdminGuard>
  );
}
