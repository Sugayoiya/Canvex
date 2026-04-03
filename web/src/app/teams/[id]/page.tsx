"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { modelsApi, teamsApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { ModelSelector } from "@/components/common/model-selector";
import {
  getEffectiveModelSelection,
  type DefaultModelSettings,
} from "@/lib/model-defaults";
import { Plus, Copy, Check, Search, Info } from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  user_email: string | null;
  user_nickname: string | null;
  user_avatar: string | null;
  role: string;
  joined_at: string;
  status?: string;
  group_name?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface SearchUser {
  id: string;
  email: string;
  nickname: string;
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<"link" | "search">("link");
  const [inviteRole, setInviteRole] = useState("member");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);

  const { data: team } = useQuery<Team>({
    queryKey: ["team", id],
    queryFn: () => teamsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members", id],
    queryFn: () => teamsApi.listMembers(id).then((r) => r.data),
    enabled: !!id,
  });

  const createInvitation = useMutation({
    mutationFn: () => teamsApi.createInvitation(id, { role: inviteRole }),
    onSuccess: (res) => {
      const token = res.data?.token || res.data?.id;
      setGeneratedLink(`${window.location.origin}/invite/${token}`);
    },
  });

  const addMember = useMutation({
    mutationFn: (userId: string) =>
      teamsApi.addMember(id, { user_id: userId, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", id] });
      setSearchResults([]);
      setSearchQuery("");
    },
  });

  const currentUser = useAuthStore((s) => s.user);
  const myMembership = members.find((m) => m.user_id === currentUser?.id);
  const canManageDefaults =
    myMembership?.role === "owner" || myMembership?.role === "admin" || myMembership?.role === "team_admin";

  const { data: teamSettings } = useQuery({
    queryKey: ["team-settings", id],
    queryFn: () => teamsApi.getSettings(id).then((r) => r.data?.settings ?? {}),
    enabled: !!id && !!canManageDefaults,
  });

  const { data: systemDefaults } = useQuery<DefaultModelSettings>({
    queryKey: ["system-default-models"],
    queryFn: () => modelsApi.getSystemDefaults().then((r) => r.data?.settings ?? {}),
    enabled: !!canManageDefaults,
  });

  const updateTeamSettingsMutation = useMutation({
    mutationFn: (data: { default_llm_model?: string; default_image_model?: string }) =>
      teamsApi.updateSettings(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-settings", id] });
    },
  });

  const handleTeamModelUpdate = useCallback(
    (key: string, value: string) => {
      updateTeamSettingsMutation.mutate({ [key]: value });
    },
    [updateTeamSettingsMutation],
  );

  const effectiveTeamLlmModel = getEffectiveModelSelection({
    modelType: "llm",
    directValue: teamSettings?.default_llm_model ?? null,
    teamSettings,
    systemSettings: systemDefaults,
  });

  const effectiveTeamImageModel = getEffectiveModelSelection({
    modelType: "image",
    directValue: teamSettings?.default_image_model ?? null,
    teamSettings,
    systemSettings: systemDefaults,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await usersApi.search(searchQuery.trim());
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: "Owner",
      team_admin: "Admin",
      admin: "Admin",
      editor: "Editor",
      member: "Member",
      viewer: "Viewer",
    };
    return labels[role] || role;
  };

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
            Team & Roles
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--ob-text-muted)",
              margin: "6px 0 0",
            }}
          >
            {team?.name ? `${team.name} · ` : ""}Manage members and permissions
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setInviteOpen(true);
            setGeneratedLink("");
            setLinkCopied(false);
          }}
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
          Invite Member
        </button>
      </div>

      {/* Member table */}
      <div
        style={{
          background: "var(--ob-glass-bg)",
          border: "1px solid var(--ob-glass-border)",
          backdropFilter: "blur(12px)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40% 15% 25% 20%",
            padding: "12px 20px",
            borderBottom: "1px solid var(--ob-glass-border)",
          }}
        >
          {["MEMBER", "ROLE", "GROUP", "STATUS"].map((col) => (
            <div
              key={col}
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "var(--ob-text-muted)",
              }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Table rows */}
        {members.length === 0 ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--ob-text-muted)",
              fontSize: 13,
            }}
          >
            No members yet.
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              style={{
                display: "grid",
                gridTemplateColumns: "40% 15% 25% 20%",
                padding: "12px 20px",
                borderBottom: "1px solid var(--ob-glass-border)",
                transition: "background 150ms",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ob-surface-high)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Member */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--ob-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-headline)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ob-text-on-primary)",
                    flexShrink: 0,
                  }}
                >
                  {(member.user_nickname || member.user_email)?.charAt(0)?.toUpperCase() ||
                    "U"}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--ob-text-primary)",
                    }}
                  >
                    {member.user_nickname || "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ob-text-muted)",
                    }}
                  >
                    {member.user_email || "—"}
                  </div>
                </div>
              </div>

              {/* Role */}
              <div>
                <span
                  style={{
                    background: "var(--ob-surface-highest)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "var(--ob-text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {roleLabel(member.role)}
                </span>
              </div>

              {/* Group */}
              <div
                style={{
                  fontSize: 13,
                  color: member.group_name
                    ? "var(--ob-text-secondary)"
                    : "var(--ob-text-muted)",
                }}
              >
                {member.group_name || "—"}
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background:
                      member.status === "pending"
                        ? "var(--ob-tertiary)"
                        : "var(--ob-success)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ob-text-secondary)",
                    textTransform: "capitalize",
                  }}
                >
                  {member.status || "Active"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Team default models (owner/admin only) */}
      {canManageDefaults && (
        <div
          style={{
            background: "var(--ob-glass-bg)",
            border: "1px solid var(--ob-glass-border)",
            borderRadius: 12,
            padding: "16px 20px",
            marginTop: 24,
          }}
        >
          <div
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
            团队默认模型
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--ob-text-muted)",
                  marginBottom: 8,
                }}
              >
                LLM 模型
              </div>
              <ModelSelector
                value={teamSettings?.default_llm_model ?? null}
                onChange={(name) => handleTeamModelUpdate("default_llm_model", name)}
                modelType="llm"
                inheritedValue={effectiveTeamLlmModel.modelName}
                inheritedSourceLabel={effectiveTeamLlmModel.sourceLabel}
                size="md"
              />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--ob-text-muted)",
                  marginBottom: 8,
                }}
              >
                图像模型
              </div>
              <ModelSelector
                value={teamSettings?.default_image_model ?? null}
                onChange={(name) => handleTeamModelUpdate("default_image_model", name)}
                modelType="image"
                inheritedValue={effectiveTeamImageModel.modelName}
                inheritedSourceLabel={effectiveTeamImageModel.sourceLabel}
                size="md"
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 12,
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--ob-text-muted)",
              opacity: 0.7,
            }}
          >
            <Info size={12} />
            用于团队内所有项目的 fallback 默认值
          </div>
        </div>
      )}

      {/* Invite Member Dialog */}
      {inviteOpen && (
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
            if (e.target === e.currentTarget) setInviteOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--ob-surface-mid)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: "90vw",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
                margin: "0 0 16px",
              }}
            >
              Invite Member
            </h2>

            {/* Role selector */}
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
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--ob-surface-high)",
                  border: "1px solid var(--ob-glass-border)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--ob-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="member">Member</option>
                <option value="editor">Editor</option>
                <option value="team_admin">Admin</option>
              </select>
            </div>

            {/* Tab toggle */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginBottom: 16,
                background: "var(--ob-surface-high)",
                borderRadius: 8,
                padding: 2,
              }}
            >
              {(["link", "search"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInviteTab(tab)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    background:
                      inviteTab === tab
                        ? "var(--ob-surface-highest)"
                        : "transparent",
                    color:
                      inviteTab === tab
                        ? "var(--ob-text-primary)"
                        : "var(--ob-text-muted)",
                    fontSize: 12,
                    fontWeight: inviteTab === tab ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
                  {tab === "link" ? "Link Invite" : "Search & Add"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {inviteTab === "link" ? (
              <div>
                {!generatedLink ? (
                  <button
                    type="button"
                    onClick={() => createInvitation.mutate()}
                    disabled={createInvitation.isPending}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--ob-gradient-primary)",
                      color: "var(--ob-text-on-primary)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {createInvitation.isPending
                      ? "Generating..."
                      : "Generate Invite Link"}
                  </button>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        background: "var(--ob-surface-high)",
                        border: "1px solid var(--ob-glass-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: "var(--font-body)",
                        color: "var(--ob-text-primary)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--ob-glass-border)",
                        background: "transparent",
                        color: "var(--ob-text-primary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search
                      size={14}
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--ob-text-muted)",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by email or name"
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      style={{
                        width: "100%",
                        padding: "10px 10px 10px 30px",
                        background: "var(--ob-surface-high)",
                        border: "1px solid var(--ob-glass-border)",
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: "var(--font-body)",
                        color: "var(--ob-text-primary)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--ob-surface-highest)",
                      color: "var(--ob-text-primary)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Search
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div
                    style={{
                      border: "1px solid var(--ob-glass-border)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderBottom: "1px solid var(--ob-glass-border)",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--ob-text-primary)",
                            }}
                          >
                            {user.nickname || user.email}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ob-text-muted)",
                            }}
                          >
                            {user.email}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addMember.mutate(user.id)}
                          disabled={addMember.isPending}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "var(--ob-gradient-primary)",
                            color: "var(--ob-text-on-primary)",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Close */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
