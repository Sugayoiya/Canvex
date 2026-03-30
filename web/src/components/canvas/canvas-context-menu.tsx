"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { FileText, Image, PlayCircle, Music, History, Trash2 } from "lucide-react";
import { NodeExecutionHistory } from "./node-execution-history";

export type MaterialNodeType = "text" | "image" | "video" | "audio";

interface PaneContextMenuProps {
  position: { x: number; y: number };
  onAddNode: (nodeType: MaterialNodeType) => void;
  onClose: () => void;
}

const NODE_OPTIONS: { type: MaterialNodeType; label: string; icon: typeof FileText }[] = [
  { type: "text", label: "文本", icon: FileText },
  { type: "image", label: "图片", icon: Image },
  { type: "video", label: "视频", icon: PlayCircle },
  { type: "audio", label: "音频", icon: Music },
];

export function PaneContextMenu({ position, onAddNode, onClose }: PaneContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndexRef = useRef(0);

  const focusItem = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, NODE_OPTIONS.length - 1));
    focusIndexRef.current = clamped;
    itemRefs.current[clamped]?.focus();
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => focusItem(0));
  }, [focusItem]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusItem(focusIndexRef.current + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusItem(focusIndexRef.current - 1);
          break;
        case "Home":
          e.preventDefault();
          focusItem(0);
          break;
        case "End":
          e.preventDefault();
          focusItem(NODE_OPTIONS.length - 1);
          break;
        case "Escape":
        case "Tab":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [onClose, focusItem],
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="添加节点"
      onKeyDown={handleKeyDown}
      className="fixed flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 60,
        minWidth: 160,
        background: "var(--cv4-surface-primary)",
        borderRadius: "var(--cv4-radius-menu)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-md)",
        padding: 4,
        animation: "cv4-panel-enter 150ms ease-out",
      }}
    >
      <div
        style={{
          padding: "4px 10px 6px",
          fontFamily: "Manrope, sans-serif",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--cv4-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        添加节点
      </div>
      {NODE_OPTIONS.map(({ type, label, icon: Icon }, i) => (
        <button
          key={type}
          ref={(el) => { itemRefs.current[i] = el; }}
          role="menuitem"
          type="button"
          tabIndex={-1}
          onClick={() => {
            onAddNode(type);
            onClose();
          }}
          className="flex items-center gap-2 cursor-pointer w-full"
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            outline: "none",
            transition: "background 100ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--cv4-hover-highlight)";
            focusItem(i);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "var(--cv4-hover-highlight)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon size={14} style={{ color: "var(--cv4-text-muted)" }} />
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Node context menu (right-click on a node)                          */
/* ------------------------------------------------------------------ */

interface NodeContextMenuProps {
  position: { x: number; y: number };
  nodeId: string;
  onDelete: () => void;
  onClose: () => void;
}

const NODE_MENU_ITEMS: {
  key: string;
  label: string;
  icon: typeof History;
  action: "history" | "delete";
  danger?: boolean;
}[] = [
  { key: "history", label: "执行历史", icon: History, action: "history" },
  { key: "delete", label: "删除节点", icon: Trash2, action: "delete", danger: true },
];

export function NodeContextMenu({ position, nodeId, onDelete, onClose }: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [historyNodeId, setHistoryNodeId] = useState<string | null>(null);
  const [historyPosition, setHistoryPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        if (!historyNodeId) onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, historyNodeId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleItemClick = (action: string) => {
    if (action === "history") {
      setHistoryNodeId(nodeId);
      setHistoryPosition({ x: position.x, y: position.y });
      onClose();
    } else if (action === "delete") {
      onDelete();
      onClose();
    }
  };

  return (
    <>
      <div
        ref={menuRef}
        role="menu"
        aria-label="节点操作"
        className="fixed flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          zIndex: 60,
          minWidth: 160,
          background: "var(--cv4-surface-primary)",
          borderRadius: "var(--cv4-radius-menu)",
          border: "1px solid var(--cv4-border-default)",
          boxShadow: "var(--cv4-shadow-md)",
          padding: 4,
          animation: "cv4-panel-enter 150ms ease-out",
        }}
      >
        <div
          style={{
            padding: "4px 10px 6px",
            fontFamily: "Manrope, sans-serif",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--cv4-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          节点操作
        </div>
        {NODE_MENU_ITEMS.map(({ key, label, icon: Icon, action, danger }) => (
          <button
            key={key}
            role="menuitem"
            type="button"
            onClick={() => handleItemClick(action)}
            className="flex items-center gap-2 cursor-pointer w-full"
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              outline: "none",
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--cv4-hover-highlight)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon
              size={14}
              style={{
                color: danger ? "var(--cv5-status-failed)" : "var(--cv4-text-muted)",
              }}
            />
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                color: danger ? "var(--cv5-status-failed)" : "var(--cv4-text-secondary)",
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
      {historyNodeId && (
        <NodeExecutionHistory
          nodeId={historyNodeId}
          isOpen={true}
          onClose={() => setHistoryNodeId(null)}
          anchorPosition={historyPosition}
        />
      )}
    </>
  );
}
