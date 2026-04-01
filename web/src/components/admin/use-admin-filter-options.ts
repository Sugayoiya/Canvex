"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";

interface FilterOption {
  value: string;
  label: string;
}

const TIME_RANGE_OPTIONS: FilterOption[] = [
  { value: "", label: "All time" },
  { value: "1h", label: "Last 1 hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const SKILL_NAME_OPTIONS: FilterOption[] = [
  { value: "", label: "All skills" },
  { value: "generate_script", label: "Generate Script" },
  { value: "generate_character", label: "Generate Character" },
  { value: "generate_scene", label: "Generate Scene" },
  { value: "generate_storyboard", label: "Generate Storyboard" },
  { value: "extract_style", label: "Extract Style" },
  { value: "analyze_video", label: "Analyze Video" },
  { value: "refine_prompt", label: "Refine Prompt" },
  { value: "translate_subtitle", label: "Translate Subtitle" },
];

const MODEL_OPTIONS: FilterOption[] = [
  { value: "", label: "All models" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "dall-e-3", label: "DALL-E 3" },
  { value: "deepseek-chat", label: "DeepSeek Chat" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
];

export function timeRangeToSince(range: string): string {
  if (!range) return "";
  const now = Date.now();
  const ms: Record<string, number> = {
    "1h": 3600_000,
    "24h": 86400_000,
    "7d": 604800_000,
    "30d": 2592000_000,
  };
  if (!ms[range]) return "";
  return new Date(now - ms[range]).toISOString();
}

export function useUserOptions() {
  const { data } = useQuery({
    queryKey: ["admin", "users", "options"],
    queryFn: () =>
      adminApi.listUsers({ limit: 100, sort_by: "nickname", sort_order: "asc" }).then((r) => {
        const users = r.data?.items ?? r.data ?? [];
        return [
          { value: "", label: "All users" },
          ...users.map((u: { id: string; nickname: string; email: string }) => ({
            value: u.id,
            label: u.nickname || u.email,
          })),
        ] as FilterOption[];
      }),
    staleTime: 120_000,
  });
  return data ?? [{ value: "", label: "All users" }];
}

export function useTeamOptions() {
  const { data } = useQuery({
    queryKey: ["admin", "teams", "options"],
    queryFn: () =>
      adminApi.listTeams({ limit: 100 }).then((r) => {
        const teams = r.data?.items ?? r.data ?? [];
        return [
          { value: "", label: "All teams" },
          ...teams.map((t: { id: string; name: string }) => ({
            value: t.id,
            label: t.name,
          })),
        ] as FilterOption[];
      }),
    staleTime: 120_000,
  });
  return data ?? [{ value: "", label: "All teams" }];
}

export { TIME_RANGE_OPTIONS, SKILL_NAME_OPTIONS, MODEL_OPTIONS };
export type { FilterOption };
