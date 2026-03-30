"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/stores/auth-store";
import { projectsApi, canvasApi } from "@/lib/api";
import { Plus, FolderOpen, Layers } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description?: string;
  owner_type: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentSpace, user } = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const ownerType = currentSpace.type;
  const ownerId =
    currentSpace.type === "team" ? currentSpace.teamId : user?.id;

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects", ownerType, ownerId],
    queryFn: () =>
      projectsApi
        .list({ owner_type: ownerType, owner_id: ownerId })
        .then((r) => r.data),
    enabled: !!ownerId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectsApi.create({
        name: data.name,
        description: data.description,
        owner_type: ownerType,
        owner_id: ownerId!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
    },
  });

  const stats = [
    { label: "Projects", value: projects.length },
    { label: "Canvases", value: "—" },
    { label: "AI Uptime", value: "99.8%" },
    { label: "Credits Used", value: "$0.00" },
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
            Project Dashboard
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--ob-text-muted)",
              margin: "6px 0 0",
            }}
          >
            {projects.length} active projects
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
          New Project
        </button>
      </div>

      {/* Project card grid */}
      {isLoading ? (
        <div style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
          Loading projects...
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
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              style={{
                background: "var(--ob-glass-bg)",
                border: "1px solid var(--ob-glass-border)",
                backdropFilter: "blur(12px)",
                borderRadius: 16,
                overflow: "hidden",
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
              {/* Thumbnail placeholder */}
              <div
                style={{
                  height: 160,
                  background: "var(--ob-surface-high)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundImage: "var(--ob-gradient-primary)",
                  opacity: 0.15,
                  position: "relative",
                }}
              >
                <FolderOpen
                  size={40}
                  style={{
                    color: "var(--ob-text-muted)",
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    opacity: 1,
                  }}
                />
              </div>
              {/* Card body */}
              <div style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--ob-text-primary)",
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ob-text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Updated{" "}
                  {new Date(project.updated_at).toLocaleDateString()}
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "var(--ob-surface-highest)",
                    fontSize: 11,
                    color: "var(--ob-text-secondary)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--ob-success)",
                    }}
                  />
                  Active
                </span>
              </div>
            </div>
          ))}

          {/* Create New card */}
          <div
            onClick={() => setDialogOpen(true)}
            style={{
              border: "2px dashed var(--ob-glass-border)",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 250,
              cursor: "pointer",
              transition: "border-color 300ms",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ob-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ob-glass-border)";
            }}
          >
            <Plus
              size={32}
              style={{ color: "var(--ob-text-muted)", marginBottom: 8 }}
            />
            <span
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ob-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Create New
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
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

      {/* New Project Dialog */}
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
              New Project
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
                Project Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter project name"
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
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
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
              style={{
                fontSize: 12,
                color: "var(--ob-text-muted)",
                marginBottom: 20,
              }}
            >
              Owner:{" "}
              <span style={{ color: "var(--ob-text-secondary)" }}>
                {currentSpace.type === "team"
                  ? currentSpace.teamName
                  : "Personal"}
              </span>
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
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    name: newName.trim(),
                    description: newDesc.trim() || undefined,
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
                  cursor: newName.trim() ? "pointer" : "not-allowed",
                  opacity: newName.trim() ? 1 : 0.5,
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
