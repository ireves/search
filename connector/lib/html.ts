// Small HTML helpers for the sign-in and settings pages. The only script is
// /passkey.js, loaded from this server on pages with a passkey button.

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Styled after Notion: plain page, quiet text colours, thin dividers, soft
// grey controls and Notion's coloured tags. Class names stay the same on
// every page (card, note, tag, ok/warn/bad, row/grow, plain/danger buttons).
const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--text:#37352f;--muted:rgba(55,53,47,.65);--faint:rgba(55,53,47,.45);--line:rgba(55,53,47,.09);--hover:rgba(55,53,47,.06);--field:rgba(242,241,238,.6);--callout:#f1f1ef;--blue:#2383e2;--ok:#448361;--warn:#cb912f;--bad:#d44c47;
--t-gray:#e3e2e0;--t-brown:#eee0da;--t-orange:#fadec9;--t-yellow:#fdecc8;--t-green:#dbeddb;--t-blue:#d3e5ef;--t-purple:#e8deee;--t-pink:#f5e0e9;--t-red:#ffe2dd;--t-text:#32302c}
@media (prefers-color-scheme:dark){:root{--bg:#191919;--text:rgba(255,255,255,.81);--muted:rgba(255,255,255,.46);--faint:rgba(255,255,255,.28);--line:rgba(255,255,255,.094);--hover:rgba(255,255,255,.055);--field:rgba(255,255,255,.055);--callout:#252525;--blue:#529cca;--ok:#4dab9a;--warn:#ffa344;--bad:#ff7369;
--t-gray:#373737;--t-brown:#4a3228;--t-orange:#5c3b23;--t-yellow:#564328;--t-green:#243d30;--t-blue:#143a4e;--t-purple:#3c2d49;--t-pink:#4e2c3c;--t-red:#522e2a;--t-text:rgba(255,255,255,.81)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI Variable Display","Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:720px;margin:0 auto;padding:56px 16px 96px}main.wide{max-width:1000px}
h1{font-size:2.5rem;line-height:1.2;font-weight:700;margin:0 0 8px;letter-spacing:-.01em}h2{font-size:1.5rem;font-weight:600;margin:36px 0 6px;line-height:1.3}h3{font-size:1.25rem;font-weight:600;margin:24px 0 4px}
p{margin:6px 0}a{color:inherit;text-decoration:underline;text-decoration-color:var(--faint);text-underline-offset:2px}a:hover{text-decoration-color:var(--text)}
ul{padding-left:1.5em;margin:6px 0}li{margin:3px 0}hr{border:0;border-top:1px solid var(--line);margin:24px 0}
.muted{color:var(--muted);font-size:.875rem}
.card{border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin:10px 0}
.note{background:var(--callout);border-radius:6px;padding:14px 16px 14px 16px;margin:12px 0}
label{display:block;font-size:.875rem;color:var(--muted);margin:12px 0 4px}
input[type=password],input[type=text],input[type=url],input[type=search],select,textarea{width:100%;padding:6px 10px;border:1px solid var(--line);border-radius:4px;background:var(--field);color:var(--text);font:inherit;font-size:.9375rem;line-height:1.4}
input::placeholder,textarea::placeholder{color:var(--faint)}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 2px rgba(35,131,226,.25)}
textarea{min-height:2.2em;resize:vertical}input[type=checkbox]{width:16px;height:16px;accent-color:var(--blue);margin:0;vertical-align:middle}
button{font:inherit;font-size:.875rem;font-weight:500;padding:6px 12px;border-radius:4px;border:1px solid transparent;background:var(--blue);color:#fff;cursor:pointer;margin-top:12px;line-height:1.3}
button:hover{filter:brightness(.95)}button.plain{background:transparent;color:var(--text);border-color:var(--line)}button.plain:hover{background:var(--hover)}
button.danger{background:transparent;color:var(--bad);border-color:var(--line)}button.danger:hover{background:var(--t-red)}button.small{margin:0;padding:3px 8px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row form{margin:0}.grow{flex:1;min-width:0}
.tag{display:inline-block;font-size:.8125rem;line-height:1.4;padding:0 6px;border-radius:3px;background:var(--t-gray);color:var(--t-text);white-space:nowrap}
.tag.ok,.tag.warn,.tag.bad{color:var(--t-text)}.tag.ok,.tag.green{background:var(--t-green)}.tag.warn,.tag.yellow{background:var(--t-yellow)}.tag.bad,.tag.red{background:var(--t-red)}.tag.blue{background:var(--t-blue)}.tag.purple{background:var(--t-purple)}.tag.orange{background:var(--t-orange)}.tag.pink{background:var(--t-pink)}.tag.brown{background:var(--t-brown)}
p.ok,span.ok{color:var(--ok)}p.warn,span.warn{color:var(--warn)}p.bad,span.bad,.card.bad{color:var(--bad)}
.nav{display:flex;gap:4px;flex-wrap:wrap;margin:-32px 0 32px;font-size:.875rem}.nav a{text-decoration:none;color:var(--muted);padding:2px 8px;border-radius:4px}.nav a:hover{background:var(--hover)}.nav a[aria-current]{color:var(--text);background:var(--hover)}
.table{border-top:1px solid var(--line);margin:8px 0}.table>*{border-bottom:1px solid var(--line)}
.thead{display:grid;gap:8px;padding:6px 4px;font-size:.8125rem;color:var(--muted)}
.trow{display:grid;gap:8px;padding:6px 4px;align-items:center}.trow:hover{background:var(--hover)}.trow.off{opacity:.55}
.trow input[type=text],.trow input[type=url],.trow select,.trow textarea{background:transparent;border-color:transparent;padding:4px 6px}.trow input:hover,.trow select:hover,.trow textarea:hover{background:var(--field)}
.trow input:focus,.trow select:focus,.trow textarea:focus{background:var(--bg)}
.cell-actions{display:flex;gap:4px;justify-content:flex-end}
.handle{cursor:grab;color:var(--faint);user-select:none;font-size:.875rem;letter-spacing:-.2em;text-align:center}.trow:hover .handle{color:var(--muted)}.trow.dragging{opacity:.4}
@media (max-width:700px){.thead{display:none}.trow{grid-template-columns:1fr 1fr!important}.trow .wide-cell{grid-column:1/-1}.handle{display:none}}
code,.mono{font-family:"SFMono-Regular",Menlo,Consolas,"PT Mono","Liberation Mono",Courier,monospace;font-size:.85em;word-break:break-all}
code{background:var(--hover);color:#eb5757;padding:.15em .35em;border-radius:3px}
`;

export interface PageOptions {
  title: string;
  body: string;
  status?: number;
  // Extra origins the page's forms may redirect to (the OAuth callback).
  formTargets?: string[];
  headers?: Record<string, string>;
  // Wider page, for tables.
  wide?: boolean;
  // Scripts from this server the page loads.
  scripts?: string[];
}

export function page({ title, body, status = 200, formTargets = [], headers = {}, wide = false, scripts = [] }: PageOptions): Response {
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${STYLE}</style></head><body><main${wide ? ' class="wide"' : ""}>${body}</main>${body.includes("data-passkey") ? '<script src="/passkey.js" defer></script>' : ""}${scripts.map((src) => `<script src="${esc(src)}" defer></script>`).join("")}</body></html>`;
  const formAction = ["'self'", ...formTargets].join(" ");
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`,
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

// Links between the signed-in pages.
export function nav(base: string, current: "settings" | "preferences" | "jobs"): string {
  const links: [typeof current, string, string][] = [
    ["settings", "/settings", "Settings"],
    ["preferences", "/preferences", "Job search preferences"],
    ["jobs", "/jobs", "Job search runs"],
  ];
  return `<nav class="nav">${links.map(([key, path, label]) => `<a href="${esc(base)}${path}"${key === current ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
}

// Hidden fields and messages a passkey button needs inside its form.
export function passkeyFields(): string {
  return `<input type="hidden" name="passkey" value=""><input type="hidden" name="pktoken" value=""><p class="bad" data-passkey-error hidden role="alert"></p><p class="muted" data-passkey-unsupported hidden>This browser can't use passkeys. Try Safari, Chrome or Edge on a device with a screen lock.</p>`;
}
