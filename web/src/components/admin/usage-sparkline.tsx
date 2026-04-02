"use client";

interface UsageSparklineProps {
  data: Array<{ hour: string; count: number }>;
  width?: number;
  height?: number;
}

export function UsageSparkline({
  data,
  width = 192,
  height = 40,
}: UsageSparklineProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 10,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
          }}
        >
          No usage data yet
        </span>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));
  const barWidth = 6;
  const barGap = 2;
  const barMaxHeight = 32;
  const bottomPadding = 8;

  const bars = data.slice(-24);

  return (
    <div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Usage trend: ${total} requests in last 24 hours`}
      >
        {bars.map((d, i) => {
          const barHeight =
            d.count === 0 ? 2 : (d.count / maxCount) * barMaxHeight;
          const x = i * (barWidth + barGap);
          const y = height - bottomPadding - barHeight;
          const opacity = d.count === 0 ? 0.3 : 1;

          return (
            <rect
              key={d.hour}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill="var(--cv4-text-secondary)"
              opacity={opacity}
            />
          );
        })}
      </svg>
      <div
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 10,
          fontWeight: 400,
          color: "var(--cv4-text-muted)",
          marginTop: 2,
        }}
      >
        requests/hr
      </div>
    </div>
  );
}
