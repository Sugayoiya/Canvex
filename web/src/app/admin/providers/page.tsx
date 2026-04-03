"use client";

import { useState, useCallback } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Key, Info } from "lucide-react";
import { aiProvidersApi, modelsApi } from "@/lib/api";
import { ModelSelector } from "@/components/common/model-selector";
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
        `Provider updated: ${(variables as Record<string, unknown>).display_name ?? ""}`
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to update provider: ${msg}`);
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
        `API Key added: ${variables.label || "new key"}`
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to add API Key: ${msg}`);
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (vars: { providerId: string; keyId: string }) =>
      aiProvidersApi.deleteKey(vars.providerId, vars.keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success(
        `API Key revoked: ${revokeModal.keyLabel || "key"}`
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
      toast.error(`Failed to revoke API Key: ${msg}`);
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
          ? `API Key enabled: ${vars.keyLabel || "key"}`
          : `API Key disabled: ${vars.keyLabel || "key"}`,
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to toggle key: ${msg}`);
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
      toast.success(`Key errors reset: ${vars.keyLabel || "key"}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to reset errors: ${msg}`);
    },
  });

  const anyPending =
    updateMutation.isPending ||
    addKeyMutation.isPending ||
    revokeKeyMutation.isPending ||
    toggleKeyMutation.isPending ||
    resetErrorsMutation.isPending;

  const { data: systemDefaults } = useQuery({
    queryKey: ["system-defaults"],
    queryFn: () => modelsApi.getSystemDefaults().then((r) => r.data?.settings ?? {}),
  });

  const updateSystemMutation = useMutation({
    mutationFn: (data: { default_llm_model?: string; default_image_model?: string }) =>
      modelsApi.updateSystemDefaults(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-defaults"] });
      toast.success("System defaults updated");
    },
  });

  const updateSystemDefault = useCallback(
    (key: string, value: string) => {
      updateSystemMutation.mutate({ [key]: value });
    },
    [updateSystemMutation],
  );

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

      {/* System default models */}
      <div
        style={{
          background: "var(--cv4-surface-primary)",
          border: "1px solid var(--cv4-border-subtle)",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--cv4-text-muted)",
            marginBottom: 12,
          }}
        >
          System Default Models
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--cv4-text-muted)",
                marginBottom: 8,
              }}
            >
              LLM Model
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
                color: "var(--cv4-text-muted)",
                marginBottom: 8,
              }}
            >
              Image Model
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
            color: "var(--cv4-text-muted)",
            opacity: 0.7,
          }}
        >
          <Info size={12} />
          Final fallback for all users when no project/personal/team default is set
        </div>
      </div>

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
            Failed to load providers
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
            Please refresh and try again
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
            Reload
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
            No preset providers found.
          </p>
        </div>
      ) : (
        <div>
          <GroupHeader label="Configured" count={configuredProviders.length} first />
          {configuredProviders.map(renderProviderCard)}

          <GroupHeader label="Unconfigured" count={pendingProviders.length} />
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
        title="Revoke Key"
        body={
          <>
            Revoke API Key{" "}
            <strong>{revokeModal.keyLabel || "Untitled"}</strong> (sk-••••
            {revokeModal.keyHint || "????"})? This key will be permanently deleted.
          </>
        }
        confirmLabel="Revoke"
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
          System-level provider configuration & model management
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
