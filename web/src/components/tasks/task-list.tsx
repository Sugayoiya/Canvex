"use client";

import { StatusBadge } from "./status-badge";

interface Task {
  id: string;
  skill_name: string;
  skill_category: string;
  status: string;
  duration_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: string | null;
  queued_at: string | null;
  completed_at: string | null;
  user_nickname?: string;
  project_id: string | null;
}

interface TaskListProps {
  tasks: Task[];
  isAdmin: boolean;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

const headerStyle: React.CSSProperties = {
  fontFamily: "Space Grotesk, sans-serif",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--cv4-text-muted)",
  padding: "8px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellStyle: React.CSSProperties = {
  fontFamily: "Manrope, sans-serif",
  fontSize: 13,
  padding: "0 12px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const monoCell: React.CSSProperties = {
  ...cellStyle,
  fontFamily: "Space Grotesk, sans-serif",
  color: "var(--cv4-text-muted)",
};

export function TaskList({ tasks, isAdmin }: TaskListProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--cv4-border-default)",
            }}
          >
            <th style={{ ...headerStyle, width: 80 }}>状态</th>
            <th style={{ ...headerStyle, width: 200 }}>技能名称</th>
            {isAdmin && <th style={{ ...headerStyle, width: 120 }}>用户</th>}
            <th style={{ ...headerStyle, width: 160 }}>项目</th>
            <th style={{ ...headerStyle, width: 80 }}>耗时</th>
            <th style={{ ...headerStyle, width: 80 }}>Token</th>
            <th style={{ ...headerStyle, width: 80 }}>费用</th>
            <th style={{ ...headerStyle, width: 140 }}>时间</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              style={{
                height: 48,
                borderBottom: "1px solid var(--cv4-border-subtle)",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cv4-hover-highlight)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <td style={{ ...cellStyle, width: 80 }}>
                <StatusBadge status={task.status} />
              </td>
              <td
                style={{
                  ...cellStyle,
                  width: 200,
                  color: "var(--cv4-text-primary)",
                  maxWidth: 200,
                }}
              >
                {task.skill_name}
              </td>
              {isAdmin && (
                <td
                  style={{
                    ...cellStyle,
                    width: 120,
                    color: "var(--cv4-text-secondary)",
                  }}
                >
                  {task.user_nickname ?? "—"}
                </td>
              )}
              <td
                style={{
                  ...cellStyle,
                  width: 160,
                  color: "var(--cv4-text-secondary)",
                  maxWidth: 160,
                }}
              >
                {task.project_id ?? "—"}
              </td>
              <td style={{ ...monoCell, width: 80 }}>
                {formatDuration(task.duration_ms)}
              </td>
              <td style={{ ...monoCell, width: 80 }}>
                {task.total_input_tokens + task.total_output_tokens}
              </td>
              <td style={{ ...monoCell, width: 80 }}>
                {task.total_cost ?? "—"}
              </td>
              <td
                style={{
                  ...monoCell,
                  width: 140,
                  color: "var(--cv4-text-disabled)",
                }}
              >
                {relativeTime(task.queued_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
