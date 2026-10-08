// Thin wrapper around fetch for calls to the FastAPI backend.
// All paths are relative to /api, which next.config.ts proxies to the backend,
// so requests are same-origin and the session cookie is sent automatically.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // e.g. the proxy's plain-text 500 when the backend is down
    return text;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const body = await parseBody(response);

  if (!response.ok) {
    // Backend errors use the shape {"detail": "..."}.
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, detail, body);
  }

  return body as T;
}

export type HealthStatus = {
  status: "ok" | "error";
  database: "ok" | "error";
  version: string;
};

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health", { signal });
}
