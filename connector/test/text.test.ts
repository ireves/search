import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanReport, cleanText, keywords, parseDate, tidyExcerpt, truncate, urlKey } from "../lib/text.js";

test("cleanText strips links, images, labels and Reddit filler", () => {
  const raw = "Section Title: A > B\nContent:\nSee [the docs](https://x.com/a(b)) ![img](i.png)\nAccept all cookies\nReal text.\nRelated Answers\nAI summary here";
  assert.equal(cleanText(raw), "See the docs\nReal text.");
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

test("cleanText drops menu links with hover titles, script notices, X and Reddit chrome, and repeated paragraphs", () => {
  const raw = [
    '- [**News and Updates**](https://forum.figma.com/news-and-updates-1 "News and Updates")',
    "Notice: This page displays a fallback because interactive scripts did not run. Possible causes include disabled JavaScript or failure to load scripts or stylesheets.",
    "user avatar Blender @Blender Happy Blender 5.2 LTS release day!",
    "Log in to Reddit Expand user menu Open settings menu Great answer here.",
    "Framework Laptop 16 is an endlessly customizable laptop with upgradeable graphics.",
    "Framework Laptop 16 is an endlessly customizable laptop with upgradeable graphics.",
    "## Post",
    "[](https://x.com/someone)",
  ].join("\n");
  const out = cleanText(raw);
  assert.doesNotMatch(out, /https?:|Notice:|user avatar|Log in to Reddit|^Post$/m);
  assert.match(out, /News and Updates/);
  assert.match(out, /Happy Blender 5\.2 LTS release day!/);
  assert.match(out, /Great answer here\./);
  assert.equal(out.match(/endlessly customizable/g)?.length, 1);
});

test("tidyExcerpt removes the echoed title and tiny fragments between gaps, keeping code and lists", () => {
  const out = tidyExcerpt("# A Guide To Things\n...\nReal sentence about things.\n...\nbut you can\n...\nMarch 31 ... 6:17\n...\n```shell\nsudo sysctl -p\n```\n...\n- Numpad\n...", "A Guide To Things");
  assert.equal(out, "Real sentence about things.\n…\nMarch 31 ... 6:17\n…\n```shell\nsudo sysctl -p\n```\n…\n- Numpad");
});

test("cleanText keeps the words 'user avatar' in ordinary text", () => {
  assert.equal(cleanText("Set the user avatar size in settings."), "Set the user avatar size in settings.");
  assert.equal(cleanText("* user avatar Blender @Blender New release"), "* Blender @Blender New release");
});

test("cleanReport keeps link addresses, which are a report's citations", () => {
  assert.equal(
    cleanReport('See [Ofgem report](https://ofgem.gov.uk/r.pdf "x") and [  Apply (new window)\n](https://gov.uk/a) ![img](i.png)'),
    "See Ofgem report (https://ofgem.gov.uk/r.pdf) and Apply (https://gov.uk/a)",
  );
});
