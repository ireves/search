import { adminPassword, baseUrl } from "../lib/config.js";
import { getKeys, nowSeconds, signToken, verifyToken, type TokenPayload } from "../lib/crypto.js";
import { esc, nav, page, redirect } from "../lib/html.js";
import {
  changeNotes,
  cleanMemory,
  cleanPreference,
  HIRING_SERVICE_NAMES,
  importFromNotion,
  loadNotes,
  MEMORY_SOURCES,
  notesConnected,
  PREFERENCE_TYPES,
  PRIORITIES,
  reorder,
  type Memory,
  type Notes,
  type Preference,
} from "../lib/jobs/notes.js";
import { notion } from "../lib/jobs/notion.js";
import { signedInOwner } from "../lib/settings.js";

// The job search's preferences and Claude's memory notes (lib/jobs/notes.ts),
// for the signed-in owner (the settings page's passkey sign-in).
//   GET  /preferences     the page
//   GET  /preferences.js  drag-to-reorder for the page's lists
//   POST /preferences     save, delete, add or move a row, or import from Notion

const CSRF_TTL = 12 * 3600;
const TITLE = "Job search preferences";

const MESSAGES: Record<string, [string, string]> = {
  saved: ["ok", "Saved."],
  moved: ["ok", "Order saved."],
  deleted: ["ok", "Deleted."],
  imported: ["ok", "Imported from Notion."],
  confirm: ["bad", "Tick the box to replace what's here, then import again."],
  noname: ["bad", "Give it a name first."],
  nostore: ["bad", "No storage is connected, so nothing can be saved. Connect a private Vercel Blob store to this project."],
  failed: ["bad", "That didn't work. Try again in a moment."],
  importfailed: ["bad", "Notion couldn't be read. Check NOTION_TOKEN on the settings page."],
  expired: ["bad", "The page had expired. Try again."],
};

// Notion's tag colours for each choice.
const COLOURS: Record<string, string> = {
  High: "red", Medium: "orange", Low: "yellow", Exclude: "gray",
  Chat: "green", Comment: "blue", Pattern: "purple",
  "Read OK": "green", "Used Firecrawl": "purple", "Needs Claude": "orange",
};
const tag = (value: string | null) => (value ? `<span class="tag ${COLOURS[value] ?? ""}">${esc(value)}</span>` : "");
const options = (list: readonly string[], current: string | null, blank = "") =>
  `${blank ? `<option value="">${esc(blank)}</option>` : ""}${list.map((v) => `<option${v === current ? " selected" : ""}>${esc(v)}</option>`).join("")}`;

const TYPE_HELP: Record<string, string> = {
  Role: "Job titles to search for. The server searches each one in each location.",
  Location: "Places to search. \"Remote\" means remote work you can do from the UK.",
  Level: "High levels are wanted; Exclude ones (for example Senior) are left out.",
  Pay: "Pay you're after. Claude uses it when judging fit.",
  Company: "Companies whose careers pages the server checks, 12 a day, oldest first. Exclude ones are never added.",
  "Company type": "Kinds of company you prefer. Claude uses them when judging fit.",
  "Job Listing Websites": "Job sites whose lists the server checks with the companies.",
};
const CHECKED = new Set(["Company", "Job Listing Websites"]);
const linkLabel = (type: string | null) => (type === "Company" ? "Careers page link" : "Link to the job list");
// A drag handle, the row's cells, then Save, Delete and the move arrows.
const prefColumns = (company: boolean) =>
  company ? "20px minmax(140px,1.2fr) 110px 56px minmax(160px,1.6fr) minmax(120px,1fr) 176px" : "20px minmax(140px,1.5fr) 110px 56px minmax(160px,2fr) 176px";
const HANDLE = `<span class="handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>`;
const moves = (kind: string) =>
  `<button type="submit" name="action" value="${kind}-up" class="plain small" aria-label="Move up" title="Move up">↑</button><button type="submit" name="action" value="${kind}-down" class="plain small" aria-label="Move down" title="Move down">↓</button>`;

function preferenceRow(p: Preference, token: string, action: string): string {
  const company = CHECKED.has(p.type ?? "");
  const columns = prefColumns(company);
  const checked = company
    ? `<div class="wide-cell muted">${p.lastChecked ? `Checked ${esc(p.lastChecked)} ${tag(p.lastResult)}` : "Not checked yet"}<br><select name="hiringService" aria-label="Hiring service">${options(HIRING_SERVICE_NAMES, p.hiringService, "Hiring service")}</select><input type="text" name="boardId" value="${esc(p.boardId)}" placeholder="Board ID" aria-label="Board ID"></div>`
    : "";
  return `<form method="post" action="${action}" class="trow${p.active ? "" : " off"}" style="grid-template-columns:${columns}" data-id="${esc(p.id)}">${token}<input type="hidden" name="id" value="${esc(p.id)}"><input type="hidden" name="type" value="${esc(p.type ?? "")}">
${HANDLE}<div class="wide-cell"><input type="text" name="name" value="${esc(p.name)}" aria-label="Name" required>${company ? `<input type="url" name="link" value="${esc(p.link ?? "")}" placeholder="${linkLabel(p.type)}" aria-label="${linkLabel(p.type)}">` : ""}</div>
<select name="priority" aria-label="Priority">${options(PRIORITIES, p.priority, "None")}</select>
<input type="checkbox" name="active"${p.active ? " checked" : ""} aria-label="Active" title="Active">
<div class="wide-cell"><input type="text" name="notes" value="${esc(p.notes)}" placeholder="Notes" aria-label="Notes">${company ? "" : `<input type="hidden" name="link" value="${esc(p.link ?? "")}">`}</div>
${checked}<div class="cell-actions"><button type="submit" name="action" value="pref-save" class="plain small">Save</button><button type="submit" name="action" value="pref-delete" class="danger small">Delete</button>${moves("pref")}</div></form>`;
}

function preferenceSection(type: string, rows: Preference[], token: string, action: string): string {
  const company = CHECKED.has(type);
  const columns = prefColumns(company);
  const head = `<div class="thead" style="grid-template-columns:${columns}"><span></span><span>Name${company ? " and link" : ""}</span><span>Priority</span><span>Active</span><span>Notes</span>${company ? "<span>Last check</span>" : ""}<span></span></div>`;
  const add = `<form method="post" action="${action}" class="trow" style="grid-template-columns:${columns}">${token}<input type="hidden" name="type" value="${esc(type)}">
<span></span><div class="wide-cell"><input type="text" name="name" placeholder="+ New ${esc(type.toLowerCase())}" aria-label="New ${esc(type.toLowerCase())}" required>${company ? `<input type="url" name="link" placeholder="${linkLabel(type)}" aria-label="${linkLabel(type)}">` : ""}</div>
<select name="priority" aria-label="Priority">${options(PRIORITIES, type === "Job Listing Websites" ? null : "High", "None")}</select>
<input type="checkbox" name="active" checked aria-label="Active">
<div class="wide-cell"><input type="text" name="notes" placeholder="Notes" aria-label="Notes"></div>${company ? "<div></div>" : ""}
<div class="cell-actions"><button type="submit" name="action" value="pref-save" class="small">Add</button></div></form>`;
  return `<h3 id="type-${esc(type.replace(/\s+/g, "-").toLowerCase())}">${esc(type)} <span class="muted">${rows.length}</span></h3><p class="muted">${esc(TYPE_HELP[type] ?? "")}</p>
<div class="table" data-sortable="pref-order" data-type="${esc(type)}">${head}${rows.map((p) => preferenceRow(p, token, action)).join("")}${add}</div>`;
}

const MEMORY_COLUMNS = "20px minmax(200px,3fr) 56px minmax(120px,1.2fr) 176px";

function memoryRow(m: Memory, token: string, action: string): string {
  const from = m.roleLink ? `<a href="${esc(m.roleLink)}" rel="noreferrer" target="_blank">${esc(m.roleName || "role in Notion")}</a>` : "";
  return `<form method="post" action="${action}" class="trow${m.active ? "" : " off"}" style="grid-template-columns:${MEMORY_COLUMNS}" data-id="${esc(m.id)}">${token}<input type="hidden" name="id" value="${esc(m.id)}">
${HANDLE}<div class="wide-cell"><input type="text" name="note" value="${esc(m.note)}" aria-label="Note" required></div>
<input type="checkbox" name="active"${m.active ? " checked" : ""} aria-label="Active" title="Active">
<div class="muted">${tag(m.source)} ${esc(m.addedAt.slice(0, 10))}${from ? `<br>${from}` : ""}</div>
<div class="cell-actions"><button type="submit" name="action" value="memory-save" class="plain small">Save</button><button type="submit" name="action" value="memory-delete" class="danger small">Delete</button>${moves("memory")}</div></form>`;
}

function render(base: string, notes: Notes, csrf: string, params: URLSearchParams): Response {
  const action = `${esc(base)}/preferences`;
  const token = `<input type="hidden" name="csrf" value="${esc(csrf)}">`;
  const flash = MESSAGES[params.get("m") ?? ""];
  const types = [...PREFERENCE_TYPES, ...new Set(notes.preferences.map((p) => p.type ?? "Other").filter((t) => !PREFERENCE_TYPES.includes(t as any)))];
  const sections = types.map((type) => preferenceSection(type, notes.preferences.filter((p) => (p.type ?? "Other") === type), token, action)).join("");
  const active = notes.memories.filter((m) => m.active).length;
  const memoryAdd = `<form method="post" action="${action}" class="trow" style="grid-template-columns:${MEMORY_COLUMNS}">${token}<input type="hidden" name="source" value="Chat">
<span></span><div class="wide-cell"><input type="text" name="note" placeholder="+ New note, e.g. Skip agency roles" aria-label="New note" required></div>
<input type="checkbox" name="active" checked aria-label="Active"><div></div>
<div class="cell-actions"><button type="submit" name="action" value="memory-save" class="small">Add</button></div></form>`;
  const empty = !notes.preferences.length && !notes.memories.length;
  const importCard = `<div class="note"><strong>Import from Notion</strong>
<p class="muted">Copies the Preference and Memory rows from Job Applications to this page${empty ? "" : ", replacing everything here"}. The Notion rows are left as they are; delete them there once you're happy.${notes.importedAt ? ` Last imported ${esc(notes.importedAt.slice(0, 10))}.` : ""}</p>
<form method="post" action="${action}">${token}${empty ? "" : `<label><input type="checkbox" name="confirm" value="yes"> Replace what's here</label>`}<button type="submit" name="action" value="import" class="plain">Import from Notion</button></form></div>`;

  return page({
    title: TITLE,
    wide: true,
    scripts: ["/preferences.js"],
    body: `${nav(base, "preferences")}<div id="sort-target" data-action="${action}" data-csrf="${esc(csrf)}" hidden></div><h1>${TITLE}</h1>
<p class="muted">What the daily job search looks for, and Claude's notes about what you want. The server and Claude read this page's contents through the connector, so changes count from the next run.</p>
${flash ? `<p class="${flash[0]}" role="status">${esc(flash[1])}</p>` : ""}
${notesConnected() ? "" : `<div class="note"><strong>Storage not connected.</strong> Connect a private Vercel Blob store to this project to save preferences.</div>`}
${empty ? importCard : ""}
<h2>Search preferences</h2>
<p class="muted">Yours: Claude reads these but never changes them. Untick Active to pause one.</p>
${sections}
<h2 id="memory">Claude memory <span class="muted">${active} active of ${notes.memories.length}</span></h2>
<p class="muted">Notes Claude saves from your comments and chats, and pattern suggestions (switched off until you tick them). Claude reads the active ones on every run.</p>
<div class="table" data-sortable="memory-order"><div class="thead" style="grid-template-columns:${MEMORY_COLUMNS}"><span></span><span>Note</span><span>Active</span><span>From</span><span></span></div>${notes.memories.map((m) => memoryRow(m, token, action)).join("")}${memoryAdd}</div>
${empty ? "" : `<hr>${importCard}`}`,
  });
}

// GET /preferences.js: drag a row by its handle to reorder its list. The
// new order is saved straight away; the arrows do the same without it.
const SORT_SCRIPT = `(() => {
  const target = document.getElementById("sort-target");
  if (!target) return;
  for (const list of document.querySelectorAll("[data-sortable]")) {
    let dragged = null;
    list.addEventListener("pointerdown", (e) => {
      const row = e.target.closest("[data-id]");
      if (row) row.draggable = Boolean(e.target.closest(".handle"));
    });
    list.addEventListener("dragstart", (e) => {
      dragged = e.target.closest("[data-id]");
      if (!dragged) return;
      dragged.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragged.dataset.id);
    });
    list.addEventListener("dragover", (e) => {
      if (!dragged) return;
      e.preventDefault();
      const over = e.target.closest("[data-id]");
      if (!over || over === dragged || over.parentNode !== list) return;
      const box = over.getBoundingClientRect();
      list.insertBefore(dragged, e.clientY > box.top + box.height / 2 ? over.nextSibling : over);
    });
    list.addEventListener("dragend", async () => {
      if (!dragged) return;
      dragged.classList.remove("dragging");
      dragged.draggable = false;
      dragged = null;
      const ids = [...list.children].filter((r) => r.dataset.id).map((r) => r.dataset.id);
      const body = new URLSearchParams({ csrf: target.dataset.csrf, action: list.dataset.sortable, type: list.dataset.type || "", ids: ids.join(",") });
      try {
        const res = await fetch(target.dataset.action, { method: "POST", body, credentials: "same-origin", redirect: "manual" });
        if (res.type !== "opaqueredirect" && !res.ok) throw new Error(String(res.status));
      } catch {
        location.reload();
      }
    });
  }
})();`;

function signingKey(): Promise<CryptoKey> | null {
  const password = adminPassword();
  return password ? getKeys(password).then((k) => k.signing) : null;
}

async function handlePost(base: string, form: URLSearchParams): Promise<Response> {
  const back = (m: string, anchor = "") => redirect(`${base}/preferences?m=${m}${anchor}`);
  if (!notesConnected()) return back("nostore");
  const action = form.get("action");
  const id = form.get("id") ?? "";
  const field = (name: string) => form.get(name) ?? "";
  const anchor = (type: string | null) => `#type-${(type ?? "").replace(/\s+/g, "-").toLowerCase()}`;
  try {
    if (action === "pref-save") {
      if (!field("name").trim()) return back("noname");
      const input: Partial<Preference> = {
        name: field("name"),
        type: field("type") || null,
        priority: field("priority") || null,
        active: form.get("active") === "on",
        notes: field("notes"),
        link: field("link") || null,
        ...(form.has("hiringService") ? { hiringService: field("hiringService") || null, boardId: field("boardId") } : {}),
      };
      const saved = await changeNotes((notes) => {
        const i = notes.preferences.findIndex((p) => p.id === id);
        const pref = cleanPreference(input, i >= 0 ? notes.preferences[i] : undefined);
        if (i >= 0) notes.preferences[i] = pref;
        else notes.preferences.push(pref);
        return pref;
      });
      return back("saved", anchor(saved.type));
    }
    if (action === "pref-delete") {
      const type = await changeNotes((notes) => {
        const gone = notes.preferences.find((p) => p.id === id);
        notes.preferences = notes.preferences.filter((p) => p.id !== id);
        return gone?.type ?? null;
      });
      return back("deleted", anchor(type));
    }
    if (action === "memory-save") {
      if (!field("note").trim()) return back("noname", "#memory");
      await changeNotes((notes) => {
        const i = notes.memories.findIndex((m) => m.id === id);
        const input: Partial<Memory> = { note: field("note"), active: form.get("active") === "on", ...(i < 0 ? { source: MEMORY_SOURCES.includes(field("source") as any) ? field("source") : "Chat" } : {}) };
        if (i >= 0) notes.memories[i] = cleanMemory(input, notes.memories[i]);
        else notes.memories.unshift(cleanMemory(input));
      });
      return back("saved", "#memory");
    }
    const move = /^(pref|memory)-(up|down)$/.exec(action ?? "");
    if (move) {
      await changeNotes((notes) => {
        const list: { id: string; type?: string | null }[] = move[1] === "pref" ? notes.preferences : notes.memories;
        const i = list.findIndex((x) => x.id === id);
        if (i < 0) return;
        // The nearest row in the same list on the page (same type, for preferences).
        const step = move[2] === "up" ? -1 : 1;
        let j = i + step;
        while (j >= 0 && j < list.length && move[1] === "pref" && (list[j].type ?? null) !== (list[i].type ?? null)) j += step;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
      });
      return back("moved", move[1] === "pref" ? anchor(field("type") || null) : "#memory");
    }
    if (action === "pref-order" || action === "memory-order") {
      const ids = field("ids").split(",").filter(Boolean);
      await changeNotes((notes) => {
        if (action === "pref-order") notes.preferences = reorder(notes.preferences, ids, (p) => (p.type ?? "Other") === (field("type") || "Other"));
        else notes.memories = reorder(notes.memories, ids, () => true);
      });
      return back("moved");
    }
    if (action === "memory-delete") {
      await changeNotes((notes) => {
        notes.memories = notes.memories.filter((m) => m.id !== id);
      });
      return back("deleted", "#memory");
    }
    if (action === "import") {
      const current = await loadNotes();
      if ((current.preferences.length || current.memories.length) && form.get("confirm") !== "yes") return back("confirm");
      try {
        await importFromNotion(await notion());
      } catch {
        return back("importfailed");
      }
      return back("imported");
    }
  } catch {
    return back("failed");
  }
  return back("failed");
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/preferences.js" || url.searchParams.get("route") === "script") {
      return new Response(SORT_SCRIPT, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
    }
    const base = baseUrl(request);
    const sid = await signedInOwner(request);
    const key = signingKey();
    if (!sid || !key) {
      return page({ title: TITLE, status: 401, body: `<h1>${TITLE}</h1><p><a href="${esc(base)}/settings?next=/preferences">Sign in</a> with your passkey to see and edit your job search preferences.</p>` });
    }
    const signing = await key;
    if (request.method === "POST") {
      const form = new URLSearchParams(await request.text());
      const csrf = await verifyToken<TokenPayload & { sid: string }>(signing, form.get("csrf"), "notes-csrf");
      if (!csrf || csrf.sid !== sid) return redirect(`${base}/preferences?m=expired`);
      return handlePost(base, form);
    }
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
    const csrf = await signToken(signing, { typ: "notes-csrf", exp: nowSeconds() + CSRF_TTL, sid });
    return render(base, await loadNotes(), csrf, new URL(request.url).searchParams);
  },
};
