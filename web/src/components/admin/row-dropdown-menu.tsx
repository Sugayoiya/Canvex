"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

interface DropdownMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  disabledTooltip?: string;
}

interface RowDropdownMenuProps {
  items: DropdownMenuItem[];
  triggerLabel: string;
}

export function RowDropdownMenu({ items, triggerLabel }: RowDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.right - 200,
    });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-dropdown]")) return;
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-dropdown
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        onClick={(e) => {
          e.stopPropagation();
          isOpen ? close() : open();
        }}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "none",
          background: isOpen ? "var(--cv4-active-highlight)" : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          transition: "background 100ms",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = "var(--cv4-hover-highlight)";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = "transparent";
        }}
      >
        <MoreHorizontal
          size={16}
          style={{
            color: isOpen
              ? "var(--cv4-text-primary)"
              : "var(--cv4-text-muted)",
          }}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            data-dropdown
            role="menu"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              minWidth: 200,
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-default)",
              borderRadius: 8,
              boxShadow: "0 4px 12px #00000040",
              padding: 4,
              zIndex: 50,
            }}
          >
            {items.map((item, idx) => {
              const isDestructive = item.variant === "destructive";
              const isDisabled = item.disabled;

              return (
                <button
                  key={idx}
                  type="button"
                  role="menuitem"
                  aria-disabled={isDisabled || undefined}
                  title={isDisabled ? item.disabledTooltip : undefined}
                  onClick={() => {
                    if (isDisabled) return;
                    item.onClick();
                    close();
                  }}
                  style={{
                    width: "100%",
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    color: isDisabled
                      ? "var(--cv4-text-muted)"
                      : isDestructive
                        ? "var(--ob-error)"
                        : "var(--cv4-text-secondary)",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.4 : 1,
                    transition: "background 100ms, color 100ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled) {
                      e.currentTarget.style.background = "var(--cv4-hover-highlight)";
                      e.currentTarget.style.color = isDestructive
                        ? "var(--ob-error)"
                        : "var(--cv4-text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = isDestructive
                        ? "var(--ob-error)"
                        : "var(--cv4-text-secondary)";
                    }
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
