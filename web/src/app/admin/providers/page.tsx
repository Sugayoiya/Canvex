"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Settings, Key, Trash2 } from "lucide-react";
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
    editData: Provider | null;
  }>({ isOpen: false, editData: null });
  const [deleteModal, setDeleteModal] = useState<{
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

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      aiProvidersApi.create(data as Parameters<typeof aiProvidersApi.create>[0]),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success(
        `已添加 Provider: ${(variables as Record<string, unknown>).display_name}`
      );
      setFormModal({ isOpen: false, editData: null });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`添加 Provider 失败: ${msg}`);
    },
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
      setFormModal({ isOpen: false, editData: null });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`更新 Provider 失败: ${msg}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiProvidersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success(
        `已删除 Provider: ${deleteModal.provider?.display_name ?? ""}`
      );
      if (expandedId === deleteModal.provider?.id) setExpandedId(null);
      setDeleteModal({ isOpen: false, provider: null });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`删除 Provider 失败: ${msg}`);
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

  const anyPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    addKeyMutation.isPending ||
    revokeKeyMutation.isPending;

  // --- Form modal handler ---
  const handleFormSubmit = (data: Record<string, unknown>) => {
    if (formModal.editData) {
      updateMutation.mutate({
        id: formModal.editData.id,
        display_name: data.display_name,
        is_enabled: data.is_enabled,
        priority: data.priority,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  // --- Render ---

  const providerList = providers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        onAdd={() => setFormModal({ isOpen: true, editData: null })}
        disabled={anyPending}
      />

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
            Something went wrong. Please try again.
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
            Retry
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
              margin: "8px 0 16px",
            }}
          >
            Add your first AI provider to start managing credentials.
          </p>
          <button
            type="button"
            onClick={() => setFormModal({ isOpen: true, editData: null })}
            disabled={anyPending}
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
              cursor: anyPending ? "not-allowed" : "pointer",
              opacity: anyPending ? 0.7 : 1,
            }}
          >
            Add Provider
          </button>
        </div>
      ) : (
        <div>
          {providerList.map((p: Provider) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isExpanded={expandedId === p.id}
              onToggleExpand={() => {
                if (anyPending) return;
                setExpandedId((prev) => (prev === p.id ? null : p.id));
              }}
              onEdit={() =>
                setFormModal({ isOpen: true, editData: p })
              }
              onDelete={() =>
                setDeleteModal({ isOpen: true, provider: p })
              }
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
              disabled={anyPending}
            />
          ))}
        </div>
      )}
      </AdminErrorBoundary>

      {/* Provider Form Modal */}
      <ProviderFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, editData: null })}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editData={
          formModal.editData
            ? {
                provider_name: formModal.editData.provider_name,
                display_name: formModal.editData.display_name,
                is_enabled: formModal.editData.is_enabled,
                priority: formModal.editData.priority,
              }
            : null
        }
      />

      {/* Delete Provider Confirmation */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, provider: null })}
        onConfirm={() =>
          deleteModal.provider &&
          deleteMutation.mutate(deleteModal.provider.id)
        }
        title="Delete Provider"
        body={
          <>
            Delete <strong>{deleteModal.provider?.display_name}</strong> and
            all associated API keys? This cannot be undone.
          </>
        }
        warning="All API keys for this provider will be permanently deleted. Models using this provider will lose access to API credentials."
        confirmLabel="Delete Provider"
        confirmVariant="destructive"
        icon={<Trash2 size={20} />}
        isLoading={deleteMutation.isPending}
      />

      {/* Revoke Key Confirmation */}
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
            Revoke API key{" "}
            <strong>{revokeModal.keyLabel || "Untitled"}</strong> (sk-••••
            {revokeModal.keyHint || "????"})? The key will be permanently
            deleted.
          </>
        }
        confirmLabel="Revoke Key"
        confirmVariant="destructive"
        icon={<Key size={20} />}
        isLoading={revokeKeyMutation.isPending}
      />
    </div>
  );
}

function PageHeader({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled?: boolean;
}) {
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
          System-level provider configuration for inference and embeddings.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 36,
          padding: "0 16px",
          borderRadius: 8,
          border: "none",
          background: "var(--cv4-btn-primary)",
          color: "var(--cv4-btn-primary-text)",
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
          flexShrink: 0,
        }}
      >
        <Plus size={14} />
        Add Provider
      </button>
    </div>
  );
}
