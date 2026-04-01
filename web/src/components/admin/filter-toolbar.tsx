"use client";

import { Search, X } from "lucide-react";

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
  const hasActiveFilters = filters?.some(
    (f) => f.value !== "" && f.value !== f.options[0]?.value
  );

  const clearAllFilters = () => {
    filters?.forEach((f) => {
      const defaultVal = f.options[0]?.value ?? "";
      if (f.value !== defaultVal) f.onChange(defaultVal);
    });
    if (searchValue) onSearchChange("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative", minWidth: 180 }}>
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
              height: 34,
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-default)",
              borderRadius: 8,
              padding: "0 12px 0 34px",
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

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              height: 34,
              padding: "0 12px",
              background: "transparent",
              border: "1px solid var(--cv4-border-default)",
              borderRadius: 8,
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--cv4-text-secondary)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 100ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--cv4-border-focused)";
              e.currentTarget.style.color = "var(--cv4-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--cv4-border-default)";
              e.currentTarget.style.color = "var(--cv4-text-secondary)";
            }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {filters && filters.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filters.map((filter, idx) => {
            const isNonDefault =
              filter.value !== "" && filter.value !== filter.options[0]?.value;
            return (
              <select
                key={idx}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                style={{
                  height: 30,
                  minWidth: 120,
                  maxWidth: 180,
                  backgroundColor: isNonDefault
                    ? "color-mix(in srgb, var(--cv4-accent) 8%, var(--cv4-surface-primary))"
                    : "var(--cv4-surface-primary)",
                  border: `1px solid ${isNonDefault ? "var(--cv4-accent)" : "var(--cv4-border-default)"}`,
                  borderRadius: 6,
                  padding: "0 24px 0 10px",
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  fontWeight: isNonDefault ? 500 : 400,
                  color: isNonDefault
                    ? "var(--cv4-text-primary)"
                    : "var(--cv4-text-secondary)",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23859399' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                  transition: "all 100ms",
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
      )}
    </div>
  );
}
