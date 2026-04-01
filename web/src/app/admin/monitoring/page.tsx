"use client";

import { useState } from "react";
import { ListTodo, Cpu, Zap, TrendingUp } from "lucide-react";
import { TabBar } from "@/components/admin/tab-bar";
import { TaskLogTable } from "@/components/admin/task-log-table";
import { AiCallLogTable } from "@/components/admin/ai-call-log-table";
import { SkillLogTable } from "@/components/admin/skill-log-table";
import { AdminUsageCostTab } from "@/components/admin/admin-usage-cost-tab";

const MONITORING_TABS = [
  { id: "tasks", label: "Tasks", icon: <ListTodo size={14} /> },
  { id: "ai-calls", label: "AI Calls", icon: <Cpu size={14} /> },
  { id: "skills", label: "Skills", icon: <Zap size={14} /> },
  { id: "usage", label: "Usage & Cost", icon: <TrendingUp size={14} /> },
];

export default function AdminMonitoringPage() {
  const [activeTab, setActiveTab] = useState<string>("tasks");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h1
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Monitoring
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            lineHeight: 1.5,
            margin: "4px 0 0",
          }}
        >
          Task execution, AI calls, skill logs, and usage analytics
        </p>
      </div>
      <TabBar
        tabs={MONITORING_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "tasks" && <TaskLogTable />}
      {activeTab === "ai-calls" && <AiCallLogTable />}
      {activeTab === "skills" && <SkillLogTable />}
      {activeTab === "usage" && <AdminUsageCostTab />}
    </div>
  );
}
