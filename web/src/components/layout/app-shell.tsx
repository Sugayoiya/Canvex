"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ob-surface-base)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Topbar />
        <main
          style={{
            flex: 1,
            padding: "24px 32px",
            overflowY: "auto",
            backgroundImage: "var(--ob-dot-grid)",
            backgroundSize: "var(--ob-dot-grid-size)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
