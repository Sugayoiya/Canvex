"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Sparkles, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { modelsApi, type AvailableModel } from "@/lib/api";
import { ProviderIcon } from "@/components/common/provider-icon";

interface ModelSelectorProps {
  value: string | null;
  onChange: (modelName: string) => void;
  modelType?: "llm" | "image" | "all";
  requiredFeatures?: string[];
  size?: "sm" | "md";
  disabled?: boolean;
  placeholder?: string;
  popoverPosition?: "above" | "below";
}

function formatPrice(model: AvailableModel): string {
  if (model.input_price_per_1k) {
    const perMillion = parseFloat(model.input_price_per_1k) * 1000;
    return `$${perMillion % 1 === 0 ? perMillion.toFixed(0) : perMillion.toFixed(2)}/M`;
  }
  if (model.price_per_image) {
    return `$${parseFloat(model.price_per_image).toFixed(2)}/img`;
  }
  return "free";
}

const SEARCH_THRESHOLD = 8;

export function ModelSelector({
  value,
  onChange,
  modelType = "all",
  requiredFeatures,
  size = "sm",
  disabled = false,
  placeholder = "自动选择",
  popoverPosition = "below",
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["models", "available"],
    queryFn: () => modelsApi.getAvailable().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const filteredModels = useMemo(() => {
    if (!data) return [];
    let models: AvailableModel[] =
      modelType === "llm"
        ? data.llm
        : modelType === "image"
          ? data.image
          : [...data.llm, ...data.image];
    if (requiredFeatures?.length) {
      models = models.filter((m) =>
        requiredFeatures.every((f) => m.features.includes(f)),
      );
    }
    return models;
  }, [data, modelType, requiredFeatures]);

  const showSearch = filteredModels.length > SEARCH_THRESHOLD;

  const visibleModels = useMemo(() => {
    if (!search.trim()) return filteredModels;
    const q = search.toLowerCase();
    return filteredModels.filter(
      (m) =>
        m.model_name.toLowerCase().includes(q) ||
        m.display_name.toLowerCase().includes(q),
    );
  }, [filteredModels, search]);

  const selectedModel = useMemo(
    () => filteredModels.find((m) => m.model_name === value) ?? null,
    [filteredModels, value],
  );

  const openPopover = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearch("");
    setFocusIndex(-1);
  }, [disabled]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setFocusIndex(-1);
  }, []);

  const selectModel = useCallback(
    (model: AvailableModel) => {
      onChange(model.model_name);
      closePopover();
    },
    [onChange, closePopover],
  );

  useEffect(() => {
    if (isOpen && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen, showSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, closePopover]);

  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[focusIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          openPopover();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((prev) =>
            prev < visibleModels.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((prev) =>
            prev > 0 ? prev - 1 : visibleModels.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < visibleModels.length) {
            selectModel(visibleModels[focusIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closePopover();
          break;
      }
    },
    [isOpen, openPopover, closePopover, selectModel, visibleModels, focusIndex],
  );

  const isSm = size === "sm";
  const pillHeight = isSm ? 28 : 36;
  const pillPadding = isSm ? "0 12px" : "0 16px";
  const iconSize = isSm ? 14 : 16;
  const fontSize = isSm ? 12 : 13;
  const chevronSize = isSm ? 10 : 12;
  const popoverWidth = isSm ? 260 : 300;
  const iconGap = isSm ? 4 : 8;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      {/* Pill trigger */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select model"
        disabled={disabled}
        onClick={() => (isOpen ? closePopover() : openPopover())}
        onKeyDown={handleKeyDown}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: iconGap,
          height: pillHeight,
          padding: pillPadding,
          background: "var(--cv4-surface-primary)",
          border: isOpen
            ? "1px solid rgba(0,209,255,0.3)"
            : isSm
              ? "1px solid transparent"
              : "1px solid var(--cv4-border-default)",
          borderRadius: "var(--cv4-radius-tag, 8px)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color 120ms",
          outline: "none",
          fontFamily: "Manrope, sans-serif",
          fontSize,
          fontWeight: 400,
          lineHeight: 1,
          color: "var(--cv4-text-secondary)",
          whiteSpace: "nowrap",
          boxSizing: "border-box",
        }}
      >
        {isLoading ? (
          <span
            style={{
              display: "inline-block",
              width: 40,
              height: 12,
              borderRadius: 4,
              background: "var(--cv4-hover-highlight)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ) : selectedModel ? (
          <>
            <ProviderIcon name={selectedModel.provider_name} size={iconSize} />
            <span>{selectedModel.display_name}</span>
          </>
        ) : (
          <>
            <Sparkles size={iconSize} style={{ color: "var(--cv4-text-disabled)" }} />
            <span>{placeholder}</span>
          </>
        )}
        <ChevronDown
          size={chevronSize}
          style={{
            color: "var(--cv4-text-disabled)",
            marginLeft: isSm ? 0 : 4,
            flexShrink: 0,
          }}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            ...(popoverPosition === "above"
              ? { bottom: "calc(100% + 4px)" }
              : { top: "calc(100% + 4px)" }),
            left: 0,
            width: popoverWidth,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--cv4-surface-popup)",
            border: "1px solid var(--cv4-border-default)",
            borderRadius: "var(--cv4-radius-menu, 14px)",
            boxShadow: "var(--cv4-shadow-lg)",
            backdropFilter: "blur(20px)",
            zIndex: 60,
            animation: "cv4-panel-enter 150ms ease-out",
            display: "flex",
            flexDirection: "column",
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search (conditional) */}
          {showSearch && (
            <div style={{ padding: "8px 12px 4px", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 32,
                  padding: "0 12px",
                  background: "var(--cv4-surface-elevated, var(--cv4-canvas-bg))",
                  border: "1px solid var(--cv4-border-default)",
                  borderRadius: 8,
                }}
              >
                <Search size={12} style={{ color: "var(--cv4-text-disabled)", flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusIndex(-1);
                  }}
                  placeholder="搜索模型..."
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    color: "var(--cv4-text-primary)",
                    padding: 0,
                  }}
                />
              </div>
            </div>
          )}

          {/* Model list */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Available models"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "4px 0",
            }}
          >
            {visibleModels.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--cv4-text-secondary)",
                  }}
                >
                  暂无可用模型
                </span>
                <span
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11,
                    fontWeight: 400,
                    color: "var(--cv4-text-muted)",
                  }}
                >
                  请联系管理员配置 AI 服务商的 API Key
                </span>
              </div>
            ) : (
              visibleModels.map((model, idx) => {
                const isSelected = model.model_name === value;
                const isFocused = idx === focusIndex;
                return (
                  <ModelItem
                    key={model.model_name}
                    model={model}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onSelect={() => selectModel(model)}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

function ModelItem({
  model,
  isSelected,
  isFocused,
  onSelect,
}: {
  model: AvailableModel;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const active = hover || isFocused;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 36,
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: isSelected
          ? "var(--cv4-active-highlight)"
          : active
            ? "var(--cv4-hover-highlight)"
            : "transparent",
        borderRadius: 6,
        margin: "0 4px",
        transition: "background 80ms",
      }}
    >
      {/* Selected indicator */}
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: isSelected ? "var(--ob-primary, #00D1FF)" : "transparent",
          flexShrink: 0,
        }}
      />

      <ProviderIcon name={model.provider_name} size={14} />

      <span
        style={{
          flex: 1,
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          fontWeight: 400,
          lineHeight: 1.5,
          color: "var(--cv4-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {model.display_name}
      </span>

      <span
        style={{
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 12,
          fontWeight: 400,
          lineHeight: 1.3,
          color: "var(--cv4-text-muted)",
          flexShrink: 0,
        }}
      >
        {formatPrice(model)}
      </span>
    </div>
  );
}
