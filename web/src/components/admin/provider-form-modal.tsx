"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ProviderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    provider_name: string;
    display_name: string;
    is_enabled: boolean;
    priority: number;
    owner_type: string;
  }) => void;
  isLoading?: boolean;
  editData?: {
    provider_name: string;
    display_name: string;
    is_enabled: boolean;
    priority: number;
  } | null;
}

export function ProviderFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  editData,
}: ProviderFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [priority, setPriority] = useState(0);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const isEdit = !!editData;

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setProviderName(editData.provider_name);
        setDisplayName(editData.display_name);
        setIsEnabled(editData.is_enabled);
        setPriority(editData.priority);
      } else {
        setProviderName("");
        setDisplayName("");
        setIsEnabled(true);
        setPriority(0);
      }
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [isOpen, editData]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => cancelRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = [cancelRef.current, confirmRef.current].filter(
          Boolean
        ) as HTMLElement[];
        if (focusable.length < 2) return;
        const idx = focusable.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey) {
          e.preventDefault();
          focusable[idx <= 0 ? focusable.length - 1 : idx - 1].focus();
        } else {
          e.preventDefault();
          focusable[(idx + 1) % focusable.length].focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!providerName.trim() || !displayName.trim()) return;
    onSubmit({
      provider_name: providerName.trim(),
      display_name: displayName.trim(),
      is_enabled: isEnabled,
      priority,
      owner_type: "system",
    });
  };

  const titleId = "provider-form-modal-title";
  const title = isEdit
    ? `Edit Provider — ${editData!.display_name}`
    : "Add Provider";
  const submitLabel = isEdit ? "Update Provider" : "Add Provider";

  const inputStyle = {
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
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    fontFamily: "Manrope, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "var(--cv4-text-secondary)",
    marginBottom: 6,
    display: "block" as const,
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000080",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--cv4-surface-primary)",
          border: "1px solid var(--cv4-border-default)",
          borderRadius: 12,
          width: 420,
          padding: 24,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "scale(1)" : "scale(0.96)",
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
        }}
      >
        {/* Title */}
        <h2
          id={titleId}
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          {/* Provider Name */}
          <div>
            <label style={labelStyle}>Provider Name</label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              readOnly={isEdit}
              placeholder="e.g. openai, gemini"
              style={{
                ...inputStyle,
                opacity: isEdit ? 0.6 : 1,
                cursor: isEdit ? "not-allowed" : "text",
              }}
            />
          </div>

          {/* Display Name */}
          <div>
            <label style={labelStyle}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. OpenAI, Google Gemini"
              style={inputStyle}
            />
          </div>

          {/* Enabled toggle group */}
          <div>
            <label style={labelStyle}>Status</label>
            <div
              role="radiogroup"
              aria-label="Provider status"
              style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--cv4-border-default)" }}
            >
              <ToggleOption
                label="Enabled"
                isActive={isEnabled}
                onClick={() => setIsEnabled(true)}
              />
              <ToggleOption
                label="Disabled"
                isActive={!isEnabled}
                onClick={() => setIsEnabled(false)}
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <input
              type="number"
              min={0}
              max={99}
              value={priority}
              onChange={(e) =>
                setPriority(
                  Math.min(99, Math.max(0, parseInt(e.target.value) || 0))
                )
              }
              style={{ ...inputStyle, width: 120 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid var(--cv4-btn-secondary-border)",
              background: "var(--cv4-btn-secondary)",
              color: "var(--cv4-btn-secondary-text)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !providerName.trim() || !displayName.trim()}
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
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              pointerEvents: isLoading ? "none" : "auto",
            }}
          >
            {isLoading ? "..." : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ToggleOption({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        height: 36,
        border: "none",
        background: isActive
          ? "var(--cv4-active-highlight)"
          : hover
            ? "var(--cv4-hover-highlight)"
            : "transparent",
        color: isActive
          ? "var(--cv4-text-primary)"
          : hover
            ? "var(--cv4-text-secondary)"
            : "var(--cv4-text-muted)",
        fontFamily: "Manrope, sans-serif",
        fontSize: 12,
        fontWeight: isActive ? 700 : 400,
        cursor: "pointer",
        transition: "background 100ms, color 100ms",
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}
