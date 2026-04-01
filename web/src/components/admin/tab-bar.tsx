"use client";

import type { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        borderBottom: "1px solid var(--cv4-border-default)",
        height: 40,
        marginBottom: 16,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => {
              const idx = tabs.findIndex((t) => t.id === tab.id);
              if (e.key === "ArrowRight" && idx < tabs.length - 1) {
                onTabChange(tabs[idx + 1].id);
              } else if (e.key === "ArrowLeft" && idx > 0) {
                onTabChange(tabs[idx - 1].id);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 40,
              padding: "0 16px",
              background: "transparent",
              border: "none",
              borderBottom: isActive
                ? "2px solid var(--cv4-text-primary)"
                : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              color: isActive
                ? "var(--cv4-text-primary)"
                : "var(--cv4-text-muted)",
              transition: "color 100ms, border-color 100ms",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--cv4-text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--cv4-text-muted)";
              }
            }}
          >
            {tab.icon && (
              <span
                style={{
                  display: "inline-flex",
                  fontSize: 14,
                  width: 14,
                  height: 14,
                }}
              >
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
