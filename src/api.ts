const fetchWithTimeout = async (url: string, ms: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const isJsonResponse = (response: Response) =>
  (response.headers.get("content-type") || "").includes("application/json");

const envBase = (import.meta?.env?.VITE_API_BASE as string | undefined)?.trim();
const hostedApiFallbacks = ["https://bluevinza-vinzatools-backend.hf.space"];

const isHostedFrontend = (hostname: string) =>
  /(?:vercel\.app|vinzatools\.com|bluevinza\.com)$/i.test(hostname);

const buildCandidates = () => {
  const candidates: string[] = [];
  // If VITE_API_BASE is set, use it directly. Probing dozens of localhost ports
  // can delay the first request by ~30s on cold starts (and makes tools feel broken).
  if (envBase) return [envBase];

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (isHostedFrontend(hostname)) {
      candidates.push(...hostedApiFallbacks);
    }
    candidates.push(`${protocol}//${hostname}${port ? `:${port}` : ""}`);
    for (let p = 3000; p <= 3010; p += 1) {
      candidates.push(`${protocol}//${hostname}:${p}`);
    }
    candidates.push(`http://127.0.0.1:3000`);
    for (let p = 3001; p <= 3010; p += 1) {
      candidates.push(`http://127.0.0.1:${p}`);
    }
  }

  return Array.from(new Set(candidates));
};

let basePromise: Promise<string> | null = null;

export const resolveApiBase = async () => {
  if (basePromise) return basePromise;
  basePromise = (async () => {
    const candidates = buildCandidates();
    for (const base of candidates) {
      try {
        // Give remote backends a bit more time; HF Spaces often need a few seconds to wake up.
        const response = await fetchWithTimeout(`${base}/api/health`, envBase ? 8_000 : 1_500);
        if (response.ok && isJsonResponse(response)) {
          return base;
        }
      } catch {
        // try next
      }
    }
    // If we had an env base, prefer it even if health probing failed (e.g. cold start).
    return envBase || "";
  })();
  return basePromise;
};

export const apiFetch = async (path: string, options?: RequestInit) => {
  const base = await resolveApiBase();
  const url = `${base}${path}`;
  return fetch(url, options);
};

export const apiHref = async (path: string) => {
  const base = await resolveApiBase();
  return `${base}${path}`;
};
