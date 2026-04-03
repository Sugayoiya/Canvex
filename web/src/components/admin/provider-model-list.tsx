"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { aiProvidersApi } from "@/lib/api";

interface ProviderModel {
  id: string;
  display_name: string;
  model_name: string;
  model_type: string;
  capabilities: string[];
  is_enabled: boolean;
  is_preset: boolean;
  input_token_limit: number | null;
  output_token_limit: number | null;
  pricing: {
    id: string;
    pricing_model: string;
    input_price_per_1k: string | null;
    output_price_per_1k: string | null;
    price_per_image: string | null;
    price_per_second: string | null;
    is_active: boolean;
  } | null;
}

interface ProviderModelListProps {
  providerId: string;
}

export function ProviderModelList({ providerId }: ProviderModelListProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newModelType, setNewModelType] = useState("llm");

  const { data: models, isLoading } = useQuery({
    queryKey: ["admin", "provider-models", providerId],
    queryFn: () =>
      aiProvidersApi.listProviderModels(providerId).then((r) => r.data as ProviderModel[]),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ modelId, isEnabled }: { modelId: string; isEnabled: boolean }) =>
      aiProvidersApi.updateProviderModel(providerId, modelId, { is_enabled: isEnabled }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-models", providerId] });
      const model = models?.find((m) => m.id === vars.modelId);
      const name = model?.display_name || model?.model_name || "model";
      toast.success(vars.isEnabled ? `Model enabled: ${name}` : `Model disabled: ${name}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to toggle model: ${msg}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { model_name: string; display_name: string; model_type: string }) =>
      aiProvidersApi.createProviderModel(providerId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-models", providerId] });
      toast.success(`Model added: ${vars.display_name || vars.model_name}`);
      setNewModelName("");
      setNewDisplayName("");
      setNewModelType("llm");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to add model: ${msg}`);
    },
  });

  const modelList = models ?? [];
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  const handleAddModel = () => {
    if (!newModelName.trim()) return;
    createMutation.mutate({
      model_name: newModelName.trim(),
      display_name: newDisplayName.trim() || newModelName.trim(),
      model_type: newModelType,
    });
  };

  return (
    <div>
      <div
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((v) => !v);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Chevron size={14} style={{ color: "var(--cv4-text-secondary)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: 12,
            fontFamily: "Manrope, sans-serif",
            fontWeight: 700,
            color: "var(--cv4-text-secondary)",
          }}
        >
          Models ({modelList.length})
        </span>
        {isLoading && (
          <Loader2
            size={12}
            style={{
              color: "var(--cv4-text-muted)",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </div>

      {isExpanded && (
        <div style={{ marginTop: 8 }}>
          {modelList.length === 0 && !isLoading ? (
            <div
              style={{
                padding: "12px 0",
                textAlign: "center",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-muted)",
              }}
            >
              No models
            </div>
          ) : (
            modelList.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                isToggling={
                  toggleMutation.isPending &&
                  (toggleMutation.variables as { modelId: string } | undefined)?.modelId === model.id
                }
                onToggle={(enabled) =>
                  toggleMutation.mutate({ modelId: model.id, isEnabled: enabled })
                }
              />
            ))
          )}

          {/* Add model form */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 0",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Model ID (e.g. gpt-4o-mini)"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddModel();
              }}
              style={{
                flex: 1,
                minWidth: 140,
                height: 32,
                padding: "0 8px",
                fontFamily: "Space Grotesk, monospace",
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
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddModel();
              }}
              style={{
                flex: 1,
                minWidth: 120,
                height: 32,
                padding: "0 8px",
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
            <select
              value={newModelType}
              onChange={(e) => setNewModelType(e.target.value)}
              style={{
                width: 80,
                height: 32,
                padding: "0 8px",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-primary)",
                background: "var(--cv4-canvas-bg)",
                border: "1px solid var(--cv4-border-default)",
                borderRadius: 8,
                outline: "none",
              }}
            >
              <option value="llm">LLM</option>
              <option value="image">Image</option>
            </select>
            <button
              type="button"
              onClick={handleAddModel}
              disabled={!newModelName.trim() || createMutation.isPending}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 8,
                border: "none",
                background: "var(--cv4-btn-secondary)",
                color: "var(--cv4-btn-secondary-text)",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                cursor: createMutation.isPending ? "not-allowed" : "pointer",
                opacity: !newModelName.trim() || createMutation.isPending ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {createMutation.isPending ? "..." : "Add"}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function formatPrice(raw: string | null | undefined): string {
  if (!raw) return "—";
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  if (n === 0) return "$0";
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function ModelRow({
  model,
  isToggling,
  onToggle,
}: {
  model: ProviderModel;
  isToggling: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  const contextStr = model.input_token_limit
    ? `${Math.floor(model.input_token_limit / 1000)}K`
    : "—";

  let pricingStr: string;
  let pricingColor: string;
  if (model.pricing?.input_price_per_1k) {
    pricingStr = `${formatPrice(model.pricing.input_price_per_1k)} / ${formatPrice(model.pricing.output_price_per_1k)}`;
    pricingColor = "var(--cv4-text-secondary)";
  } else if (model.pricing?.price_per_image) {
    pricingStr = `${formatPrice(model.pricing.price_per_image)}/img`;
    pricingColor = "var(--cv4-text-secondary)";
  } else {
    pricingStr = "Unpriced";
    pricingColor = "var(--cv4-text-muted)";
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "3fr 1fr 1fr 2fr 44px",
        alignItems: "center",
        minHeight: 44,
        borderBottom: "1px solid var(--cv4-border-subtle)",
        background: hover ? "var(--cv4-hover-highlight)" : "transparent",
        transition: "background 100ms",
        padding: "4px 4px",
        gap: 12,
      }}
    >
      {/* Name: display_name + model_name */}
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontSize: 12,
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {model.display_name || model.model_name}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "Space Grotesk, monospace",
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: 1,
          }}
        >
          {model.model_name}
        </div>
      </div>
      {/* Type */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "Manrope, sans-serif",
          fontWeight: 400,
          color: "var(--cv4-text-muted)",
          textAlign: "center",
        }}
      >
        {model.model_type === "llm" ? "LLM" : model.model_type === "image" ? "Image" : model.model_type}
      </span>
      {/* Context */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 400,
          color: "var(--cv4-text-muted)",
          textAlign: "center",
        }}
      >
        {contextStr}
      </span>
      {/* Pricing */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 400,
          color: pricingColor,
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={pricingStr}
      >
        {pricingStr}
      </span>
      {/* Toggle */}
      <span style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          role="switch"
          aria-checked={model.is_enabled}
          aria-label={`Toggle model ${model.display_name || model.model_name}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isToggling) onToggle(!model.is_enabled);
          }}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: "none",
            padding: 2,
            background: model.is_enabled ? "var(--ob-success)" : "var(--cv4-text-muted)",
            cursor: isToggling ? "not-allowed" : "pointer",
            opacity: isToggling ? 0.7 : 1,
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
              transform: model.is_enabled ? "translateX(16px)" : "translateX(0)",
            }}
          />
        </button>
      </span>
    </div>
  );
}
