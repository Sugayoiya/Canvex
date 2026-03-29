export type NodeExecutionStatus = "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked";

const STATUS_CONFIG: Record<NodeExecutionStatus, { color: string; label: string; animate?: boolean }> = {
  idle:      { color: "var(--cv4-text-disabled)", label: "" },
  queued:    { color: "var(--cv4-text-secondary)", label: "排队中" },
  running:   { color: "#F59E0B", label: "执行中", animate: true },
  completed: { color: "#10B981", label: "完成" },
  failed:    { color: "#EF4444", label: "失败" },
  timeout:   { color: "#EF4444", label: "超时" },
  blocked:   { color: "var(--cv4-text-disabled)", label: "阻塞" },
};

export function StatusIndicator({ status }: { status: NodeExecutionStatus }) {
  if (status === "idle") return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="flex items-center gap-1" style={{ fontFamily: "Space Grotesk", fontSize: 9, letterSpacing: 1 }}>
      <span
        className={cfg.animate ? "animate-pulse" : ""}
        style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, display: "inline-block" }}
      />
      <span style={{ color: cfg.color, textTransform: "uppercase", fontWeight: 700 }}>{cfg.label}</span>
    </span>
  );
}
