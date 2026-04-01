"use client";

import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AdminTopbar />
        <main
          style={{
            flex: 1,
            padding: 32,
            overflowY: "auto",
            background: "var(--cv4-canvas-bg)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
