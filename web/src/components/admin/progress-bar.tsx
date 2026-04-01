"use client";

interface ProgressBarProps {
  current: number;
  limit: number | null;
  label: string;
  formatValue?: (current: number, limit: number | null) => string;
}

function getThresholdColor(percent: number): string {
  if (percent >= 85) return "var(--ob-error)";
  if (percent >= 60) return "var(--ob-tertiary)";
  return "var(--ob-success)";
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function ProgressBar({
  current,
  limit,
  label,
  formatValue,
}: ProgressBarProps) {
  if (limit === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            padding: "4px 8px",
            borderRadius: 6,
            background: "var(--cv4-hover-highlight)",
            color: "var(--cv4-text-secondary)",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            whiteSpace: "nowrap",
          }}
        >
          Unlimited
        </span>
      </div>
    );
  }

  const percent = limit > 0 ? (current / limit) * 100 : 0;
  const clampedPercent = Math.min(100, percent);
  const color = getThresholdColor(percent);
  const valueText = formatValue
    ? formatValue(current, limit)
    : `${formatNumber(current)} / ${formatNumber(limit)}`;

  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-label={label}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color,
          }}
        >
          {Math.round(percent)}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "var(--cv4-border-default)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 8,
            borderRadius: 4,
            width: `${clampedPercent}%`,
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--cv4-text-primary)",
        }}
      >
        {valueText}
      </span>
    </div>
  );
}
