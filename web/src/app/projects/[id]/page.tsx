"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { projectsApi, canvasApi } from "@/lib/api";
import { Plus, Layers, ArrowLeft } from "lucide-react";

interface Canvas {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  owner_type: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newCanvasName, setNewCanvasName] = useState("");
  const [showNewCanvas, setShowNewCanvas] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });

  const { data: canvases = [], isLoading: canvasesLoading } = useQuery<
    Canvas[]
  >({
    queryKey: ["canvases", id],
    queryFn: () => canvasApi.list(id).then((r) => r.data),
    enabled: !!id,
  });

  const createCanvas = useMutation({
    mutationFn: () =>
      canvasApi.create({
        project_id: id,
        name: newCanvasName.trim() || "Untitled Canvas",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvases", id] });
      setShowNewCanvas(false);
      setNewCanvasName("");
    },
  });

  if (projectLoading) {
    return (
      <AppShell>
        <div style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
          Loading project...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push("/projects")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--ob-text-muted)",
          fontSize: 12,
          fontFamily: "var(--font-body)",
          cursor: "pointer",
          marginBottom: 20,
          padding: 0,
        }}
      >
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--ob-text-primary)",
              margin: 0,
            }}
          >
            {project?.name}
          </h1>
          {project?.description && (
            <p
              style={{
                fontSize: 13,
                color: "var(--ob-text-muted)",
                margin: "6px 0 0",
              }}
            >
              {project.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowNewCanvas(true)}
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
          New Canvas
        </button>
      </div>

      {/* Inline new canvas form */}
      {showNewCanvas && (
        <div
          style={{
            background: "var(--ob-glass-bg)",
            border: "1px solid var(--ob-glass-border)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <input
            type="text"
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            placeholder="Canvas name (optional)"
            autoFocus
            style={{
              flex: 1,
              padding: "8px 12px",
              background: "var(--ob-surface-high)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "var(--font-body)",
              color: "var(--ob-text-primary)",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCanvas.mutate();
              if (e.key === "Escape") setShowNewCanvas(false);
            }}
          />
          <button
            type="button"
            onClick={() => createCanvas.mutate()}
            disabled={createCanvas.isPending}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "var(--ob-gradient-primary)",
              color: "var(--ob-text-on-primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {createCanvas.isPending ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowNewCanvas(false)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid var(--ob-glass-border)",
              background: "transparent",
              color: "var(--ob-text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Canvases */}
      <div style={{ marginBottom: 8 }}>
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--ob-text-muted)",
            marginBottom: 12,
          }}
        >
          Canvases ({canvases.length})
        </h2>
      </div>
      {canvasesLoading ? (
        <div style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
          Loading canvases...
        </div>
      ) : canvases.length === 0 ? (
        <div
          style={{
            background: "var(--ob-glass-bg)",
            border: "1px solid var(--ob-glass-border)",
            borderRadius: 12,
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <Layers
            size={32}
            style={{ color: "var(--ob-text-muted)", marginBottom: 8 }}
          />
          <p style={{ color: "var(--ob-text-muted)", fontSize: 13 }}>
            No canvases yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              onClick={() =>
                router.push(`/projects/${id}/canvas/${canvas.id}`)
              }
              style={{
                background: "var(--ob-glass-bg)",
                border: "1px solid var(--ob-glass-border)",
                borderRadius: 12,
                padding: "16px 18px",
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
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Layers size={16} style={{ color: "var(--ob-primary)" }} />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ob-text-primary)",
                  }}
                >
                  {canvas.name || "Untitled Canvas"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ob-text-muted)" }}>
                Updated{" "}
                {new Date(canvas.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
