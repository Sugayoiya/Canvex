"use client";

import { useState, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Search,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { billingApi, aiProvidersApi } from "@/lib/api";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { RowDropdownMenu } from "@/components/admin/row-dropdown-menu";
import { ConfirmationModal } from "@/components/admin/confirmation-modal";
import { PricingFormModal } from "@/components/admin/pricing-form-modal";
import type { ProviderOption, ModelOption } from "@/components/admin/pricing-form-modal";
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary";

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
  effective_from: string;
  created_at: string;
  updated_at: string;
}

type ConfirmAction = "deactivate" | "activate";

const MODAL_COPY: Record<
  ConfirmAction,
  {
    icon: React.ReactNode;
    title: string;
    bodyFn: (model: string) => React.ReactNode;
    confirmLabel: string;
    confirmVariant: "primary" | "destructive";
  }
> = {
  deactivate: {
    icon: <ToggleLeft size={20} />,
    title: "Deactivate Rule",
    bodyFn: (model) => (
      <>
        Deactivate pricing for <strong>{model}</strong>? New API calls will not
        be billed against this rule.
      </>
    ),
    confirmLabel: "Deactivate Rule",
    confirmVariant: "primary",
  },
  activate: {
    icon: <ToggleRight size={20} />,
    title: "Activate Rule",
    bodyFn: (model) => (
      <>
        Activate pricing for <strong>{model}</strong>? API calls will be billed
        against this rule.
      </>
    ),
    confirmLabel: "Activate Rule",
    confirmVariant: "primary",
  },
};

function smartPriceDisplay(rule: PricingRule): React.ReactNode {
  const style: React.CSSProperties = {
    fontFamily: "Manrope, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "var(--cv4-text-secondary)",
  };
  switch (rule.pricing_model) {
    case "per_token":
      return (
        <span style={style}>
          In: ${String(rule.input_price_per_1k ?? 0)} / Out: $
          {String(rule.output_price_per_1k ?? 0)}
        </span>
      );
    case "fixed_request":
      return (
        <span style={style}>Fix: ${String(rule.price_per_request ?? 0)}</span>
      );
    case "per_image":
      return (
        <span style={style}>
          Fix: ${String(rule.price_per_image ?? 0)} Per Image
        </span>
      );
    case "per_second":
      return (
        <span style={style}>${String(rule.price_per_second ?? 0)}/sec</span>
      );
    default:
      return <span style={style}>—</span>;
  }
}

function PricingStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "4px 8px",
        borderRadius: 6,
        fontFamily: "Manrope, sans-serif",
        fontSize: 12,
        fontWeight: 700,
        background: isActive ? "#4CAF5020" : "#FFB4AB20",
        color: isActive ? "#4CAF50" : "#FFB4AB",
      }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function ModelTypeBadge({ type }: { type: string }) {
  const label = type === "llm" ? "LLM" : type === "image" ? "Image" : type === "audio" ? "Audio" : type;
  return (
    <span
      style={{
        fontFamily: "Manrope, sans-serif",
        fontSize: 12,
        fontWeight: 400,
        color: "var(--cv4-text-secondary)",
      }}
    >
      {label}
    </span>
  );
}

function summaryPriceText(rule: PricingRule): string {
  switch (rule.pricing_model) {
    case "per_token":
      return `In: $${String(rule.input_price_per_1k ?? 0)} Out: $${String(rule.output_price_per_1k ?? 0)}`;
    case "fixed_request":
      return `Fix: $${String(rule.price_per_request ?? 0)}`;
    case "per_image":
      return `Fix: $${String(rule.price_per_image ?? 0)} Per Image`;
    case "per_second":
      return `$${String(rule.price_per_second ?? 0)}/sec`;
    default:
      return "—";
  }
}

const columnHelper = createColumnHelper<PricingRule>();

export default function AdminPricingPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchValue] = useState("");
  const [formModal, setFormModal] = useState<{
    isOpen: boolean;
    editData: PricingRule | null;
  }>({ isOpen: false, editData: null });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: ConfirmAction | null;
    rule: PricingRule | null;
  }>({ isOpen: false, action: null, rule: null });

  const { data: allRules, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "pricing"],
    queryFn: () => billingApi.pricing().then((r) => r.data as PricingRule[]),
  });

  const { data: providersList } = useQuery({
    queryKey: ["ai-providers", "system"],
    queryFn: () => aiProvidersApi.list({ owner_type: "system" }).then((r) => r.data as ProviderOption[]),
  });

  const { data: modelsList } = useQuery({
    queryKey: ["ai-providers", "models"],
    queryFn: () => aiProvidersApi.listModels().then((r) => r.data as ModelOption[]),
  });

  const filteredRules = useMemo(() => {
    if (!allRules) return [];
    if (statusFilter === "all") return allRules;
    return allRules.filter((r) =>
      statusFilter === "active" ? r.is_active : !r.is_active
    );
  }, [allRules, statusFilter]);

  const summaryCards = useMemo(() => {
    if (!allRules) return [];
    return allRules.filter((r) => r.is_active).slice(0, 3);
  }, [allRules]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => billingApi.createPricing(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pricing"] });
      toast.success(`已创建 ${variables.model} 定价规则`);
      setFormModal({ isOpen: false, editData: null });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`操作失败: ${message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      billingApi.updatePricing(id, data),
    onSuccess: (_, { data: variables }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pricing"] });
      toast.success(`已更新 ${variables.model ?? ""} 定价规则`);
      setFormModal({ isOpen: false, editData: null });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`操作失败: ${message}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      billingApi.updatePricing(id, { is_active }),
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pricing"] });
      const model = confirmModal.rule?.model ?? "";
      toast.success(is_active ? `已启用 ${model} 定价规则` : `已停用 ${model} 定价规则`);
      setConfirmModal({ isOpen: false, action: null, rule: null });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Unknown error";
      toast.error(`操作失败: ${message}`);
    },
  });

  const anyPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    toggleMutation.isPending;

  const columns = useMemo(
    () => [
      columnHelper.accessor("provider", {
        header: "PROVIDER",
        size: 120,
        enableSorting: false,
        cell: (info) => (
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("model", {
        header: "MODEL",
        enableSorting: false,
        cell: (info) => (
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-secondary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("model_type", {
        header: "TYPE",
        size: 80,
        enableSorting: false,
        cell: (info) => <ModelTypeBadge type={info.getValue()} />,
      }),
      columnHelper.display({
        id: "price",
        header: "PRICE (PER 1K)",
        size: 160,
        cell: ({ row }) => smartPriceDisplay(row.original),
      }),
      columnHelper.accessor("is_active", {
        header: "STATUS",
        size: 100,
        enableSorting: false,
        cell: (info) => <PricingStatusBadge isActive={info.getValue()} />,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        size: 48,
        cell: ({ row }) => {
          const rule = row.original;
          return (
            <div
              style={{
                opacity: anyPending ? 0.4 : 1,
                pointerEvents: anyPending ? "none" : "auto",
              }}
            >
              <RowDropdownMenu
                triggerLabel={`Actions for ${rule.model}`}
                items={[
                  {
                    label: "Edit Rule",
                    icon: <Pencil size={14} />,
                    onClick: () =>
                      setFormModal({ isOpen: true, editData: rule }),
                  },
                  {
                    label: rule.is_active
                      ? "Deactivate Rule"
                      : "Activate Rule",
                    icon: rule.is_active ? (
                      <ToggleLeft size={14} />
                    ) : (
                      <ToggleRight size={14} />
                    ),
                    onClick: () =>
                      setConfirmModal({
                        isOpen: true,
                        action: rule.is_active ? "deactivate" : "activate",
                        rule,
                      }),
                  },
                ]}
              />
            </div>
          );
        },
      }),
    ],
    [anyPending]
  );

  const table = useReactTable({
    data: filteredRules,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasActiveFilters = statusFilter !== "all";

  const clearAllFilters = () => setStatusFilter("all");

  const handleFormSubmit = (data: Record<string, unknown>) => {
    if (formModal.editData) {
      updateMutation.mutate({ id: formModal.editData.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleConfirm = () => {
    if (!confirmModal.rule || !confirmModal.action) return;
    const newActive = confirmModal.action === "activate";
    toggleMutation.mutate({ id: confirmModal.rule.id, is_active: newActive });
  };

  const confirmCopy = confirmModal.action
    ? MODAL_COPY[confirmModal.action]
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* PageHeader */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            Pricing
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              lineHeight: 1.5,
              margin: "4px 0 0",
            }}
          >
            Configure model-level pricing and service rules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormModal({ isOpen: true, editData: null })}
          disabled={anyPending}
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
            cursor: anyPending ? "not-allowed" : "pointer",
            opacity: anyPending ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Plus size={14} />
          Create Pricing Rule
        </button>
      </div>

      <AdminErrorBoundary>
      {/* FilterToolbar */}
      <FilterToolbar
        searchValue={searchValue}
        onSearchChange={() => {}}
        searchPlaceholder="Search..."
        filters={[
          {
            value: statusFilter,
            onChange: (val) =>
              setStatusFilter(val as "all" | "active" | "inactive"),
            options: [
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
      />

      {/* Summary Cards */}
      {!isLoading && !isError && summaryCards.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {summaryCards.map((rule) => (
            <div
              key={rule.id}
              style={{
                width: "calc((100% - 32px) / 3)",
                minWidth: 200,
                height: 80,
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-subtle)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--cv4-text-muted)",
                    letterSpacing: "1px",
                  }}
                >
                  {rule.provider}
                </span>
                <PricingStatusBadge isActive={rule.is_active} />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--cv4-text-primary)",
                  }}
                >
                  {rule.model}
                </span>
                <span
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--cv4-text-secondary)",
                  }}
                >
                  {summaryPriceText(rule)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DataTable */}
      <AdminDataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyIcon={
          hasActiveFilters ? (
            <Search size={48} />
          ) : (
            <CreditCard size={48} />
          )
        }
        emptyHeading={
          hasActiveFilters
            ? "No pricing rules found"
            : "No pricing rules yet"
        }
        emptyBody={
          hasActiveFilters
            ? "Try adjusting your filters."
            : "Create your first pricing rule to start tracking model costs."
        }
        onClearFilters={hasActiveFilters ? clearAllFilters : undefined}
        skeletonWidths={[120, 140, 60, 140, 80, 32]}
      />

      {/* PricingFormModal */}
      <PricingFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, editData: null })}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editData={formModal.editData}
        providers={providersList}
        models={modelsList}
      />

      {/* Confirmation Modal */}
      {confirmCopy && confirmModal.rule && (
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() =>
            setConfirmModal({ isOpen: false, action: null, rule: null })
          }
          onConfirm={handleConfirm}
          title={confirmCopy.title}
          body={confirmCopy.bodyFn(confirmModal.rule.model)}
          confirmLabel={confirmCopy.confirmLabel}
          confirmVariant={confirmCopy.confirmVariant}
          icon={confirmCopy.icon}
          isLoading={toggleMutation.isPending}
        />
      )}
      </AdminErrorBoundary>
    </div>
  );
}
