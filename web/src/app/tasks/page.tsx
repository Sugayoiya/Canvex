"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { TaskMonitorPage } from "@/components/tasks/task-monitor-page";

export default function TasksPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <TaskMonitorPage />
      </div>
    </div>
  );
}
