import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanText, keywords, parseDate, relevantPassages, truncate, urlKey } from "../lib/text.js";

test("cleanText strips links, images, labels and Reddit filler", () => {
  const raw = "Section Title: A > B\nContent:\nSee [the docs](https://x.com/a(b)) ![img](i.png)\nAccept all cookies\nReal text.\nRelated Answers\nAI summary here";
  assert.equal(cleanText(raw), "See the docs\nReal text.");
});

test("cleanText strips links that carry a hover title", () => {
  assert.equal(cleanText('MBS have " [negative convexity](https://example.com/a "")".'), 'MBS have " negative convexity".');
});

test("urlKey folds tracking parameters and arXiv variants", () => {
  assert.equal(urlKey("https://www.example.com/a/?utm_source=x&id=2"), urlKey("https://example.com/a?id=2"));
  assert.equal(urlKey("https://arxiv.org/pdf/2309.17145v3.pdf"), urlKey("https://arxiv.org/abs/2309.17145"));
  assert.equal(urlKey("https://old.reddit.com/r/a/comments/1/x/?share=1"), urlKey("https://www.reddit.com/r/a/comments/1/x"));
});

test("parseDate understands relative windows", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  assert.equal(parseDate("7d", now), "2026-09-28");
  assert.equal(parseDate("3m", now), "2026-07-05");
  assert.equal(parseDate("1y", now), "2025-10-05");
  assert.equal(parseDate("2026-09", now), "2026-09-01");
  assert.equal(parseDate(undefined, now), undefined);
});

test("keywords and truncate", () => {
  assert.equal(keywords("What is the latest version of Blender and when was it released?"), "latest version Blender released");
  assert.ok(truncate("One. Two. Three. Four.", 12).endsWith("…"));
});

test("relevantPassages keeps short pages whole and falls back to the top", () => {
  assert.equal(relevantPassages("Short page.", "anything", 100), "Short page.");
  const long = "First paragraph here and more words to pad it out. ".repeat(10);
  assert.equal(relevantPassages(long, "zebra", 100), truncate(long, 100));
});

test("relevantPassages finds an answer deep inside one long block", () => {
  const filler = Array.from({ length: 80 }, (_, i) => `Line ${i} talks about the history of the survey and its many teams.`);
  filler.splice(60, 0, "European media required 4.9 clicks to cancel against 6.2 clicks for US media.");
  const out = relevantPassages(filler.join("\n"), "How many clicks to cancel?", 2500);
  assert.match(out, /4\.9 clicks to cancel/);
  assert.ok(out.length <= 2500);
});

test("relevantPassages keeps a table's header with the rows it picks", () => {
  const rows = Array.from({ length: 60 }, (_, i) => `| v${i} | Codename${i} | 20${10 + (i % 15)}-01-01 | EOL |`);
  rows[50] = "| v50 | Krypton | 2025-05-06 | LTS |";
  const table = ["| Version | Codename | First released | Status |", "| --- | --- | --- | --- |", ...rows].join("\n");
  const page = `# Releases\n\n${"Some introduction about how releases work and are supported. ".repeat(30)}\n\n${table}`;
  const out = relevantPassages(page, "Which release has the Krypton codename?", 2500);
  assert.match(out, /\| Version \| Codename/);
  assert.match(out, /Krypton \| 2025-05-06 \| LTS/);
});

test("relevantPassages prefers the passage with the figure over one that echoes the question", () => {
  const page = [
    "# Minimum wage rates",
    "## Current rates",
    "| | 21 and over | 18 to 20 |\n| --- | --- | --- |\n| April 2026 | £12.71 | £10.85 |",
    "## Previous rates",
    "The National Living Wage and the National Minimum Wage were for workers aged 21 and over from April 2024. The National Living Wage rates for April 2024 to March 2026 are below.",
    "| April 2025 to March 2026 | £12.21 | £10 |",
    "Other text about apprentices and accommodation offsets. ".repeat(60),
  ].join("\n\n");
  const out = relevantPassages(page, "What is the National Living Wage from April 2026?", 2500);
  assert.match(out, /April 2026 \| £12\.71/);
});

test("relevantPassages stays within the limit", () => {
  const page = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} about rates, prices and dates in 2026.`).join("\n\n");
  for (const max of [2500, 4000, 6000]) assert.ok(relevantPassages(page, "What are the prices and rates in 2026?", max).length <= max);
});

test("relevantPassages finds a height asked for with a different word", () => {
  const body = Array.from(
    { length: 120 },
    (_, i) => `Climbers on Mount Example in season ${i} reached high camps at various altitudes, and the mountain's elevation changed their plans.`,
  );
  const page = ["# Mount Example", "| Mount Example | |\n| --- | --- |\n| Elevation | 4,321 m |", "Mount Example is the highest peak in the range.", ...body].join("\n\n");
  assert.match(relevantPassages(page, "How tall is Mount Example?", 2500), /4,321 m/);
});
