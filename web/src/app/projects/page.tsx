"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { skillsApi } from "@/lib/api";

interface SkillInfo {
  name: string;
  display_name: string;
  description: string;
  category: string;
  execution_mode: string;
  estimated_duration: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      skillsApi
        .list()
        .then((res) => setSkills(res.data))
        .catch(() => {});
    }
  }, [mounted, isAuthenticated]);

  if (!mounted || !isAuthenticated) return null;

  const categoryColors: Record<string, string> = {
    TEXT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    EXTRACT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    CANVAS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    ASSET: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Canvas Studio
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user?.nickname || user?.email}
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">工作台</h2>
          <p className="mt-1 text-gray-500">
            通过 Skill 系统和 AI Agent 编排你的创作流程
          </p>
        </div>

        <section>
          <h3 className="text-lg font-semibold mb-4">
            已注册 Skills ({skills.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold">{skill.display_name}</h4>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[skill.category] || "bg-gray-100 text-gray-600"}`}
                  >
                    {skill.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {skill.description}
                </p>
                <div className="flex gap-2 text-xs text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                    {skill.execution_mode}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                    {skill.estimated_duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {skills.length === 0 && (
            <p className="text-gray-400 text-sm">
              尚未加载到 Skills，请确保后端已启动。
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
