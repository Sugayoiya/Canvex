"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Bot, Pencil, Trash2, Lock } from "lucide-react";

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

interface ProviderCardProps {
  provider: Provider;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddKey: (data: { api_key: string; label?: string }) => void;
  onRevokeKey: (keyId: string) => void;
  isAddingKey?: boolean;
  revokingKeyId?: string | null;
  disabled?: boolean;
}

export function ProviderCard({
  provider,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddKey,
  onRevokeKey,
  isAddingKey,
  revokingKeyId,
  disabled,
}: ProviderCardProps) {
  const [keyLabel, setKeyLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hoverEdit, setHoverEdit] = useState(false);
  const [hoverDelete, setHoverDelete] = useState(false);
  const [hoverHeader, setHoverHeader] = useState(false);

  const handleAddKey = () => {
    if (!apiKey.trim()) return;
    onAddKey({ api_key: apiKey, label: keyLabel.trim() || undefined });
    setKeyLabel("");
    setApiKey("");
  };

  const statusText = provider.is_enabled ? "Active" : "Inactive";
  const keyCountText = `${provider.key_count} key${provider.key_count !== 1 ? "s" : ""}`;

  const Chevron = isExpanded ? ChevronDown : ChevronRight;

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
          background: hoverHeader && !disabled ? "#E5E2E108" : "transparent",
          transition: "background 100ms",
        }}
      >
        <Chevron size={14} style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }} />
        <Bot size={20} style={{ color: "var(--cv4-text-secondary)", flexShrink: 0 }} />
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
        {/* Edit button */}
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
            background: hoverEdit ? "var(--cv4-hover-highlight)" : "transparent",
            color: "var(--cv4-text-muted)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            transition: "background 100ms",
            padding: 0,
          }}
        >
          <Pencil size={14} />
        </button>
        {/* Delete button */}
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
            color: hoverDelete ? "var(--ob-error)" : "var(--cv4-text-muted)",
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
        <div style={{ padding: "0 16px 24px 16px", borderTop: "1px solid var(--cv4-border-subtle)" }}>
          {/* Key management table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr>
                {["LABEL", "KEY", "CREATED", "ACTION"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      fontFamily: "Space Grotesk, sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--cv4-text-muted)",
                      textAlign: "left",
                      padding: "8px 8px",
                      borderBottom: "1px solid var(--cv4-border-subtle)",
                      letterSpacing: "1px",
                      width: i === 0 ? undefined : i === 1 ? 160 : i === 2 ? 120 : 80,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {provider.keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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
                    isRevoking={revokingKeyId === key.id}
                    onRevoke={() => onRevokeKey(key.id)}
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
            <Lock size={14} style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }} />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
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
                  cursor: isAddingKey || disabled ? "not-allowed" : "pointer",
                  opacity: isAddingKey ? 0.7 : 1,
                  pointerEvents: isAddingKey || disabled ? "none" : "auto",
                }}
              >
                {isAddingKey ? "..." : "Authorize Key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyRow({
  keyData,
  isRevoking,
  onRevoke,
  disabled,
}: {
  keyData: ProviderKey;
  isRevoking: boolean;
  onRevoke: () => void;
  disabled?: boolean;
}) {
  const [hoverRevoke, setHoverRevoke] = useState(false);
  const maskedKey = `sk-••••${keyData.key_hint || "????"}`;
  const tooltipText = keyData.key_hint
    ? undefined
    : "Key hint unavailable for keys created before this feature";

  return (
    <tr style={{ height: 44, borderBottom: "1px solid var(--cv4-border-subtle)" }}>
      <td style={{ padding: "0 8px", fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400, color: "var(--cv4-text-primary)" }}>
        {keyData.label || "Untitled"}
      </td>
      <td
        title={tooltipText}
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
      <td
        style={{
          padding: "0 8px",
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          fontWeight: 400,
          color: "var(--cv4-text-muted)",
        }}
      >
        {new Date(keyData.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </td>
      <td style={{ padding: "0 8px" }}>
        <span
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isRevoking && !disabled) onRevoke();
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isRevoking && !disabled) {
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
            cursor: isRevoking || disabled ? "default" : "pointer",
            textDecoration: hoverRevoke && !isRevoking && !disabled ? "underline" : "none",
            opacity: isRevoking ? 0.7 : 1,
          }}
        >
          {isRevoking ? "..." : "Revoke"}
        </span>
      </td>
    </tr>
  );
}
