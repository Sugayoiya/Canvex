import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

// Auto-attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          { refresh_token: refreshToken }
        );
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; nickname: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  googleLogin: () => api.get("/auth/oauth/google/login"),
  githubLogin: () => api.get("/auth/oauth/github/login"),
};

export const skillsApi = {
  list: (category?: string) =>
    api.get("/skills/", { params: category ? { category } : {} }),
  tools: (category?: string) =>
    api.get("/skills/tools", { params: category ? { category } : {} }),
  invoke: (data: {
    skill_name: string;
    params?: Record<string, unknown>;
    project_id?: string;
    canvas_id?: string;
    node_id?: string;
    idempotency_key?: string;
  }) => api.post("/skills/invoke", data),
  poll: (task_id: string) => api.post("/skills/poll", { task_id }),
};

export const logsApi = {
  skills: (params?: Record<string, unknown>) =>
    api.get("/logs/skills", { params }),
  aiCalls: (params?: Record<string, unknown>) =>
    api.get("/logs/ai-calls", { params }),
  aiCallStats: () => api.get("/logs/ai-calls/stats"),
  trace: (traceId: string) => api.get(`/logs/trace/${traceId}`),
};

export const canvasApi = {
  list: (projectId: string) =>
    api.get("/canvas/", { params: { project_id: projectId } }),
  get: (canvasId: string) => api.get(`/canvas/${canvasId}`),
  create: (data: { project_id: string; name?: string }) =>
    api.post("/canvas/", data),
  update: (canvasId: string, data: { name?: string; viewport?: unknown }) =>
    api.patch(`/canvas/${canvasId}`, data),
  delete: (canvasId: string) => api.delete(`/canvas/${canvasId}`),
  createNode: (data: {
    canvas_id: string;
    node_type: string;
    position_x?: number;
    position_y?: number;
    config?: Record<string, unknown>;
  }) => api.post("/canvas/nodes/", data),
  updateNode: (nodeId: string, data: Record<string, unknown>) =>
    api.patch(`/canvas/nodes/${nodeId}`, data),
  deleteNode: (nodeId: string) => api.delete(`/canvas/nodes/${nodeId}`),
  createEdge: (data: {
    canvas_id: string;
    source_node_id: string;
    target_node_id: string;
    source_handle?: string;
    target_handle?: string;
  }) => api.post("/canvas/edges/", data),
  deleteEdge: (edgeId: string) => api.delete(`/canvas/edges/${edgeId}`),

  listAssets: (
    projectId: string,
    params?: { asset_type?: string; limit?: number; offset?: number },
  ) =>
    api.get("/canvas/assets/", {
      params: { project_id: projectId, ...params },
    }),
  getAsset: (assetId: string) => api.get(`/canvas/assets/${assetId}`),
  createAsset: (data: {
    project_id: string;
    asset_type: string;
    name: string;
    tags?: string;
    content_text?: string;
    content_url?: string;
    config_json?: Record<string, unknown>;
    source_node_id?: string;
  }) => api.post("/canvas/assets/", data),
  updateAsset: (
    assetId: string,
    data: {
      name?: string;
      tags?: string;
      config_json?: Record<string, unknown>;
    },
  ) => api.patch(`/canvas/assets/${assetId}`, data),
  deleteAsset: (assetId: string) => api.delete(`/canvas/assets/${assetId}`),

  batchExecute: (data: { canvas_id: string; node_ids: string[] }) =>
    api.post("/canvas/batch-execute", data),
  batchStatus: (batchId: string) =>
    api.get(`/canvas/batch-execute/${batchId}`),
  updateBatchNodeStatus: (batchId: string, nodeId: string, status: string) =>
    api.patch(`/canvas/batch-execute/${batchId}/nodes/${nodeId}`, { status }),
};

export const agentApi = {
  createSession: (data: {
    project_id: string;
    canvas_id?: string;
    title?: string;
    model_name?: string;
    provider?: string;
  }) => api.post("/agent/sessions", data),
  listSessions: (projectId: string, canvasId?: string) =>
    api.get("/agent/sessions", {
      params: { project_id: projectId, canvas_id: canvasId },
    }),
  getSession: (sessionId: string) =>
    api.get(`/agent/sessions/${sessionId}`),
  deleteSession: (sessionId: string) =>
    api.delete(`/agent/sessions/${sessionId}`),
  getMessages: (sessionId: string, limit?: number, offset?: number) =>
    api.get(`/agent/sessions/${sessionId}/messages`, {
      params: { limit, offset },
    }),
};

export const taskApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    project_id?: string;
    user_id?: string;
  }) => api.get("/logs/tasks", { params }),
  counts: (params?: { project_id?: string }) =>
    api.get("/logs/tasks/counts", { params }),
  nodeHistory: (nodeId: string, params?: { limit?: number }) =>
    api.get(`/logs/node-history/${nodeId}`, { params }),
};

export const billingApi = {
  usageStats: (params?: {
    start_date?: string;
    end_date?: string;
    project_id?: string;
  }) => api.get("/billing/usage-stats/", { params }),
  usageTimeseries: (params: {
    start_date: string;
    end_date: string;
    granularity?: string;
    project_id?: string;
  }) => api.get("/billing/usage-timeseries/", { params }),
  pricing: () => api.get("/billing/pricing/"),
};

export const teamsApi = {
  list: () => api.get("/teams/"),
  get: (teamId: string) => api.get(`/teams/${teamId}`),
  create: (data: { name: string; description?: string }) =>
    api.post("/teams/", data),
  update: (teamId: string, data: { name?: string; description?: string }) =>
    api.patch(`/teams/${teamId}`, data),
  delete: (teamId: string) => api.delete(`/teams/${teamId}`),
  listMembers: (teamId: string) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId: string, data: { user_id: string; role?: string }) =>
    api.post(`/teams/${teamId}/members`, data),
  updateMember: (teamId: string, memberId: string, data: { role: string }) =>
    api.patch(`/teams/${teamId}/members/${memberId}`, data),
  removeMember: (teamId: string, memberId: string) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),
  createInvitation: (teamId: string, data: { role?: string }) =>
    api.post(`/teams/${teamId}/invitations`, data),
  acceptInvitation: (token: string) =>
    api.post(`/teams/invitations/${token}/accept`),
  listGroups: (teamId: string) => api.get(`/teams/${teamId}/groups`),
  createGroup: (teamId: string, data: { name: string; description?: string }) =>
    api.post(`/teams/${teamId}/groups`, data),
  updateGroup: (teamId: string, groupId: string, data: { name?: string; description?: string }) =>
    api.patch(`/teams/${teamId}/groups/${groupId}`, data),
  deleteGroup: (teamId: string, groupId: string) =>
    api.delete(`/teams/${teamId}/groups/${groupId}`),
  listGroupMembers: (teamId: string, groupId: string) =>
    api.get(`/teams/${teamId}/groups/${groupId}/members`),
  addGroupMember: (teamId: string, groupId: string, data: { user_id: string; role?: string }) =>
    api.post(`/teams/${teamId}/groups/${groupId}/members`, data),
  updateGroupMember: (teamId: string, groupId: string, memberId: string, data: { role: string }) =>
    api.patch(`/teams/${teamId}/groups/${groupId}/members/${memberId}`, data),
  removeGroupMember: (teamId: string, groupId: string, memberId: string) =>
    api.delete(`/teams/${teamId}/groups/${groupId}/members/${memberId}`),
};

export const projectsApi = {
  list: (params?: { owner_type?: string; owner_id?: string }) =>
    api.get("/projects/", { params }),
  get: (projectId: string) => api.get(`/projects/${projectId}`),
  create: (data: { name: string; description?: string; owner_type: string; owner_id: string }) =>
    api.post("/projects/", data),
  update: (projectId: string, data: { name?: string; description?: string }) =>
    api.patch(`/projects/${projectId}`, data),
  delete: (projectId: string) => api.delete(`/projects/${projectId}`),
  clone: (projectId: string, data: { target_owner_type: string; target_owner_id: string }) =>
    api.post(`/projects/${projectId}/clone`, data),
};

export const usersApi = {
  search: (q: string) => api.get("/users/search", { params: { q } }),
  profile: () => api.get("/users/me"),
  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    api.patch("/users/me", data),
};

export const aiProvidersApi = {
  list: (params?: { owner_type?: string; owner_id?: string }) =>
    api.get("/ai-providers/", { params }),
  get: (providerId: string) => api.get(`/ai-providers/${providerId}`),
  create: (data: { provider_name: string; display_name: string; owner_type: string; owner_id?: string }) =>
    api.post("/ai-providers/", data),
  update: (providerId: string, data: Record<string, unknown>) =>
    api.patch(`/ai-providers/${providerId}`, data),
  delete: (providerId: string) => api.delete(`/ai-providers/${providerId}`),
  addKey: (providerId: string, data: { api_key: string; label?: string }) =>
    api.post(`/ai-providers/${providerId}/keys`, data),
  deleteKey: (providerId: string, keyId: string) =>
    api.delete(`/ai-providers/${providerId}/keys/${keyId}`),
  listModels: (params?: { model_type?: string }) =>
    api.get("/ai-models/", { params }),
};

export default api;
