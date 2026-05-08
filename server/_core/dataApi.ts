import { normalizeEnvUrl, normalizeSecretKey } from "./envSecrets";

export type DataApiCallOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export async function callDataApi<T = unknown>(endpoint: string, options: DataApiCallOptions = {}): Promise<T> {
  const base = normalizeEnvUrl(process.env.EXTERNAL_DATA_API_BASE_URL);
  const url = /^https?:\/\//i.test(endpoint)
    ? new URL(endpoint)
    : new URL(`${base}/${endpoint.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.method || (options.body ? "POST" : "GET"),
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(normalizeSecretKey(process.env.EXTERNAL_DATA_API_KEY) ? { authorization: `Bearer ${normalizeSecretKey(process.env.EXTERNAL_DATA_API_KEY)}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`External data API request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return (await response.json()) as T;
}
