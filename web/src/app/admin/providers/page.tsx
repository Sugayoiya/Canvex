"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Key } from "lucide-react";
import { aiProvidersApi } from "@/lib/api";
import { ProviderCard } from "@/components/admin/provider-card";
import type { Provider } from "@/components/admin/provider-card";
import { ProviderFormModal } from "@/components/admin/provider-form-modal";
import { ConfirmationModal } from "@/components/admin/confirmation-modal";
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary";

export default function AdminProvidersPage() {
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<{
    isOpen: boolean;
    provider: Provider | null;
  }>({ isOpen: false, provider: null });
  const [revokeModal, setRevokeModal] = useState<{
    isOpen: boolean;
    providerId: string | null;
    keyId: string | null;
    keyLabel: string | null;
    keyHint: string | null;
  }>({
    isOpen: false,
    providerId: null,
    keyId: null,
    keyLabel: null,
    keyHint: null,
  });

  const { data: providers, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "providers", { owner_type: "system" }],
    queryFn: () =>
      aiProvidersApi
        .list({ owner_type: "system" })
        .then((r) => r.data as Provider[]),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: Record<string, unknown> & { id: string }) =>
      aiProvidersApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success(
        `已更新 Provider: ${(variables as Record<string, unknown>).display_name ?? ""}`
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`更新 Provider 失败: ${msg}`);
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: (vars: {
      providerId: string;
      api_key: string;
      label?: string;
    }) => aiProvidersApi.addKey(vars.providerId, { api_key: vars.api_key, label: vars.label }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success(
        `已添加 API Key: ${variables.label || "new key"}`
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`添加 API Key 失败: ${msg}`);
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (vars: { providerId: string; keyId: string }) =>
      aiProvidersApi.deleteKey(vars.providerId, vars.keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success(
        `已撤销 API Key: ${revokeModal.keyLabel || "key"}`
      );
      setRevokeModal({
        isOpen: false,
        providerId: null,
        keyId: null,
        keyLabel: null,
        keyHint: null,
      });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`撤销 API Key 失败: ${msg}`);
    },
  });

  const toggleKeyMutation = useMutation({
    mutationFn: (vars: {
      providerId: string;
      keyId: string;
      isActive: boolean;
      keyLabel?: string;
    }) =>
      aiProvidersApi.updateKey(vars.providerId, vars.keyId, {
        is_active: vars.isActive,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "provider-health", vars.providerId],
      });
      toast.success(
        vars.isActive
          ? `已启用 API Key: ${vars.keyLabel || "key"}`
          : `已禁用 API Key: ${vars.keyLabel || "key"}`,
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`切换 Key 状态失败: ${msg}`);
    },
  });

  const resetErrorsMutation = useMutation({
    mutationFn: (vars: {
      providerId: string;
      keyId: string;
      keyLabel?: string;
    }) =>
      aiProvidersApi.updateKey(vars.providerId, vars.keyId, {
        reset_error_count: true,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "provider-health", vars.providerId],
      });
      toast.success(`已重置 Key 错误计数: ${vars.keyLabel || "key"}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`重置错误计数失败: ${msg}`);
    },
  });

  const anyPending =
    updateMutation.isPending ||
    addKeyMutation.isPending ||
    revokeKeyMutation.isPending ||
    toggleKeyMutation.isPending ||
    resetErrorsMutation.isPending;

  const providerList = providers ?? [];
  const configuredProviders = providerList.filter(
    (p: Provider) => p.active_key_count > 0 && p.is_enabled
  );
  const pendingProviders = providerList.filter(
    (p: Provider) => !(p.active_key_count > 0 && p.is_enabled)
  );

  const renderProviderCard = (p: Provider) => (
    <ProviderCard
      key={p.id}
      provider={p}
      isExpanded={expandedId === p.id}
      onToggleExpand={() => {
        if (anyPending) return;
        setExpandedId((prev) => (prev === p.id ? null : p.id));
      }}
      onEdit={() => setFormModal({ isOpen: true, provider: p })}
      onAddKey={(data) =>
        addKeyMutation.mutate({
          providerId: p.id,
          ...data,
        })
      }
      onRevokeKey={(keyId) => {
        const key = p.keys.find((k) => k.id === keyId);
        setRevokeModal({
          isOpen: true,
          providerId: p.id,
          keyId,
          keyLabel: key?.label ?? null,
          keyHint: key?.key_hint ?? null,
        });
      }}
      onToggleKey={(keyId, isActive) => {
        const key = p.keys.find((k) => k.id === keyId);
        toggleKeyMutation.mutate({
          providerId: p.id,
          keyId,
          isActive,
          keyLabel: key?.label ?? undefined,
        });
      }}
      onResetErrors={(keyId) => {
        const key = p.keys.find((k) => k.id === keyId);
        resetErrorsMutation.mutate({
          providerId: p.id,
          keyId,
          keyLabel: key?.label ?? undefined,
        });
      }}
      isAddingKey={addKeyMutation.isPending}
      revokingKeyId={
        revokeKeyMutation.isPending
          ? (
              revokeKeyMutation.variables as {
                keyId: string;
              } | undefined
            )?.keyId ?? null
          : null
      }
      togglingKeyId={
        toggleKeyMutation.isPending
          ? (
              toggleKeyMutation.variables as {
                keyId: string;
              } | undefined
            )?.keyId ?? null
          : null
      }
      resettingKeyId={
        resetErrorsMutation.isPending
          ? (
              resetErrorsMutation.variables as {
                keyId: string;
              } | undefined
            )?.keyId ?? null
          : null
      }
      disabled={anyPending}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader />

      <AdminErrorBoundary>
      {isLoading ? (
        <>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 64,
                borderRadius: 12,
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-subtle)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </>
      ) : isError ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            borderRadius: 12,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              margin: 0,
            }}
          >
            加载 Provider 列表失败
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              margin: "8px 0 16px",
            }}
          >
            请刷新页面重试
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--cv4-btn-primary)",
              color: "var(--cv4-btn-primary-text)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </div>
      ) : providerList.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            borderRadius: 12,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
          }}
        >
          <Settings
            size={48}
            style={{
              color: "var(--cv4-text-muted)",
              marginBottom: 16,
              opacity: 0.5,
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              margin: 0,
            }}
          >
            No providers configured
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              margin: "8px 0 0",
            }}
          >
            系统尚未预设任何 Provider。
          </p>
        </div>
      ) : (
        <div>
          <GroupHeader label="已配置" count={configuredProviders.length} first />
          {configuredProviders.map(renderProviderCard)}

          <GroupHeader label="待配置" count={pendingProviders.length} />
          {pendingProviders.map(renderProviderCard)}
        </div>
      )}
      </AdminErrorBoundary>

      <ProviderFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, provider: null })}
        provider={formModal.provider}
      />

      <ConfirmationModal
        isOpen={revokeModal.isOpen}
        onClose={() =>
          setRevokeModal({
            isOpen: false,
            providerId: null,
            keyId: null,
            keyLabel: null,
            keyHint: null,
          })
        }
        onConfirm={() =>
          revokeModal.providerId &&
          revokeModal.keyId &&
          revokeKeyMutation.mutate({
            providerId: revokeModal.providerId,
            keyId: revokeModal.keyId,
          })
        }
        title="撤销密钥"
        body={
          <>
            撤销 API Key{" "}
            <strong>{revokeModal.keyLabel || "Untitled"}</strong> (sk-••••
            {revokeModal.keyHint || "????"})？密钥将被永久删除。
          </>
        }
        confirmLabel="撤销密钥"
        confirmVariant="destructive"
        icon={<Key size={20} />}
        isLoading={revokeKeyMutation.isPending}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
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
          Providers
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
          系统级 Provider 配置和模型管理
        </p>
      </div>
    </div>
  );
}

function GroupHeader({ label, count, first }: { label: string; count: number; first?: boolean }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontFamily: "Manrope, sans-serif",
        fontWeight: 700,
        color: "var(--cv4-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        margin: first ? "0 0 8px" : "32px 0 8px",
      }}
    >
      {label} ({count})
    </div>
  );
}
