"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/stores/auth-store";
import { aiProvidersApi, billingApi } from "@/lib/api";
import { Plus, Zap } from "lucide-react";

interface AIProvider {
  id: string;
  provider_name: string;
  display_name: string;
  is_active?: boolean;
  models?: { id: string; name: string; display_name?: string }[];
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#4285F4",
  openai: "#10A37F",
  deepseek: "#7C3AED",
  comfyui: "#F59E0B",
};

export default function AIConsolePage() {
  const { currentSpace } = useAuthStore();

  const { data: providers = [], isLoading } = useQuery<AIProvider[]>({
    queryKey: ["ai-providers", currentSpace],
    queryFn: () =>
      aiProvidersApi
        .list({
          owner_type: currentSpace.type === "team" ? "team" : "system",
          owner_id:
            currentSpace.type === "team" ? currentSpace.teamId : undefined,
        })
        .then((r) => r.data),
  });

  const { data: usageStats } = useQuery({
    queryKey: ["billing-usage-stats"],
    queryFn: () => billingApi.usageStats().then((r) => r.data),
  });

  const totalSpend =
    typeof usageStats?.total_cost === "number"
      ? `$${usageStats.total_cost.toFixed(2)}`
      : "$0.00";
  const apiCalls = usageStats?.total_calls ?? 0;

  const stats = [
    { label: "Total Spend This Month", value: totalSpend },
    { label: "API Calls", value: apiCalls },
    { label: "Service Health", value: "Operational" },
    { label: "Monthly Budget", value: "—" },
  ];

  return (
    <AppShell>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 32,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--ob-text-primary)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            AI Console
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--ob-text-muted)",
              margin: "6px 0 0",
            }}
          >
            Model providers, billing & usage
          </p>
        </div>
        <button
          type="button"
          style={{
            border: "1px solid var(--ob-glass-border)",
            background: "transparent",
            color: "var(--ob-text-primary)",
            borderRadius: 6,
            padding: "8px 20px",
            fontFamily: "var(--font-headline)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            cursor: "pointer",
            transition: "border-color 200ms",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--ob-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--ob-glass-border)";
          }}
        >
          <Plus size={12} />
          Add Provider
        </button>
      </div>

      {/* Provider cards */}
      {isLoading ? (
        <div style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
          Loading providers...
        </div>
      ) : providers.length === 0 ? (
        <div
          style={{
            background: "var(--ob-glass-bg)",
            border: "1px solid var(--ob-glass-border)",
            borderRadius: 12,
            padding: "40px 20px",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <Zap
            size={32}
            style={{ color: "var(--ob-text-muted)", marginBottom: 8 }}
          />
          <p style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
            No AI providers configured. Add one to get started.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
            marginBottom: 32,
          }}
        >
          {providers.map((provider) => {
            const providerKey = provider.provider_name?.toLowerCase() || "";
            const iconColor =
              PROVIDER_COLORS[providerKey] || "var(--ob-primary)";
            const isActive = provider.is_active !== false;

            return (
              <div
                key={provider.id}
                style={{
                  background: "var(--ob-glass-bg)",
                  border: "1px solid var(--ob-glass-border)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 16,
                  padding: "20px 22px",
                  transition: "all 300ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--ob-glass-hover-border)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--ob-glass-border)";
                }}
              >
                {/* Provider header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: `${iconColor}22`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-headline)",
                        fontSize: 16,
                        fontWeight: 700,
                        color: iconColor,
                      }}
                    >
                      {(
                        provider.display_name || provider.provider_name
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--ob-text-primary)",
                      }}
                    >
                      {provider.display_name || provider.provider_name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isActive
                          ? "var(--ob-success)"
                          : "var(--ob-text-muted)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: isActive
                          ? "var(--ob-success)"
                          : "var(--ob-text-muted)",
                      }}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Model tags */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 14,
                  }}
                >
                  {(provider.models || []).slice(0, 5).map((model) => (
                    <span
                      key={model.id}
                      style={{
                        background: "var(--ob-surface-highest)",
                        borderRadius: 12,
                        padding: "2px 8px",
                        fontSize: 11,
                        color: "var(--ob-text-secondary)",
                      }}
                    >
                      {model.display_name || model.name}
                    </span>
                  ))}
                  {(provider.models || []).length > 5 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ob-text-muted)",
                        padding: "2px 4px",
                      }}
                    >
                      +{(provider.models || []).length - 5} more
                    </span>
                  )}
                </div>

                {/* Usage bar placeholder */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--ob-text-muted)",
                    }}
                  >
                    Usage this month
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ob-text-primary)",
                    }}
                  >
                    —
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "var(--ob-surface-high)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "30%",
                      height: "100%",
                      borderRadius: 2,
                      background: "var(--ob-gradient-primary)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Billing stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--ob-glass-bg)",
              border: "1px solid var(--ob-glass-border)",
              backdropFilter: "blur(12px)",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ob-text-muted)",
                marginTop: 2,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
