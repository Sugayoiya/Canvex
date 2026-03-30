"use client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ob-surface-base)",
        backgroundImage: "var(--ob-dot-grid)",
        backgroundSize: "var(--ob-dot-grid-size)",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}
