"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  warning?: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "destructive";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  warning,
  confirmLabel,
  confirmVariant = "primary",
  icon,
  isLoading,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => cancelRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const els = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        if (els.length < 2) return;
        const idx = els.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey) {
          e.preventDefault();
          els[idx <= 0 ? els.length - 1 : idx - 1].focus();
        } else {
          e.preventDefault();
          els[(idx + 1) % els.length].focus();
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

  const isDestructive = confirmVariant === "destructive";

  const titleId = "confirmation-modal-title";

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
        {/* Header */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {icon && (
            <span
              style={{
                display: "flex",
                color: isDestructive ? "var(--ob-error)" : "var(--cv4-text-primary)",
              }}
            >
              {icon}
            </span>
          )}
          <h2
            id={titleId}
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: isDestructive ? "var(--ob-error)" : "var(--cv4-text-primary)",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
        </div>

        {/* Body */}
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-secondary)",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>

        {/* Warning */}
        {warning && (
          <div
            style={{
              marginTop: 16,
              background: "#FFB4AB10",
              border: "1px solid #FFB4AB20",
              borderRadius: 8,
              padding: "8px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <AlertTriangle
              size={14}
              style={{ color: "var(--ob-error)", flexShrink: 0, marginTop: 1 }}
            />
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ob-error)",
                lineHeight: 1.5,
              }}
            >
              {warning}
            </span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 24,
          }}
        >
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
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: isDestructive ? "var(--ob-error)" : "var(--cv4-btn-primary)",
              color: isDestructive ? "#131313" : "var(--cv4-btn-primary-text)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              pointerEvents: isLoading ? "none" : "auto",
            }}
          >
            {isLoading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
