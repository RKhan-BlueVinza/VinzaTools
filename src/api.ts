const withTimeout = async (promise: Promise<Response>, ms: number) => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  return Promise.race([promise, timeout]) as Promise<Response>;
};

const isJsonResponse = (response: Response) =>
  (response.headers.get("content-type") || "").includes("application/json");

const envBase = (import.meta?.env?.VITE_API_BASE as string | undefined)?.trim();
const hostedApiFallbacks = ["https://bluevinza-vinzatools-backend.hf.space"];

const isHostedFrontend = (hostname: string) =>
  /(?:vercel\.app|vinzatools\.com|bluevinza\.com)$/i.test(hostname);

const buildCandidates = () => {
  const candidates: string[] = [];
  if (envBase) candidates.push(envBase.replace(/\/$/, ""));

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    candidates.push(`${protocol}//${hostname}${port ? `:${port}` : ""}`);
    for (let p = 3000; p <= 3020; p += 1) {
      candidates.push(`${protocol}//${hostname}:${p}`);
    }
    candidates.push(`http://127.0.0.1:3000`);
    for (let p = 3001; p <= 3020; p += 1) {
      candidates.push(`http://127.0.0.1:${p}`);
    }
    // Hosted backends (e.g. HF Space). Keep them after same-origin so a co-hosted
    // backend (future) automatically takes precedence without changing env vars.
    if (isHostedFrontend(hostname)) {
      candidates.push(...hostedApiFallbacks);
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
        const response = await withTimeout(fetch(`${base}/api/health`), 1200);
        if (response.ok && isJsonResponse(response)) {
          return base;
        }
      } catch {
        // try next
      }
    }
    return envBase || "";
  })();
  return basePromise;
};

export const apiFetch = async (path: string, options?: RequestInit) => {
  const preferred = await resolveApiBase();
  const candidates = buildCandidates();
  const ordered = [
    ...(preferred ? [preferred] : []),
    ...candidates.filter((c) => c !== preferred),
  ];

  let lastError: unknown = null;
  for (const base of ordered) {
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, options);
      // If we got JSON (even an error payload), return it to the caller.
      if (isJsonResponse(response)) return response;
      // If it succeeded, return it regardless of content type.
      if (response.ok) return response;
      // Non-JSON + non-OK: try next backend candidate.
    } catch (err) {
      lastError = err;
    }
  }

  // Fall back to preferred base (or same-origin) so the caller gets a meaningful error.
  if (lastError) throw lastError;
  const base = preferred || "";
  return fetch(`${base}${path}`, options);
};

export const apiHref = async (path: string) => {
  const base = await resolveApiBase();
  return `${base}${path}`;
};
