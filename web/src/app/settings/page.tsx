"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { usersApi, modelsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { ModelSelector } from "@/components/common/model-selector";
import { Info } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: userSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => usersApi.getSettings().then((r) => r.data?.settings ?? {}),
  });

  const updatePersonalMutation = useMutation({
    mutationFn: (data: { default_llm_model?: string; default_image_model?: string }) =>
      usersApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const updatePersonalDefault = useCallback(
    (key: string, value: string) => {
      updatePersonalMutation.mutate({ [key]: value });
    },
    [updatePersonalMutation],
  );

  const { data: systemDefaults } = useQuery({
    queryKey: ["system-defaults"],
    queryFn: () => modelsApi.getSystemDefaults().then((r) => r.data?.settings ?? {}),
    enabled: !!user?.is_admin,
  });

  const updateSystemMutation = useMutation({
    mutationFn: (data: { default_llm_model?: string; default_image_model?: string }) =>
      modelsApi.updateSystemDefaults(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-defaults"] });
    },
  });

  const updateSystemDefault = useCallback(
    (key: string, value: string) => {
      updateSystemMutation.mutate({ [key]: value });
    },
    [updateSystemMutation],
  );

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 36,
            fontWeight: 700,
            color: "var(--ob-text-primary)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--ob-text-muted)",
            margin: "6px 0 0",
          }}
        >
          Personal preferences & default configurations
        </p>
      </div>

      {/* Personal default models */}
      <div
        style={{
          background: "var(--ob-glass-bg)",
          border: "1px solid var(--ob-glass-border)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--ob-text-muted)",
            marginBottom: 12,
          }}
        >
          个人默认模型
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--ob-text-muted)",
                marginBottom: 8,
              }}
            >
              LLM 模型
            </div>
            <ModelSelector
              value={userSettings?.default_llm_model ?? null}
              onChange={(name) => updatePersonalDefault("default_llm_model", name)}
              modelType="llm"
              size="md"
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--ob-text-muted)",
                marginBottom: 8,
              }}
            >
              图像模型
            </div>
            <ModelSelector
              value={userSettings?.default_image_model ?? null}
              onChange={(name) => updatePersonalDefault("default_image_model", name)}
              modelType="image"
              size="md"
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 12,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--ob-text-muted)",
            opacity: 0.7,
          }}
        >
          <Info size={12} />
          用于所有个人项目的 fallback 默认值
        </div>
      </div>

      {/* AI Console link */}
      <div
        style={{
          background: "var(--ob-glass-bg)",
          border: "1px solid var(--ob-glass-border)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          cursor: "pointer",
          transition: "border-color 200ms",
        }}
        onClick={() => router.push("/settings/ai")}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--ob-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--ob-glass-border)";
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--ob-text-muted)",
            marginBottom: 4,
          }}
        >
          AI Console
        </div>
        <div style={{ fontSize: 13, color: "var(--ob-text-secondary)" }}>
          Manage AI providers, API keys & billing →
        </div>
      </div>

      {/* System default models (admin only) */}
      {user?.is_admin && (
        <div
          style={{
            background: "var(--ob-glass-bg)",
            border: "1px solid var(--ob-glass-border)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "var(--ob-text-muted)",
              marginBottom: 12,
            }}
          >
            系统默认模型
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--ob-text-muted)",
                  marginBottom: 8,
                }}
              >
                LLM 模型
              </div>
              <ModelSelector
                value={systemDefaults?.default_llm_model ?? null}
                onChange={(name) => updateSystemDefault("default_llm_model", name)}
                modelType="llm"
                size="md"
              />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--ob-text-muted)",
                  marginBottom: 8,
                }}
              >
                图像模型
              </div>
              <ModelSelector
                value={systemDefaults?.default_image_model ?? null}
                onChange={(name) => updateSystemDefault("default_image_model", name)}
                modelType="image"
                size="md"
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 12,
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--ob-text-muted)",
              opacity: 0.7,
            }}
          >
            <Info size={12} />
            作为所有项目的最终 fallback 默认值
          </div>
        </div>
      )}
    </AppShell>
  );
}
