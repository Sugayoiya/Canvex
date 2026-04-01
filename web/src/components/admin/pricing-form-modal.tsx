"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown } from "lucide-react";

interface PricingRule {
  id: string;
  provider: string;
  model: string;
  model_type: string;
  pricing_model: string;
  input_price_per_1k: number | null;
  output_price_per_1k: number | null;
  price_per_image: number | null;
  price_per_request: number | null;
  price_per_second: number | null;
  is_active: boolean;
  notes: string | null;
}

export interface ProviderOption {
  id: string;
  provider_name: string;
  display_name: string;
}

export interface ModelOption {
  id: string;
  model_name: string;
  display_name: string;
  model_type: string;
  providers: string[];
}

interface PricingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
  editData?: PricingRule | null;
  providers?: ProviderOption[];
  models?: ModelOption[];
}

const PRICING_FIELDS: Record<string, { key: string; label: string }[]> = {
  per_token: [
    { key: "input_price_per_1k", label: "Input Price (per 1K tokens)" },
    { key: "output_price_per_1k", label: "Output Price (per 1K tokens)" },
  ],
  fixed_request: [{ key: "price_per_request", label: "Price per Request" }],
  per_image: [{ key: "price_per_image", label: "Price per Image" }],
  per_second: [{ key: "price_per_second", label: "Price per Second" }],
};

const MODEL_TYPE_OPTIONS = [
  { value: "llm", label: "LLM" },
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
];

const PRICING_MODEL_OPTIONS = [
  { value: "per_token", label: "Per Token" },
  { value: "fixed_request", label: "Fixed Request" },
  { value: "per_image", label: "Per Image" },
  { value: "per_second", label: "Per Second" },
];

type FormState = {
  provider: string;
  model: string;
  model_type: string;
  pricing_model: string;
  input_price_per_1k: string;
  output_price_per_1k: string;
  price_per_image: string;
  price_per_request: string;
  price_per_second: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  provider: "",
  model: "",
  model_type: "llm",
  pricing_model: "per_token",
  input_price_per_1k: "",
  output_price_per_1k: "",
  price_per_image: "",
  price_per_request: "",
  price_per_second: "",
  notes: "",
};

function toStr(v: number | null | undefined): string {
  return v != null ? String(v) : "";
}

export function PricingFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  editData,
  providers = [],
  models = [],
}: PricingFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const isEdit = !!editData;

  const providerNames = useMemo(() => {
    const names = providers.map((p) => p.display_name);
    return [...new Set(names)];
  }, [providers]);

  const filteredModels = useMemo(() => {
    if (!form.provider) return models;
    return models.filter(
      (m) =>
        m.providers.length === 0 ||
        m.providers.some((p) => p.toLowerCase() === form.provider.toLowerCase())
    );
  }, [models, form.provider]);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setForm({
          provider: editData.provider,
          model: editData.model,
          model_type: editData.model_type,
          pricing_model: editData.pricing_model,
          input_price_per_1k: toStr(editData.input_price_per_1k),
          output_price_per_1k: toStr(editData.output_price_per_1k),
          price_per_image: toStr(editData.price_per_image),
          price_per_request: toStr(editData.price_per_request),
          price_per_second: toStr(editData.price_per_second),
          notes: editData.notes ?? "",
        });
      } else {
        setForm(INITIAL_FORM);
      }
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [isOpen, editData]);

  useEffect(() => {
    const applicableKeys = new Set(
      (PRICING_FIELDS[form.pricing_model] ?? []).map((f) => f.key)
    );
    const allPriceKeys = [
      "input_price_per_1k",
      "output_price_per_1k",
      "price_per_image",
      "price_per_request",
      "price_per_second",
    ] as const;
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;
      allPriceKeys.forEach((k) => {
        if (!applicableKeys.has(k) && next[k] !== "") {
          next[k] = "";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [form.pricing_model]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => cancelRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const els = [cancelRef.current, submitRef.current].filter(
          Boolean
        ) as HTMLElement[];
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

  const canSubmit = form.provider.trim() !== "" && form.model.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit || isLoading) return;
    const payload: Record<string, unknown> = {
      provider: form.provider,
      model: form.model,
      model_type: form.model_type,
      pricing_model: form.pricing_model,
      notes: form.notes || null,
    };
    const fields = PRICING_FIELDS[form.pricing_model] ?? [];
    fields.forEach(({ key }) => {
      const val = form[key as keyof FormState];
      payload[key] = val ? val : null;
    });
    onSubmit(payload);
  };

  const updateField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const titleId = "pricing-form-modal-title";

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "Space Grotesk, sans-serif",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--cv4-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Manrope, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "var(--cv4-text-muted)",
    marginBottom: 4,
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 36,
    background: "var(--cv4-canvas-bg)",
    border: "1px solid var(--cv4-border-default)",
    borderRadius: 8,
    padding: "0 12px",
    fontFamily: "Manrope, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "var(--cv4-text-primary)",
    outline: "none",
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
          width: 520,
          maxHeight: "80vh",
          overflowY: "auto",
          padding: 24,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "scale(1)" : "scale(0.96)",
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center" }}>
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
            {isEdit ? `Edit Pricing Rule — ${editData.model}` : "Create Pricing Rule"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--cv4-text-muted)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Basic Info */}
        <div style={{ ...sectionTitleStyle, marginTop: 24 }}>Basic Info</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Provider</label>
            {isEdit ? (
              <input type="text" value={form.provider} readOnly style={{ ...inputStyle, opacity: 0.6 }} />
            ) : providerNames.length > 0 ? (
              <div style={{ position: "relative" }}>
                <select
                  value={form.provider}
                  onChange={(e) => {
                    updateField("provider", e.target.value);
                    updateField("model", "");
                  }}
                  style={{ ...inputStyle, appearance: "none", paddingRight: 32, cursor: "pointer" }}
                >
                  <option value="">Select a provider...</option>
                  {providerNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--cv4-text-muted)", pointerEvents: "none" }} />
              </div>
            ) : (
              <input type="text" value={form.provider} onChange={(e) => updateField("provider", e.target.value)} placeholder="e.g. OpenAI" required style={inputStyle} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Model</label>
            {isEdit ? (
              <input type="text" value={form.model} readOnly style={{ ...inputStyle, opacity: 0.6 }} />
            ) : filteredModels.length > 0 ? (
              <div style={{ position: "relative" }}>
                <select
                  value={form.model}
                  onChange={(e) => {
                    const selected = e.target.value;
                    updateField("model", selected);
                    const matched = models.find((m) => m.model_name === selected);
                    if (matched) {
                      updateField("model_type", matched.model_type);
                    }
                  }}
                  style={{ ...inputStyle, appearance: "none", paddingRight: 32, cursor: "pointer" }}
                >
                  <option value="">Select a model...</option>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.model_name}>
                      {m.display_name} ({m.model_name})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--cv4-text-muted)", pointerEvents: "none" }} />
              </div>
            ) : (
              <input type="text" value={form.model} onChange={(e) => updateField("model", e.target.value)} placeholder="e.g. gpt-4o" required style={inputStyle} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Model Type</label>
            <ToggleGroup
              options={MODEL_TYPE_OPTIONS}
              value={form.model_type}
              onChange={(v) => updateField("model_type", v)}
              groupLabel="Model type"
            />
          </div>
        </div>

        {/* Pricing Model */}
        <div style={{ ...sectionTitleStyle, marginTop: 24 }}>Pricing Model</div>
        <ToggleGroup
          options={PRICING_MODEL_OPTIONS}
          value={form.pricing_model}
          onChange={(v) => updateField("pricing_model", v)}
          groupLabel="Pricing model"
        />

        {/* Rate Configuration */}
        <div style={{ ...sectionTitleStyle, marginTop: 24 }}>Rate Configuration</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(PRICING_FIELDS[form.pricing_model] ?? []).map(({ key, label }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    color: "var(--cv4-text-muted)",
                    pointerEvents: "none",
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form[key as keyof FormState]}
                  onChange={(e) => updateField(key as keyof FormState, e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 24 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div style={{ ...sectionTitleStyle, marginTop: 24 }}>Notes</div>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Optional notes..."
          style={{
            ...inputStyle,
            height: 64,
            resize: "vertical",
            padding: "8px 12px",
          }}
        />

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 24,
            borderTop: "1px solid var(--cv4-border-subtle)",
            paddingTop: 24,
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
            {isEdit ? "Cancel" : "Discard"}
          </button>
          <button
            ref={submitRef}
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
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
              cursor: !canSubmit || isLoading ? "not-allowed" : "pointer",
              opacity: !canSubmit || isLoading ? 0.7 : 1,
              pointerEvents: !canSubmit || isLoading ? "none" : "auto",
            }}
          >
            {isLoading ? "..." : isEdit ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
  groupLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  groupLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      style={{
        display: "flex",
        border: "1px solid var(--cv4-border-default)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            style={{
              height: 32,
              padding: "0 12px",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              cursor: "pointer",
              border: "none",
              background: isActive ? "var(--cv4-active-highlight)" : "transparent",
              color: isActive ? "var(--cv4-text-primary)" : "var(--cv4-text-muted)",
              transition: "background 100ms, color 100ms",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
