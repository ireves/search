import { exaSearch, type Hit } from "../engines/exa.js";
import { EngineError } from "../engines/http.js";
import { parallelSearch } from "../engines/parallel.js";
import { hostOf, keywords, today } from "../text.js";
import { fuse, renderHit, type Ranked } from "./merge.js";

export interface VerifyInput {
  claims: string[] | string;
}

const PER_CLAIM = 4;
const CHARS = 500;

// Gathers evidence for each claim from both engines in one call. It doesn't
// give a verdict: Claude reads the excerpts and decides, so the reasoning stays
// visible and checkable.
export async function runVerify(input: VerifyInput): Promise<{ text: string; isError: boolean }> {
  const claims = (Array.isArray(input.claims) ? input.claims : [input.claims])
    .map((c) => String(c ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!claims.length) return { text: "Give 1 to 8 claims to check.", isError: true };

  const failures = new Set<string>();
  const note = (e: unknown) => failures.add(e instanceof EngineError ? e.friendly : (e as Error).message);

  const blocks = await Promise.all(
    claims.map(async (claim, i) => {
      const objective = `Find sources that confirm, correct or contradict this statement. Prefer primary and official sources and pages that state the exact figure or date: ${claim}`;
      const [exa, par] = await Promise.all([
        exaSearch({ query: claim, objective, highlightQuery: claim, numResults: 6, type: "auto", maxChars: CHARS }).catch((e) => {
          note(e);
          return [] as Hit[];
        }),
        parallelSearch({ objective, queries: [keywords(claim, 7)], mode: "advanced", maxResults: 6, maxCharsPerResult: CHARS }).catch((e) => {
          note(e);
          return [] as Hit[];
        }),
      ]);
      const picked = pickIndependent(fuse([{ hits: exa, weight: 1 }, { hits: par, weight: 1 }], 12), PER_CLAIM);
      const sites = new Set(picked.map((h) => hostOf(h.url))).size;
      const lines = picked.map((h, j) => renderHit(h, `${i + 1}.${j + 1}`));
      return [
        `Claim ${i + 1}: ${claim}`,
        lines.length ? lines.join("\n\n") : "No evidence found.",
        `Separate websites: ${sites}`,
      ].join("\n\n");
    }),
  );

  const header = `Evidence for ${claims.length} claim${claims.length === 1 ? "" : "s"} · today is ${today()}\nJudge each claim from the excerpts: supported, contradicted, outdated or not found. Copies of the same story count once.`;
  const anyEvidence = blocks.some((b) => !b.includes("No evidence found."));
  return { text: [header, ...blocks, ...(failures.size ? [[...failures].join("\n")] : [])].join("\n\n---\n\n"), isError: !anyEvidence && failures.size > 0 };
}

// Prefers one result per website, so the evidence comes from different sources.
function pickIndependent(hits: Ranked[], n: number): Ranked[] {
  const chosen: Ranked[] = [];
  const hosts = new Set<string>();
  for (const h of hits) {
    if (chosen.length >= n) break;
    if (hosts.has(hostOf(h.url))) continue;
    hosts.add(hostOf(h.url));
    chosen.push(h);
  }
  for (const h of hits) {
    if (chosen.length >= n) break;
    if (!chosen.includes(h)) chosen.push(h);
  }
  return chosen;
}
