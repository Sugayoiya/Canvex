"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { teamsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Plus, Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description?: string;
  member_count?: number;
  my_role?: string;
  created_at: string;
}

export default function TeamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTeams } = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: () =>
      teamsApi.list().then((r) => {
        setTeams(
          r.data.map((t: Team) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            my_role: t.my_role || "member",
          })),
        );
        return r.data;
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setDialogOpen(false);
      setTeamName("");
      setTeamDesc("");
    },
  });

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
            Teams
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--ob-text-muted)",
              margin: "6px 0 0",
            }}
          >
            {teams.length} teams
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
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
          Create Team
        </button>
      </div>

      {/* Teams grid */}
      {isLoading ? (
        <div style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
          Loading teams...
        </div>
      ) : teams.length === 0 ? (
        <div
          style={{
            background: "var(--ob-glass-bg)",
            border: "1px solid var(--ob-glass-border)",
            borderRadius: 12,
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <Users
            size={32}
            style={{ color: "var(--ob-text-muted)", marginBottom: 8 }}
          />
          <p style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
            No teams yet. Create one to start collaborating.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {teams.map((team) => (
            <div
              key={team.id}
              onClick={() => router.push(`/teams/${team.id}`)}
              style={{
                background: "var(--ob-glass-bg)",
                border: "1px solid var(--ob-glass-border)",
                backdropFilter: "blur(12px)",
                borderRadius: 16,
                padding: "20px 22px",
                cursor: "pointer",
                transition: "all 300ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor =
                  "var(--ob-glass-hover-border)";
                e.currentTarget.style.background = "var(--ob-glass-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--ob-glass-border)";
                e.currentTarget.style.background = "var(--ob-glass-bg)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--ob-surface-highest)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-headline)",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--ob-primary)",
                  }}
                >
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--ob-text-primary)",
                    }}
                  >
                    {team.name}
                  </div>
                  {team.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ob-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {team.description}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "var(--ob-surface-highest)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ob-text-secondary)",
                    textTransform: "capitalize",
                  }}
                >
                  {team.my_role || "member"}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ob-text-muted)",
                  }}
                >
                  {team.member_count ?? "—"} members
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      {dialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--ob-surface-mid)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 16,
              padding: 28,
              width: 440,
              maxWidth: "90vw",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
                margin: "0 0 20px",
              }}
            >
              Create Team
            </h2>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--ob-text-muted)",
                  marginBottom: 6,
                  fontFamily: "var(--font-headline)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "var(--ob-surface-high)",
                  border: "1px solid var(--ob-glass-border)",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "var(--font-body)",
                  color: "var(--ob-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--ob-text-muted)",
                  marginBottom: 6,
                  fontFamily: "var(--font-headline)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Description
              </label>
              <textarea
                value={teamDesc}
                onChange={(e) => setTeamDesc(e.target.value)}
                rows={3}
                placeholder="Optional description"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "var(--ob-surface-high)",
                  border: "1px solid var(--ob-glass-border)",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "var(--font-body)",
                  color: "var(--ob-text-primary)",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "1px solid var(--ob-glass-border)",
                  background: "transparent",
                  color: "var(--ob-text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!teamName.trim() || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    name: teamName.trim(),
                    description: teamDesc.trim() || undefined,
                  })
                }
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--ob-gradient-primary)",
                  color: "var(--ob-text-on-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: teamName.trim() ? "pointer" : "not-allowed",
                  opacity: teamName.trim() ? 1 : 0.5,
                }}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
