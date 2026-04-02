"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronDown,
  Bot,
  Pencil,
  Trash2,
  Lock,
} from "lucide-react";
import { aiProvidersApi } from "@/lib/api";
import { UsageSparkline } from "./usage-sparkline";

export interface ProviderKey {
  id: string;
  label: string | null;
  key_hint: string | null;
  is_active: boolean;
  error_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface Provider {
  id: string;
  provider_name: string;
  display_name: string;
  is_enabled: boolean;
  priority: number;
  key_count: number;
  active_key_count: number;
  keys: ProviderKey[];
  created_at: string;
}

interface KeyHealthData {
  key_id: string;
  error_count: number;
  last_used_at: string | null;
  is_healthy: boolean;
  health_badge: "healthy" | "degraded" | "unhealthy";
  recent_errors: Array<{ type: string; message: string; at: string }>;
  usage_trend: Array<{ hour: string; count: number }>;
}

interface ProviderCardProps {
  provider: Provider;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddKey: (data: { api_key: string; label?: string }) => void;
  onRevokeKey: (keyId: string) => void;
  onToggleKey?: (keyId: string, isActive: boolean) => void;
  onResetErrors?: (keyId: string) => void;
  isAddingKey?: boolean;
  revokingKeyId?: string | null;
  togglingKeyId?: string | null;
  resettingKeyId?: string | null;
  disabled?: boolean;
}

const BADGE_CONFIG = {
  healthy: { color: "#4CAF50", bg: "#4CAF5020", label: "Healthy" },
  degraded: { color: "#FFD59C", bg: "#FFD59C20", label: "Degraded" },
  unhealthy: { color: "#FFB4AB", bg: "#FFB4AB20", label: "Unhealthy" },
} as const;

function HealthBadge({
  badge,
  loading,
}: {
  badge?: "healthy" | "degraded" | "unhealthy";
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span
        style={{
          display: "inline-flex",
          height: 24,
          width: 64,
          borderRadius: 6,
          background: "var(--cv4-hover-highlight)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
    );
  }

  if (!badge) {
    return (
      <span
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          color: "var(--cv4-text-muted)",
        }}
      >
        —
      </span>
    );
  }

  const config = BADGE_CONFIG[badge];
  return (
    <span
      aria-label={`Health: ${config.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 24,
        padding: "4px 8px",
        borderRadius: 6,
        background: config.bg,
        fontFamily: "Manrope, sans-serif",
        fontSize: 12,
        fontWeight: 700,
        color: config.color,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

function ToggleSwitch({
  isActive,
  isPending,
  label,
  onToggle,
}: {
  isActive: boolean;
  isPending: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={`Toggle key ${label}`}
      title={isActive ? "Disable this key" : "Enable this key"}
      onClick={(e) => {
        e.stopPropagation();
        if (!isPending) onToggle();
      }}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        padding: 2,
        background: isActive ? "var(--ob-success)" : "var(--cv4-text-muted)",
        cursor: isPending ? "not-allowed" : "pointer",
        opacity: isPending ? 0.7 : 1,
        position: "relative",
        transition: "background 200ms",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "white",
          transition: "transform 200ms",
          transform: isActive ? "translateX(16px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

function ErrorHistoryList({
  errors,
}: {
  errors: Array<{ type: string; message: string; at: string }>;
}) {
  if (errors.length === 0) {
    return (
      <div
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          fontWeight: 400,
          color: "var(--cv4-text-muted)",
          padding: 8,
        }}
      >
        No errors recorded
      </div>
    );
  }

  return (
    <div
      role="list"
      style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column" }}
    >
      {errors.map((err, i) => (
        <div
          key={`${err.at}-${i}`}
          role="listitem"
          style={{
            padding: "8px 0",
            borderBottom:
              i < errors.length - 1
                ? "1px solid var(--cv4-border-subtle)"
                : "none",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ob-error)",
            }}
          >
            {err.type}
          </span>
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {err.message}
          </span>
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              opacity: 0.7,
            }}
          >
            {formatRelativeTime(err.at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ProviderCard({
  provider,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddKey,
  onRevokeKey,
  onToggleKey,
  onResetErrors,
  isAddingKey,
  revokingKeyId,
  togglingKeyId,
  resettingKeyId,
  disabled,
}: ProviderCardProps) {
  const [keyLabel, setKeyLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hoverEdit, setHoverEdit] = useState(false);
  const [hoverDelete, setHoverDelete] = useState(false);
  const [hoverHeader, setHoverHeader] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["admin", "provider-health", provider.id],
    queryFn: () =>
      aiProvidersApi.getProviderHealth(provider.id).then((r) => r.data),
    enabled: isExpanded,
    refetchInterval: 60000,
  });

  const healthMap = new Map<string, KeyHealthData>();
  if (healthData?.keys) {
    for (const kh of healthData.keys) {
      healthMap.set(kh.key_id, kh);
    }
  }

  const handleAddKey = () => {
    if (!apiKey.trim()) return;
    onAddKey({ api_key: apiKey, label: keyLabel.trim() || undefined });
    setKeyLabel("");
    setApiKey("");
  };

  const statusText = provider.is_enabled ? "Active" : "Inactive";
  const keyCountText = `${provider.key_count} key${provider.key_count !== 1 ? "s" : ""}`;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  const TABLE_HEADERS = [
    { label: "LABEL", width: undefined },
    { label: "KEY", width: 160 },
    { label: "HEALTH", width: 80 },
    { label: "LAST USED", width: 120 },
    { label: "ERRORS", width: 64 },
    { label: "ACTIONS", width: 120 },
  ];

  return (
    <div
      style={{
        background: "var(--cv4-surface-primary)",
        border: "1px solid var(--cv4-border-subtle)",
        borderRadius: 12,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      {/* Collapsed Header */}
      <div
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
        style={{
          height: 64,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: disabled ? "default" : "pointer",
          background:
            hoverHeader && !disabled ? "#E5E2E108" : "transparent",
          transition: "background 100ms",
        }}
      >
        <Chevron
          size={14}
          style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }}
        />
        <Bot
          size={20}
          style={{ color: "var(--cv4-text-secondary)", flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            lineHeight: 1.3,
          }}
        >
          {provider.display_name}
        </span>
        <span
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            lineHeight: 1.5,
          }}
        >
          {statusText} • {keyCountText}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          aria-label={`Edit ${provider.display_name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onMouseEnter={() => setHoverEdit(true)}
          onMouseLeave={() => setHoverEdit(false)}
          disabled={disabled}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 6,
            background: hoverEdit
              ? "var(--cv4-hover-highlight)"
              : "transparent",
            color: "var(--cv4-text-muted)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            transition: "background 100ms",
            padding: 0,
          }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          aria-label={`Delete ${provider.display_name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onMouseEnter={() => setHoverDelete(true)}
          onMouseLeave={() => setHoverDelete(false)}
          disabled={disabled}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 6,
            background: hoverDelete ? "#FFB4AB10" : "transparent",
            color: hoverDelete
              ? "var(--ob-error)"
              : "var(--cv4-text-muted)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            transition: "background 100ms, color 100ms",
            padding: 0,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded Area */}
      {isExpanded && (
        <div
          style={{
            padding: "0 16px 24px 16px",
            borderTop: "1px solid var(--cv4-border-subtle)",
          }}
        >
          {/* Key management table */}
          <table
            style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}
          >
            <thead>
              <tr>
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h.label}
                    style={{
                      fontFamily: "Space Grotesk, sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--cv4-text-muted)",
                      textAlign: "left",
                      padding: "8px 8px",
                      borderBottom: "1px solid var(--cv4-border-subtle)",
                      letterSpacing: "1px",
                      width: h.width,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {provider.keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_HEADERS.length}
                    style={{
                      fontFamily: "Manrope, sans-serif",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--cv4-text-muted)",
                      padding: 16,
                      textAlign: "center",
                    }}
                  >
                    No API keys configured
                  </td>
                </tr>
              ) : (
                provider.keys.map((key) => (
                  <KeyRow
                    key={key.id}
                    keyData={key}
                    healthData={healthMap.get(key.id)}
                    healthLoading={healthLoading}
                    isRevoking={revokingKeyId === key.id}
                    isToggling={togglingKeyId === key.id}
                    isResetting={resettingKeyId === key.id}
                    isDetailExpanded={expandedKeyId === key.id}
                    onToggleDetail={() =>
                      setExpandedKeyId((prev) =>
                        prev === key.id ? null : key.id,
                      )
                    }
                    onRevoke={() => onRevokeKey(key.id)}
                    onToggle={() =>
                      onToggleKey?.(key.id, !key.is_active)
                    }
                    onResetErrors={() => onResetErrors?.(key.id)}
                    disabled={disabled}
                  />
                ))
              )}
            </tbody>
          </table>

          {/* Encryption notice */}
          <div
            style={{
              background: "var(--cv4-hover-highlight)",
              border: "1px solid var(--cv4-border-default)",
              borderRadius: 8,
              padding: "8px 12px",
              margin: "16px 0",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Lock
              size={14}
              style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }}
            />
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-muted)",
              }}
            >
              Keys encrypted with AES-256 GCM
            </span>
          </div>

          {/* Add key form */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 16,
            }}
          >
            <input
              type="text"
              placeholder="Key Label (optional)"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              aria-label="Key label"
              style={{
                height: 36,
                width: "100%",
                padding: "0 12px",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-primary)",
                background: "var(--cv4-canvas-bg)",
                border: "1px solid var(--cv4-border-default)",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <input
              type="password"
              placeholder="Paste API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              aria-label="API key"
              style={{
                height: 36,
                width: "100%",
                padding: "0 12px",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-primary)",
                background: "var(--cv4-canvas-bg)",
                border: "1px solid var(--cv4-border-default)",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleAddKey}
                disabled={!apiKey.trim() || isAddingKey || disabled}
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
                  cursor:
                    isAddingKey || disabled ? "not-allowed" : "pointer",
                  opacity: isAddingKey ? 0.7 : 1,
                  pointerEvents:
                    isAddingKey || disabled ? "none" : "auto",
                }}
              >
                {isAddingKey ? "..." : "Authorize Key"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

function KeyRow({
  keyData,
  healthData,
  healthLoading,
  isRevoking,
  isToggling,
  isResetting,
  isDetailExpanded,
  onToggleDetail,
  onRevoke,
  onToggle,
  onResetErrors,
  disabled,
}: {
  keyData: ProviderKey;
  healthData?: KeyHealthData;
  healthLoading: boolean;
  isRevoking: boolean;
  isToggling: boolean;
  isResetting: boolean;
  isDetailExpanded: boolean;
  onToggleDetail: () => void;
  onRevoke: () => void;
  onToggle: () => void;
  onResetErrors: () => void;
  disabled?: boolean;
}) {
  const [hoverRevoke, setHoverRevoke] = useState(false);
  const [hoverReset, setHoverReset] = useState(false);
  const maskedKey = `sk-••••${keyData.key_hint || "????"}`;

  const errorCount = healthData?.error_count ?? keyData.error_count;
  const lastUsed = healthData?.last_used_at ?? keyData.last_used_at;
  const badge = healthData?.health_badge;

  return (
    <>
      <tr
        style={{
          height: 44,
          borderBottom: "1px solid var(--cv4-border-subtle)",
          cursor: "pointer",
        }}
        aria-expanded={isDetailExpanded}
        onClick={onToggleDetail}
      >
        {/* LABEL */}
        <td
          style={{
            padding: "0 8px",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-primary)",
          }}
        >
          {keyData.label || "Untitled"}
        </td>

        {/* KEY */}
        <td
          style={{
            padding: "0 8px",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-secondary)",
            lineHeight: 1.3,
          }}
        >
          {maskedKey}
        </td>

        {/* HEALTH */}
        <td style={{ padding: "0 8px" }}>
          <HealthBadge badge={badge} loading={healthLoading} />
        </td>

        {/* LAST USED */}
        <td
          style={{
            padding: "0 8px",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
          }}
        >
          {lastUsed ? formatRelativeTime(lastUsed) : "Never"}
        </td>

        {/* ERRORS */}
        <td
          style={{
            padding: "0 8px",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color:
              errorCount > 0
                ? "var(--ob-error)"
                : "var(--cv4-text-muted)",
          }}
        >
          {errorCount}
        </td>

        {/* ACTIONS */}
        <td style={{ padding: "0 8px" }} onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <ToggleSwitch
              isActive={keyData.is_active}
              isPending={isToggling}
              label={keyData.label || "key"}
              onToggle={onToggle}
            />
            <span
              role="button"
              tabIndex={0}
              aria-label={`Reset errors for ${keyData.label || "key"}`}
              onClick={() => {
                if (!isResetting && !disabled) onResetErrors();
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  !isResetting &&
                  !disabled
                ) {
                  e.preventDefault();
                  onResetErrors();
                }
              }}
              onMouseEnter={() => setHoverReset(true)}
              onMouseLeave={() => setHoverReset(false)}
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
                cursor:
                  isResetting || disabled ? "default" : "pointer",
                textDecoration:
                  hoverReset && !isResetting && !disabled
                    ? "underline"
                    : "none",
                whiteSpace: "nowrap",
              }}
            >
              {isResetting ? "..." : "Reset Errors"}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isRevoking && !disabled) onRevoke();
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  !isRevoking &&
                  !disabled
                ) {
                  e.preventDefault();
                  onRevoke();
                }
              }}
              onMouseEnter={() => setHoverRevoke(true)}
              onMouseLeave={() => setHoverRevoke(false)}
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--ob-error)",
                cursor:
                  isRevoking || disabled ? "default" : "pointer",
                textDecoration:
                  hoverRevoke && !isRevoking && !disabled
                    ? "underline"
                    : "none",
                opacity: isRevoking ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isRevoking ? "..." : "Revoke"}
            </span>
          </div>
        </td>
      </tr>

      {/* Expanded key detail panel */}
      {isDetailExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <div
              role="region"
              aria-label={`Details for key ${keyData.label || "key"}`}
              style={{
                background: "var(--cv4-hover-highlight)",
                borderTop: "1px solid var(--cv4-border-subtle)",
                padding: 16,
                display: "flex",
                gap: 16,
              }}
            >
              {/* Error history (flex 1) */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--cv4-text-primary)",
                    marginBottom: 8,
                  }}
                >
                  Recent Errors
                </div>
                <ErrorHistoryList
                  errors={healthData?.recent_errors ?? []}
                />
              </div>

              {/* Usage sparkline (200px) */}
              <div style={{ width: 200, flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--cv4-text-primary)",
                    marginBottom: 8,
                  }}
                >
                  Usage (24h)
                </div>
                <UsageSparkline
                  data={healthData?.usage_trend ?? []}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
