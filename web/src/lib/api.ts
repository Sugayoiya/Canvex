import axios from "axios";

const API_BASE_URL =
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
};

export default api;
