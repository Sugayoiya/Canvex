"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { aiProvidersApi } from "@/lib/api";
import type { ParameterRule } from "@/lib/api";
import { ModelFormModal, type ModelFormData } from "./model-form-modal";

export interface ProviderModel {
  id: string;
  display_name: string;
  model_name: string;
  model_type: string;
  features: string[];
  is_enabled: boolean;
  is_preset: boolean;
  input_token_limit: number | null;
  output_token_limit: number | null;
  input_types: string[];
  output_types: string[];
  model_properties: Record<string, unknown> | null;
  parameter_rules: ParameterRule[];
  deprecated: boolean;
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editModel, setEditModel] = useState<ProviderModel | null>(null);

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
    mutationFn: (data: ModelFormData) =>
      aiProvidersApi.createProviderModel(providerId, {
        ...data,
        input_token_limit: data.input_token_limit ?? undefined,
        output_token_limit: data.output_token_limit ?? undefined,
        input_price_per_1k: data.input_price_per_1k || undefined,
        output_price_per_1k: data.output_price_per_1k || undefined,
        price_per_image: data.price_per_image || undefined,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-models", providerId] });
      toast.success(`Model added: ${vars.display_name || vars.model_name}`);
      setModalOpen(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to add model: ${msg}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ modelId, data }: { modelId: string; data: ModelFormData }) =>
      aiProvidersApi.updateProviderModel(providerId, modelId, {
        display_name: data.display_name,
        features: data.features,
        input_types: data.input_types,
        output_types: data.output_types,
        model_properties: data.model_properties,
        parameter_rules: data.parameter_rules,
        input_token_limit: data.input_token_limit ?? undefined,
        output_token_limit: data.output_token_limit ?? undefined,
        deprecated: data.deprecated,
        pricing_model: data.pricing_model || undefined,
        input_price_per_1k: data.input_price_per_1k || undefined,
        output_price_per_1k: data.output_price_per_1k || undefined,
        price_per_image: data.price_per_image || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-models", providerId] });
      toast.success("Model updated");
      setEditModel(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`Failed to update model: ${msg}`);
    },
  });

  const modelList = models ?? [];
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

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
                onEdit={() => setEditModel(model)}
              />
            ))
          )}

          {/* Add model button */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px dashed var(--cv4-border-default)",
              background: "transparent",
              color: "var(--cv4-text-secondary)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
              justifyContent: "center",
            }}
          >
            <Plus size={14} /> Add Model
          </button>
        </div>
      )}

      {/* Create modal */}
      <ModelFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="create"
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />

      {/* Edit modal */}
      <ModelFormModal
        open={!!editModel}
        onClose={() => setEditModel(null)}
        mode="edit"
        isPreset={editModel?.is_preset}
        initialData={
          editModel
            ? {
                model_name: editModel.model_name,
                display_name: editModel.display_name,
                model_type: editModel.model_type,
                features: editModel.features,
                input_types: editModel.input_types,
                output_types: editModel.output_types,
                model_properties: editModel.model_properties ?? { mode: "chat" },
                parameter_rules: editModel.parameter_rules,
                input_token_limit: editModel.input_token_limit,
                output_token_limit: editModel.output_token_limit,
                deprecated: editModel.deprecated,
                pricing_model: editModel.pricing?.pricing_model ?? "per_token",
                input_price_per_1k: editModel.pricing?.input_price_per_1k ?? "",
                output_price_per_1k: editModel.pricing?.output_price_per_1k ?? "",
                price_per_image: editModel.pricing?.price_per_image ?? "",
              }
            : undefined
        }
        onSubmit={(data) => editModel && updateMutation.mutate({ modelId: editModel.id, data })}
        isSubmitting={updateMutation.isPending}
      />

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
  onEdit,
}: {
  model: ProviderModel;
  isToggling: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
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
        gridTemplateColumns: "3fr 1fr 1fr 2fr 28px 44px",
        alignItems: "center",
        minHeight: 44,
        borderBottom: "1px solid var(--cv4-border-subtle)",
        background: hover ? "var(--cv4-hover-highlight)" : "transparent",
        transition: "background 100ms",
        padding: "4px 4px",
        gap: 12,
      }}
    >
      {/* Name: display_name + model_name + feature badges */}
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              color: model.deprecated ? "var(--cv4-text-muted)" : "var(--cv4-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: model.deprecated ? "line-through" : "none",
            }}
          >
            {model.display_name || model.model_name}
          </span>
          {model.features.slice(0, 3).map((f) => (
            <span
              key={f}
              style={{
                fontSize: 9,
                fontFamily: "Manrope, sans-serif",
                fontWeight: 600,
                padding: "1px 5px",
                borderRadius: 4,
                background: "var(--cv4-accent-bg, rgba(59,130,246,0.1))",
                color: "var(--cv4-accent)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {f}
            </span>
          ))}
          {model.features.length > 3 && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "Manrope, sans-serif",
                fontWeight: 600,
                color: "var(--cv4-text-muted)",
              }}
            >
              +{model.features.length - 3}
            </span>
          )}
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
      {/* Edit button */}
      <span style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--cv4-text-muted)",
            opacity: hover ? 1 : 0,
            transition: "opacity 150ms",
          }}
          title="Edit model"
        >
          <Pencil size={13} />
        </button>
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
