// Small HTML helpers for the sign-in and settings pages. No JavaScript is used.

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
:root{color-scheme:light dark;--bg:#faf9f6;--card:#fff;--text:#1d1b16;--muted:#6b665c;--line:#e4e0d6;--accent:#b4532a;--ok:#2f7d4f;--warn:#a15c00;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#1a1916;--card:#24221e;--text:#f1eee6;--muted:#aaa497;--line:#3a372f;--accent:#e08a5f;--ok:#6cc08f;--warn:#e0a24a;--bad:#f2867e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}
p{margin:8px 0}.muted{color:var(--muted);font-size:.92rem}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}
label{display:block;font-weight:600;margin:12px 0 4px}input[type=password],input[type=text]{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}
button{font:inherit;padding:9px 16px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;margin-top:12px}
button.plain{background:transparent;color:var(--accent)}button.danger{border-color:var(--bad);background:transparent;color:var(--bad)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row form{margin:0}.grow{flex:1;min-width:0}
.tag{display:inline-block;font-size:.8rem;padding:2px 8px;border-radius:999px;border:1px solid currentColor}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.note{border-left:3px solid var(--accent);padding:8px 12px;margin:12px 0;background:var(--card)}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;word-break:break-all}
`;

export interface PageOptions {
  title: string;
  body: string;
  status?: number;
  // Extra origins the page's forms may redirect to (the OAuth callback).
  formTargets?: string[];
  headers?: Record<string, string>;
}

export function page({ title, body, status = 200, formTargets = [], headers = {} }: PageOptions): Response {
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
  const formAction = ["'self'", ...formTargets].join(" ");
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`,
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store", ...headers } });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      ...headers,
    },
  });
}

export function setupNeededPage(): Response {
  return page({
    title: "Setup needed",
    status: 503,
    body: `<h1>Setup needed</h1><p>This connector has no admin password yet.</p>
<div class="note">In Vercel, add an environment variable called <code>ADMIN_PASSWORD</code> (at least 12 characters), then redeploy. This is the only setting that needs the Vercel dashboard.</div>`,
  });
}
