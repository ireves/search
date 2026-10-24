// The Search connector's job search tools (lib/mcp.ts lists them):
// run_job_search and job_search_notes. The daily
// job search skill (/job-search) calls it to run the server's stages; the
// connector's instructions and the description keep Claude from using it
// anywhere else.

import { STAGES, type StageName } from "./config.js";
import { changeNotes, cleanMemory, loadNotes, MEMORY_SOURCES } from "./notes.js";
import { runJobs, type RunReport } from "./run.js";

export const JOB_SEARCH_TOOL = {
  name: "run_job_search",
  title: "Run a job search stage",
  description:
    "Only for the /job-search skill: never call it unless that skill is running. Runs one stage of the daily job search and returns its report as JSON. recheck: checks found roles' adverts and sets Advert status in Job Applications (never changes Application rows; lists watched roles that closed). companies: reads the job lists of the 12 companies checked longest ago and adds new roles to the Inbox (Review status New), or a Needs Claude row when a page couldn't be read. job_sites: searches LinkedIn, Indeed and Glassdoor for each Role and Location preference and adds new roles to the Inbox. linkedin_posts: finds recent public LinkedIn hiring posts for each Role preference and adds them to the Inbox for Claude to judge. dry_run reports without writing to Notion.",
  inputSchema: {
    type: "object",
    properties: {
      stage: { type: "string", enum: [...STAGES], description: "recheck, companies, job_sites, then linkedin_posts." },
      dry_run: { type: "boolean", description: "Report what would change without writing to Notion. Default false." },
    },
    required: ["stage"],
    additionalProperties: false,
  },
  annotations: { title: "Run a job search stage", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
};

type Json = Record<string, any>;

// Keeps the reply readable: long dropped-role lists are cut down.
export function compactReport(report: RunReport): Json {
  return {
    ...report,
    stages: report.stages.map((s) => {
      const details = s.details as Json | undefined;
      if (!details?.companies && !details?.searches) return s;
      return {
        ...s,
        details: {
          ...details,
          ...(details.companies ? { companies: details.companies.map((c: Json) => ({ ...c, dropped: c.dropped?.slice(0, 8), dropped_total: c.dropped?.length ?? 0 })) } : {}),
          ...(details.searches ? { searches: details.searches.map((c: Json) => ({ ...c, dropped: c.dropped?.slice(0, 8), dropped_total: c.dropped?.length ?? 0 })) } : {}),
        },
      };
    }),
  };
}

export async function runJobSearchTool(args: Json): Promise<{ text: string; isError: boolean }> {
  if (!STAGES.includes(args.stage)) return { text: `stage must be one of: ${STAGES.join(", ")}`, isError: true };
  try {
    const report = await runJobs({ dry: args.dry_run === true, trigger: "claude", stages: [args.stage as StageName] });
    return { text: JSON.stringify(compactReport(report)), isError: false };
  } catch (error) {
    return { text: `The job search run failed: ${(error as Error).message}`, isError: true };
  }
}

// The job search's notes for Claude: the user's preferences (read only) and
// Claude's memory notes about what they want (lib/jobs/notes.ts).
export const NOTES_TOOL = {
  name: "job_search_notes",
  title: "Job search preferences and memory",
  description:
    "The user's job search preferences and Claude's memory notes about what they want. Use only in the /job-search and /job-pick skills, or to save the user's feedback about their job search. read: active preferences by type, and every memory note with its id. add_memory: save a note (short and specific). update_memory: change a note's wording, or switch it on or off with active. Preferences can't be changed here: the user edits them on the connector's /preferences page.",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["read", "add_memory", "update_memory"] },
      id: { type: "string", description: "update_memory: the note's id, from read." },
      note: { type: "string", description: "add_memory, or update_memory to reword: the note, e.g. \"Skip roles needing 5+ years\"." },
      active: { type: "boolean", description: "Whether the note is used. add_memory default true; Pattern suggestions start false." },
      source: { type: "string", enum: [...MEMORY_SOURCES], description: "add_memory: Chat (said in a conversation), Comment (a comment on a role) or Pattern (Claude's suggestion)." },
      role_link: { type: "string", description: "add_memory with source Comment: the Notion link of the role the comment was on." },
      role_name: { type: "string", description: "add_memory with source Comment: that role, as \"Role at Company\"." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  annotations: { title: "Job search preferences and memory", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

export async function runNotesTool(args: Json): Promise<{ text: string; isError: boolean }> {
  const fail = (text: string) => ({ text, isError: true });
  try {
    if (args.action === "read") {
      const notes = await loadNotes();
      const preferences: Record<string, Json[]> = {};
      for (const p of notes.preferences.filter((x) => x.active)) {
        const type = p.type ?? "Other";
        (preferences[type] ??= []).push({ name: p.name, priority: p.priority, ...(p.notes ? { notes: p.notes } : {}), ...(p.link ? { link: p.link } : {}) });
      }
      const memories = notes.memories.map((m) => ({ id: m.id, note: m.note, active: m.active, source: m.source, ...(m.roleLink ? { role_link: m.roleLink, role_name: m.roleName } : {}), added: m.addedAt.slice(0, 10) }));
      return { text: JSON.stringify({ preferences, memories }), isError: false };
    }
    if (args.action === "add_memory") {
      if (!String(args.note ?? "").trim()) return fail("note is required.");
      const memory = cleanMemory({ note: args.note, active: args.active, source: args.source, roleLink: args.role_link, roleName: args.role_name });
      await changeNotes((notes) => notes.memories.unshift(memory));
      return { text: JSON.stringify({ saved: memory }), isError: false };
    }
    if (args.action === "update_memory") {
      const memory = await changeNotes((notes) => {
        const i = notes.memories.findIndex((m) => m.id === args.id);
        if (i < 0) return null;
        notes.memories[i] = cleanMemory({ note: args.note, active: args.active }, notes.memories[i]);
        return notes.memories[i];
      });
      return memory ? { text: JSON.stringify({ saved: memory }), isError: false } : fail(`No memory note with id ${args.id}. Call read for the ids.`);
    }
    return fail("action must be read, add_memory or update_memory.");
  } catch (error) {
    return fail(`The job search notes failed: ${(error as Error).message}`);
  }
}
