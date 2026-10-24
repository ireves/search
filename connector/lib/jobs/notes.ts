// The user's job search preferences and Claude's memory notes. They live in
// one private file in the connector's Blob store, not in Notion, so reading
// them costs no Notion searches. The user edits them on the /preferences page
// (passkey sign-in); the server reads the preferences and records each
// company's last check; Claude reads both and adds or changes memory notes
// through the Search connector's job_search_notes tool. Claude never changes
// preferences.

import { randomId } from "../crypto.js";
import { fileBackend } from "../store.js";
import { COL, ENTRY, NOTION } from "./config.js";
import { dateStart, select, text, url, type Notion, type NotionPage } from "./notion.js";

const NOTES_PATH = "search-connector/job-notes.json";

export const PREFERENCE_TYPES = ["Role", "Location", "Level", "Pay", "Company", "Company type", "Job Listing Websites"] as const;
export const PRIORITIES = ["High", "Medium", "Low", "Exclude"] as const;
export const MEMORY_SOURCES = ["Chat", "Comment", "Pattern"] as const;
export const HIRING_SERVICE_NAMES = ["Greenhouse", "Lever", "Ashby", "Workable", "Own site"] as const;

export interface Preference {
  id: string;
  name: string;
  type: string | null;
  priority: string | null;
  active: boolean;
  notes: string;
  link: string | null;
  // Company and Job Listing Websites rows: set by the server after each check.
  lastChecked: string | null;
  lastResult: string | null;
  hiringService: string | null;
  boardId: string;
}

export interface Memory {
  id: string;
  note: string;
  active: boolean;
  source: string;
  // The Notion role the note came from, when it came from a comment.
  roleLink: string | null;
  roleName: string;
  notes: string;
  addedAt: string;
  updatedAt: string;
}

export interface Notes {
  v: 1;
  preferences: Preference[];
  memories: Memory[];
  importedAt?: string;
  updatedAt?: string;
}

const emptyNotes = (): Notes => ({ v: 1, preferences: [], memories: [] });

export const notesConnected = () => fileBackend(NOTES_PATH) !== null;

export async function loadNotes(): Promise<Notes> {
  const store = fileBackend(NOTES_PATH);
  const body = store ? await store.read() : null;
  if (!body) return emptyNotes();
  try {
    const parsed = JSON.parse(body) as Notes;
    if (parsed?.v === 1 && Array.isArray(parsed.preferences) && Array.isArray(parsed.memories)) return parsed;
  } catch {
    // A damaged file reads as empty; the next save replaces it.
  }
  return emptyNotes();
}

// Reads the file fresh, applies the change and saves it, so changes from the
// page, the server and Claude don't undo each other (barring two at the same
// moment).
export async function changeNotes<T>(change: (notes: Notes) => T): Promise<T> {
  const store = fileBackend(NOTES_PATH);
  if (!store) throw new Error("No storage connected. Connect a private Vercel Blob store to this project.");
  const notes = await loadNotes();
  const value = change(notes);
  notes.updatedAt = new Date().toISOString();
  await store.write(JSON.stringify(notes));
  return value;
}

export const newId = () => randomId(6);
const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export function cleanPreference(input: Partial<Preference>, base?: Preference): Preference {
  const pick = <T extends string>(list: readonly T[], value: unknown): T | null => (list.includes(value as T) ? (value as T) : null);
  const link = clip(input.link ?? base?.link, 2000);
  return {
    id: base?.id ?? newId(),
    name: clip(input.name ?? base?.name, 200),
    type: pick(PREFERENCE_TYPES, input.type ?? base?.type),
    priority: pick(PRIORITIES, input.priority ?? base?.priority),
    active: input.active ?? base?.active ?? true,
    notes: clip(input.notes ?? base?.notes, 2000),
    link: link || null,
    lastChecked: input.lastChecked ?? base?.lastChecked ?? null,
    lastResult: input.lastResult ?? base?.lastResult ?? null,
    hiringService: pick(HIRING_SERVICE_NAMES, input.hiringService ?? base?.hiringService),
    boardId: clip(input.boardId ?? base?.boardId, 200),
  };
}

export function cleanMemory(input: Partial<Memory>, base?: Memory): Memory {
  const now = new Date().toISOString();
  const link = clip(input.roleLink ?? base?.roleLink, 2000);
  return {
    id: base?.id ?? newId(),
    note: clip(input.note ?? base?.note, 500),
    active: input.active ?? base?.active ?? true,
    source: MEMORY_SOURCES.includes(input.source as any) ? input.source! : (base?.source ?? "Chat"),
    roleLink: /^https?:\/\//i.test(link) ? link : null,
    roleName: clip(input.roleName ?? base?.roleName, 200),
    notes: clip(input.notes ?? base?.notes, 2000),
    addedAt: base?.addedAt ?? input.addedAt ?? now,
    updatedAt: now,
  };
}

const pageLink = (id: string) => `https://app.notion.com/p/${id.replace(/-/g, "")}`;

function fromNotionPreference(page: NotionPage): Preference {
  const p = page.properties;
  return cleanPreference({
    name: text(p[COL.name]),
    type: select(p[COL.preferenceType]),
    priority: select(p[COL.priority]),
    active: p[COL.active]?.checkbox === true,
    notes: text(p[COL.notes]),
    link: url(p[COL.links]),
    lastChecked: dateStart(p[COL.lastChecked]),
    lastResult: select(p[COL.lastResult]),
    hiringService: select(p[COL.hiringService]),
    boardId: text(p[COL.boardId]),
  });
}

function fromNotionMemory(page: NotionPage): Memory {
  const p = page.properties;
  const role = p["Source role"]?.relation?.[0]?.id;
  return cleanMemory({
    note: text(p[COL.name]),
    active: p[COL.active]?.checkbox === true,
    source: select(p["Memory source"]) ?? "Chat",
    roleLink: role ? pageLink(role) : null,
    notes: text(p[COL.notes]),
    addedAt: p["Date added"]?.created_time ?? undefined,
  });
}

// One-off move from the Preference and Memory rows in Job Applications.
// Replaces everything saved here. The Notion rows are left as they are.
export async function importFromNotion(client: Notion): Promise<{ preferences: number; memories: number }> {
  const byType = async (entry: string) => (await client.query(NOTION.applications, { property: COL.entryType, select: { equals: entry } })).filter((p) => select(p.properties[COL.entryType]) === entry);
  const preferences = (await byType(ENTRY.preference)).map(fromNotionPreference).filter((p) => p.name);
  const memories = (await byType(ENTRY.memory)).map(fromNotionMemory).filter((m) => m.note);
  await changeNotes((notes) => {
    notes.preferences = preferences;
    notes.memories = memories;
    notes.importedAt = new Date().toISOString();
  });
  return { preferences: preferences.length, memories: memories.length };
}

// Puts the rows that `inList` picks into the order of `ids`, in the same
// places in the full list. Rows missing from `ids` keep their order, after.
export function reorder<T extends { id: string }>(all: T[], ids: string[], inList: (row: T) => boolean): T[] {
  const slots = all.map((row, i) => (inList(row) ? i : -1)).filter((i) => i >= 0);
  const rows = slots.map((i) => all[i]);
  const rank = (row: T) => (ids.includes(row.id) ? ids.indexOf(row.id) : ids.length + rows.indexOf(row));
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));
  const out = [...all];
  slots.forEach((slot, k) => (out[slot] = sorted[k]));
  return out;
}
