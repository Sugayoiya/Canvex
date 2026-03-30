"use client";

import { useState } from "react";

interface UsageTableProps {
  data: Array<{
    provider: string;
    model: string;
    total_calls: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost: number;
  }>;
}

type SortKey = "provider" | "model" | "total_calls" | "tokens" | "total_cost" | "avg";
type SortDir = "asc" | "desc";

function formatCost(n: number): string {
  return `¥${n.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsageTable({ data }: UsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("total_cost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "provider":
        return mul * a.provider.localeCompare(b.provider);
      case "model":
        return mul * a.model.localeCompare(b.model);
      case "total_calls":
        return mul * (a.total_calls - b.total_calls);
      case "tokens":
        return (
          mul *
          (a.total_input_tokens +
            a.total_output_tokens -
            (b.total_input_tokens + b.total_output_tokens))
        );
      case "total_cost":
        return mul * (Number(a.total_cost) - Number(b.total_cost));
      case "avg": {
        const avgA = a.total_calls > 0 ? Number(a.total_cost) / a.total_calls : 0;
        const avgB = b.total_calls > 0 ? Number(b.total_cost) / b.total_calls : 0;
        return mul * (avgA - avgB);
      }
      default:
        return 0;
    }
  });

  const columns: { key: SortKey; label: string; width: number; align: "left" | "right" }[] = [
    { key: "provider", label: "Provider", width: 120, align: "left" },
    { key: "model", label: "Model", width: 160, align: "left" },
    { key: "total_calls", label: "调用次数", width: 100, align: "right" },
    { key: "tokens", label: "Token 用量", width: 120, align: "right" },
    { key: "total_cost", label: "费用", width: 100, align: "right" },
    { key: "avg", label: "平均/次", width: 100, align: "right" },
  ];

  return (
    <div
      style={{
        background: "var(--cv4-surface-primary)",
        border: "1px solid var(--cv4-border-default)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          color: "var(--cv4-text-primary)",
          lineHeight: 1.3,
          display: "block",
          marginBottom: 16,
        }}
      >
        使用明细
      </span>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                background: "var(--cv4-surface-secondary)",
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    width: col.width,
                    textAlign: col.align,
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: "var(--cv4-text-muted)",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    lineHeight: 1.0,
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    textAlign: "center",
                    padding: 24,
                    color: "var(--cv4-text-disabled)",
                    fontSize: 13,
                  }}
                >
                  暂无数据
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => {
                const tokens = row.total_input_tokens + row.total_output_tokens;
                const avg =
                  row.total_calls > 0
                    ? Number(row.total_cost) / row.total_calls
                    : 0;
                return (
                  <tr
                    key={`${row.provider}-${row.model}-${i}`}
                    style={{
                      borderBottom: "1px solid var(--cv4-border-subtle)",
                      height: 48,
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--cv4-hover-highlight)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontFamily: "Manrope, sans-serif",
                        color: "var(--cv4-text-primary)",
                      }}
                    >
                      {row.provider}
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontFamily: "Manrope, sans-serif",
                        color: "var(--cv4-text-primary)",
                      }}
                    >
                      {row.model}
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontFamily: "Manrope, sans-serif",
                        color: "var(--cv4-text-primary)",
                        textAlign: "right",
                      }}
                    >
                      {row.total_calls.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontFamily: "Manrope, sans-serif",
                        color: "var(--cv4-text-primary)",
                        textAlign: "right",
                      }}
                    >
                      {formatTokens(tokens)}
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontFamily: "Manrope, sans-serif",
                        color: "var(--cv4-text-primary)",
                        textAlign: "right",
                      }}
                    >
                      {formatCost(Number(row.total_cost))}
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontFamily: "Manrope, sans-serif",
                        color: "var(--cv4-text-muted)",
                        textAlign: "right",
                      }}
                    >
                      {formatCost(avg)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
