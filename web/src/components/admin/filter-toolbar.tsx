"use client";

import { Search } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
  }>;
}

export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
}: FilterToolbarProps) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--cv4-text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          role="searchbox"
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: "100%",
            height: 36,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-default)",
            borderRadius: 8,
            padding: "0 12px 0 36px",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-primary)",
            outline: "none",
            transition: "border-color 100ms",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--cv4-border-focused)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--cv4-border-default)";
          }}
        />
      </div>

      {filters?.map((filter, idx) => {
        const isNonDefault = filter.value !== "" && filter.value !== filter.options[0]?.value;
        return (
          <select
            key={idx}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            style={{
              height: 36,
              width: 140,
              background: "var(--cv4-surface-primary)",
              border: `1px solid ${isNonDefault ? "var(--cv4-border-focused)" : "var(--cv4-border-default)"}`,
              borderRadius: 8,
              padding: "0 12px",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: isNonDefault
                ? "var(--cv4-text-primary)"
                : "var(--cv4-text-secondary)",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23859399' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      })}
    </div>
  );
}
