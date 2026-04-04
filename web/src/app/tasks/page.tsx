"use client";

import { AppShell } from "@/components/layout/app-shell";
import { TaskMonitorPage } from "@/components/tasks/task-monitor-page";

export default function TasksPage() {
  return (
    <AppShell>
      <TaskMonitorPage />
    </AppShell>
  );
}
