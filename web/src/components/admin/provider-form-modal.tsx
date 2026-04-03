"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aiProvidersApi } from "@/lib/api";
import type { Provider } from "./provider-card";

interface ProviderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
}

export function ProviderFormModal({
  isOpen,
  onClose,
  provider,
}: ProviderFormModalProps) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const showBaseUrl = provider?.sdk_type === "openai_compatible";

  useEffect(() => {
    if (isOpen && provider) {
      setApiKey("");
      setBaseUrl(provider.base_url || provider.default_base_url || "");
      setValidationError(null);
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [isOpen, provider]);

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

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      if (!provider) return;
      await aiProvidersApi.addKey(provider.id, { api_key: apiKey.trim(), label: "Admin configured" });
      if (showBaseUrl && baseUrl.trim() && baseUrl.trim() !== (provider.default_base_url || "")) {
        await aiProvidersApi.update(provider.id, { base_url: baseUrl.trim() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success("API Key added");
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to save config: ${msg}`);
    },
  });

  if (!isOpen || !provider) return null;

  const handleSubmit = () => {
    if (!apiKey.trim()) {
      setValidationError("API Key is required");
      return;
    }
    if (showBaseUrl && baseUrl.trim() && !baseUrl.trim().startsWith("https://")) {
      setValidationError("Base URL must start with https://");
      return;
    }
    setValidationError(null);
    addKeyMutation.mutate();
  };

  const titleId = "provider-form-modal-title";
  const isLoading = addKeyMutation.isPending;

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
          Configure {provider.display_name}
        </h2>

        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          <div>
            <label style={labelStyle}>API Key</label>
            <input
              type="text"
              autoComplete="one-time-code"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setValidationError(null); }}
              placeholder="Enter API Key"
              style={{
                ...inputStyle,
                WebkitTextSecurity: "disc" as unknown as string,
              }}
            />
          </div>

          {showBaseUrl && (
            <div>
              <label style={labelStyle}>Base URL (optional)</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); setValidationError(null); }}
                placeholder={provider.default_base_url || "https://"}
                style={inputStyle}
              />
              {provider.default_base_url && (
                <span style={{
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11,
                  fontWeight: 400,
                  color: "var(--cv4-text-muted)",
                  marginTop: 4,
                  display: "block",
                }}>
                  Default: {provider.default_base_url}
                </span>
              )}
            </div>
          )}

          {validationError && (
            <div style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--ob-error)",
            }}>
              {validationError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
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
              type="submit"
              disabled={isLoading || !apiKey.trim()}
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
              {isLoading ? "..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
