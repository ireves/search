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
