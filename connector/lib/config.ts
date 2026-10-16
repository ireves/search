export const SERVER_NAME = "search";
export const SERVER_TITLE = "Search (Exa + Parallel)";
export const SERVER_VERSION = "1.0.0";

export const MIN_PASSWORD_LENGTH = 12;

// The API keys the connector knows about. Other names can be stored too.
export const KNOWN_SECRETS: Record<string, { label: string; help: string; link: string }> = {
  EXA_API_KEY: {
    label: "Exa API key",
    help: "Main search engine and page reader.",
    link: "https://dashboard.exa.ai/api-keys",
  },
  PARALLEL_API_KEY: {
    label: "Parallel API key",
    help: "Reddit, X, Glassdoor and Trustpilot, backup reader, deep research.",
    link: "https://platform.parallel.ai",
  },
  FIRECRAWL_API_KEY: {
    label: "Firecrawl API key (optional)",
    help: "Reads pages first when set, to save Exa and Parallel usage. Also reads some sites they can't, such as Quora. The free plan gives 1,000 pages a month.",
    link: "https://www.firecrawl.dev/app/api-keys",
  },
  TINYFISH_API_KEY: {
    label: "TinyFish API key (optional)",
    help: "Reads pages (including PDFs) and adds Google-style results to searches, before Firecrawl, Exa and Parallel are asked. Free for 1,000 pages and 12,000 searches a day.",
    link: "https://agent.tinyfish.ai/api-keys",
  },
  APIFY_API_TOKEN: {
    label: "Apify API token (optional)",
    help: "Adds live adverts from LinkedIn, Indeed, Glassdoor and Totaljobs to jobs searches. About 1 to 5 cents a search.",
    link: "https://console.apify.com/settings/integrations",
  },
  OPENALEX_API_KEY: {
    label: "OpenAlex API key (optional)",
    help: "Adds OpenAlex's index of research papers to papers searches, with citation counts and free full-text links, and reads papers from OpenAlex's own full-text copies ($0.01 each). Free key with $1 of use a day (about 1,000 searches or 100 full-text reads).",
    link: "https://openalex.org/settings/api",
  },
  SUPABASE_URL: {
    label: "Supabase project URL (optional)",
    help: "Problem log that Claude can read back: the project's address, like https://abcd.supabase.co. Set-up: docs/connector-setup.md.",
    link: "https://supabase.com/dashboard/project/_/settings/api",
  },
  SUPABASE_LOG_KEY: {
    label: "Supabase publishable key (optional)",
    help: "The project's publishable (or legacy anon) key. The problem log tables only let it add rows.",
    link: "https://supabase.com/dashboard/project/_/settings/api-keys",
  },
};

export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  if (!value || value.length < MIN_PASSWORD_LENGTH) return null;
  return value;
}

// The public address of this deployment, such as https://my-search.vercel.app.
export function baseUrl(request: Request): string {
  const fixed = process.env.PUBLIC_URL;
  if (fixed) return fixed.replace(/\/+$/, "");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host}`;
}

// Works whether the platform hands us the rewritten path (/api/oauth?route=x)
// or the original one (/token).
export function routeOf(request: Request, fallback: (pathname: string) => string): string {
  const url = new URL(request.url);
  return url.searchParams.get("route") ?? fallback(url.pathname);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
