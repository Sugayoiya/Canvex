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

export default api;
