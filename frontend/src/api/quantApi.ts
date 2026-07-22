const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type DataTaskKind = "initialize" | "update";

export type TaskRun = {
  id: string;
  task_type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "interrupted";
  stage: string;
  progress: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
};

export type StockBar = {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const quantApi = {
  getStockBars(tsCode: string, limit = 240, signal?: AbortSignal) {
    const params = new URLSearchParams({ limit: String(limit), refresh: "true" });
    return request<StockBar[]>(`/api/stocks/${encodeURIComponent(tsCode)}/bars?${params}`, { signal });
  },

  createDataTask(kind: DataTaskKind, signal?: AbortSignal) {
    return request<{ id: string; status: "queued" }>(`/api/tasks/data/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal,
    });
  },

  listTasks(signal?: AbortSignal) {
    return request<TaskRun[]>("/api/tasks", { signal });
  },
};
