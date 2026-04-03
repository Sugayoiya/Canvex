"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Trash2 } from "lucide-react";
import { aiProvidersApi } from "@/lib/api";
import type { ParameterRule, ParameterRuleTemplate } from "@/lib/api";

const MODEL_TYPES = [
  { value: "llm", label: "LLM" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "text-embedding", label: "Text Embedding" },
  { value: "rerank", label: "Rerank" },
  { value: "tts", label: "TTS" },
  { value: "speech2text", label: "Speech to Text" },
];

const FEATURE_OPTIONS = ["vision", "tool-call", "multi-tool-call", "stream-tool-call", "agent-thought"];
const INPUT_TYPE_OPTIONS = ["text", "image", "video", "audio", "pdf"];
const OUTPUT_TYPE_OPTIONS = ["text", "image", "video", "audio"];
const MODE_OPTIONS = ["chat", "completion"];

export interface ModelFormData {
  model_name: string;
  display_name: string;
  model_type: string;
  features: string[];
  input_types: string[];
  output_types: string[];
  model_properties: Record<string, unknown>;
  parameter_rules: ParameterRule[];
  input_token_limit: number | null;
  output_token_limit: number | null;
  deprecated: boolean;
  pricing_model: string;
  input_price_per_1k: string;
  output_price_per_1k: string;
  price_per_image: string;
}

interface ModelFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ModelFormData) => void;
  mode: "create" | "edit";
  initialData?: Partial<ModelFormData>;
  isPreset?: boolean;
  isSubmitting?: boolean;
}

const emptyForm: ModelFormData = {
  model_name: "",
  display_name: "",
  model_type: "llm",
  features: [],
  input_types: ["text"],
  output_types: ["text"],
  model_properties: { mode: "chat" },
  parameter_rules: [],
  input_token_limit: null,
  output_token_limit: null,
  deprecated: false,
  pricing_model: "per_token",
  input_price_per_1k: "",
  output_price_per_1k: "",
  price_per_image: "",
};

export function ModelFormModal({
  open,
  onClose,
  onSubmit,
  mode,
  initialData,
  isPreset = false,
  isSubmitting = false,
}: ModelFormModalProps) {
  const [form, setForm] = useState<ModelFormData>({ ...emptyForm });

  const { data: templates } = useQuery({
    queryKey: ["parameter-templates"],
    queryFn: () =>
      aiProvidersApi.getParameterTemplates().then((r) => r.data as Record<string, ParameterRuleTemplate>),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({
          ...emptyForm,
          ...initialData,
          model_properties: initialData.model_properties ?? { mode: "chat" },
          parameter_rules: initialData.parameter_rules ?? [],
          features: initialData.features ?? [],
          input_types: initialData.input_types ?? ["text"],
          output_types: initialData.output_types ?? ["text"],
        });
      } else {
        setForm({ ...emptyForm });
      }
    }
  }, [open, initialData]);

  const updateField = useCallback(<K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleChip = useCallback((field: "features" | "input_types" | "output_types", val: string) => {
    setForm((prev) => {
      const arr = prev[field] as string[];
      return { ...prev, [field]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  }, []);

  const updateProp = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      model_properties: { ...prev.model_properties, [key]: value },
    }));
  }, []);

  const addRule = useCallback((templateName?: string) => {
    const newRule: ParameterRule = templateName
      ? { name: templateName, use_template: templateName }
      : { name: "", type: "float" };
    setForm((prev) => ({ ...prev, parameter_rules: [...prev.parameter_rules, newRule] }));
  }, []);

  const updateRule = useCallback((idx: number, patch: Partial<ParameterRule>) => {
    setForm((prev) => {
      const rules = [...prev.parameter_rules];
      rules[idx] = { ...rules[idx], ...patch };
      return { ...prev, parameter_rules: rules };
    });
  }, []);

  const removeRule = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      parameter_rules: prev.parameter_rules.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleSubmit = () => {
    if (!form.model_name.trim() || !form.display_name.trim()) return;
    onSubmit(form);
  };

  if (!open) return null;

  const templateNames = templates ? Object.keys(templates) : [];

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 680,
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--cv4-surface-popup)",
          borderRadius: 16,
          border: "1px solid var(--cv4-border-default)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 80px rgba(0,0,0,0.2)",
          padding: "24px 28px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "Manrope, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "var(--cv4-text-primary)",
            }}
          >
            {mode === "create" ? "Add Model" : "Edit Model"}
          </h2>
          <button type="button" onClick={onClose} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Basic Info */}
        <Section title="Basic Info">
          <FieldRow label="Model ID">
            <input
              value={form.model_name}
              onChange={(e) => updateField("model_name", e.target.value)}
              placeholder="e.g. gpt-4o"
              disabled={mode === "edit" && isPreset}
              style={{ ...inputStyle, fontFamily: "Space Grotesk, monospace" }}
            />
          </FieldRow>
          <FieldRow label="Display Name">
            <input
              value={form.display_name}
              onChange={(e) => updateField("display_name", e.target.value)}
              placeholder="e.g. GPT-4o"
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Model Type">
            <select
              value={form.model_type}
              onChange={(e) => updateField("model_type", e.target.value)}
              style={inputStyle}
            >
              {MODEL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </FieldRow>
        </Section>

        {/* Section 2: Features & IO Types */}
        <Section title="Features & IO Types">
          <FieldRow label="Features">
            <ChipGroup options={FEATURE_OPTIONS} selected={form.features} onToggle={(v) => toggleChip("features", v)} />
          </FieldRow>
          <FieldRow label="Input Types">
            <ChipGroup options={INPUT_TYPE_OPTIONS} selected={form.input_types} onToggle={(v) => toggleChip("input_types", v)} />
          </FieldRow>
          <FieldRow label="Output Types">
            <ChipGroup options={OUTPUT_TYPE_OPTIONS} selected={form.output_types} onToggle={(v) => toggleChip("output_types", v)} />
          </FieldRow>
        </Section>

        {/* Section 3: Model Properties */}
        <Section title="Model Properties">
          {(form.model_type === "llm" || form.model_type === "image") && (
            <FieldRow label="Mode">
              <select
                value={(form.model_properties?.mode as string) || "chat"}
                onChange={(e) => updateProp("mode", e.target.value)}
                style={inputStyle}
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </FieldRow>
          )}
          {form.model_type === "llm" && (
            <FieldRow label="Context Size">
              <input
                type="number"
                value={(form.model_properties?.context_size as number) ?? ""}
                onChange={(e) => updateProp("context_size", e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g. 128000"
                style={inputStyle}
              />
            </FieldRow>
          )}
          <FieldRow label="Deprecated">
            <ToggleSwitch checked={form.deprecated} onChange={(v) => updateField("deprecated", v)} />
          </FieldRow>
        </Section>

        {/* Section 4: Parameter Rules */}
        <Section title="Parameter Rules">
          {form.parameter_rules.map((rule, idx) => (
            <RuleRow
              key={idx}
              rule={rule}
              templates={templates}
              templateNames={templateNames}
              onChange={(patch) => updateRule(idx, patch)}
              onRemove={() => removeRule(idx)}
            />
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {templateNames.filter((t) => !form.parameter_rules.some((r) => r.name === t)).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addRule(t)}
                style={{
                  ...chipStyle(false),
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  border: "1px dashed var(--cv4-border-default)",
                }}
              >
                <Plus size={12} /> {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addRule()}
              style={{
                ...chipStyle(false),
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                border: "1px dashed var(--cv4-border-default)",
              }}
            >
              <Plus size={12} /> Custom
            </button>
          </div>
        </Section>

        {/* Section 5: Token Limits */}
        <Section title="Token Limits">
          <FieldRow label="Input Token Limit">
            <input
              type="number"
              value={form.input_token_limit ?? ""}
              onChange={(e) => updateField("input_token_limit", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 128000"
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Output Token Limit">
            <input
              type="number"
              value={form.output_token_limit ?? ""}
              onChange={(e) => updateField("output_token_limit", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 16384"
              style={inputStyle}
            />
          </FieldRow>
        </Section>

        {/* Section 6: Pricing */}
        <Section title="Pricing (optional)">
          <FieldRow label="Pricing Model">
            <select
              value={form.pricing_model}
              onChange={(e) => updateField("pricing_model", e.target.value)}
              style={inputStyle}
            >
              <option value="per_token">Per Token</option>
              <option value="per_image">Per Image</option>
            </select>
          </FieldRow>
          {form.pricing_model === "per_token" && (
            <>
              <FieldRow label="Input $/1K tokens">
                <input
                  value={form.input_price_per_1k}
                  onChange={(e) => updateField("input_price_per_1k", e.target.value)}
                  placeholder="e.g. 0.0025"
                  style={inputStyle}
                />
              </FieldRow>
              <FieldRow label="Output $/1K tokens">
                <input
                  value={form.output_price_per_1k}
                  onChange={(e) => updateField("output_price_per_1k", e.target.value)}
                  placeholder="e.g. 0.01"
                  style={inputStyle}
                />
              </FieldRow>
            </>
          )}
          {form.pricing_model === "per_image" && (
            <FieldRow label="$/Image">
              <input
                value={form.price_per_image}
                onChange={(e) => updateField("price_per_image", e.target.value)}
                placeholder="e.g. 0.04"
                style={inputStyle}
              />
            </FieldRow>
          )}
        </Section>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!form.model_name.trim() || !form.display_name.trim() || isSubmitting}
            style={{
              ...submitBtnStyle,
              opacity: !form.model_name.trim() || !form.display_name.trim() || isSubmitting ? 0.5 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontFamily: "Manrope, sans-serif",
          fontSize: 13,
          fontWeight: 800,
          color: "var(--cv4-text-secondary)",
          borderBottom: "1px solid var(--cv4-border-subtle)",
          paddingBottom: 6,
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 12 }}>
      <span
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--cv4-text-secondary)",
        }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            style={chipStyle(active)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        padding: 2,
        background: checked ? "var(--ob-success)" : "var(--cv4-text-muted)",
        cursor: "pointer",
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
          transform: checked ? "translateX(16px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

function RuleRow({
  rule,
  templates,
  templateNames,
  onChange,
  onRemove,
}: {
  rule: ParameterRule;
  templates?: Record<string, ParameterRuleTemplate> | null;
  templateNames: string[];
  onChange: (patch: Partial<ParameterRule>) => void;
  onRemove: () => void;
}) {
  const tpl = rule.use_template && templates ? templates[rule.use_template] : null;
  const effectiveLabel = rule.label ?? tpl?.label ?? "";
  const effectiveType = rule.type ?? tpl?.type ?? "float";
  const effectiveDefault = rule.default ?? tpl?.default ?? "";
  const defaultStr = typeof effectiveDefault === "boolean" ? String(effectiveDefault) : effectiveDefault;
  const effectiveMin = rule.min ?? tpl?.min ?? "";
  const effectiveMax = rule.max ?? tpl?.max ?? "";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 60px 60px 60px 60px 28px",
        gap: 6,
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid var(--cv4-border-subtle)",
      }}
    >
      <input
        value={rule.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Name"
        disabled={!!rule.use_template}
        style={{ ...smallInputStyle, fontFamily: "Space Grotesk, monospace" }}
      />
      <select
        value={rule.use_template || ""}
        onChange={(e) => {
          const tmpl = e.target.value;
          if (tmpl) {
            onChange({ use_template: tmpl, name: tmpl });
          } else {
            onChange({ use_template: undefined });
          }
        }}
        style={smallInputStyle}
      >
        <option value="">Custom</option>
        {templateNames.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input
        value={effectiveType}
        onChange={(e) => onChange({ type: e.target.value })}
        placeholder="Type"
        style={smallInputStyle}
        title="Type"
      />
      <input
        value={defaultStr}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ default: v === "" ? undefined : isNaN(Number(v)) ? v : Number(v) });
        }}
        placeholder="Default"
        style={smallInputStyle}
        title="Default"
      />
      <input
        value={effectiveMin}
        onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
        placeholder="Min"
        style={smallInputStyle}
        title="Min"
      />
      <input
        value={effectiveMax}
        onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
        placeholder="Max"
        style={smallInputStyle}
        title="Max"
      />
      <button type="button" onClick={onRemove} style={{ ...iconBtnStyle, width: 24, height: 24 }}>
        <Trash2 size={14} style={{ color: "var(--ob-error, #e53e3e)" }} />
      </button>
    </div>
  );
}

/* ── Styles ── */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  fontFamily: "Manrope, sans-serif",
  fontSize: 13,
  fontWeight: 400,
  color: "var(--cv4-text-primary)",
  background: "var(--cv4-canvas-bg)",
  border: "1px solid var(--cv4-border-default)",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  height: 28,
  fontSize: 11,
  padding: "0 6px",
  borderRadius: 6,
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 6,
    border: active ? "1px solid var(--cv4-accent)" : "1px solid var(--cv4-border-default)",
    background: active ? "var(--cv4-accent-bg, rgba(59,130,246,0.1))" : "transparent",
    color: active ? "var(--cv4-accent)" : "var(--cv4-text-secondary)",
    fontFamily: "Manrope, sans-serif",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 150ms",
  };
}

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--cv4-text-muted)",
  borderRadius: 6,
  padding: 4,
};

const cancelBtnStyle: React.CSSProperties = {
  height: 36,
  padding: "0 20px",
  borderRadius: 8,
  border: "1px solid var(--cv4-border-default)",
  background: "transparent",
  color: "var(--cv4-text-secondary)",
  fontFamily: "Manrope, sans-serif",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const submitBtnStyle: React.CSSProperties = {
  height: 36,
  padding: "0 24px",
  borderRadius: 8,
  border: "none",
  background: "var(--cv4-accent)",
  color: "white",
  fontFamily: "Manrope, sans-serif",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
