# Helper agents (Claude Code and Claude Cowork)

Helpers keep raw search output out of the main conversation. Every later message re-reads the whole conversation, so a large page dropped into the main chat makes every following turn cost more. A helper reads it once and hands back a short summary.

## When to use them

Use helpers when the job is heavy:

- more than about 4 searches, or
- more than 2 long documents to read, or
- a comparison, list or survey across many sources, or
- several independent angles that can run at the same time.

Don't use them for a single fact, one known page, or a quick check. Each helper starts cold and costs extra allowance.

If there's no subagent tool (Agent or Task), as in normal claude.ai chats and the mobile app, hand heavy work to an Exa Agent (`agent_run`) instead.

## How to split the work

- Split by sub-question or angle: practitioner view, official docs, complaints and failure reports, newest developments, a specific site.
- Don't split by synonym ("overrated" and "overhyped" find the same pages).
- 3 to 5 searches per helper. For lists of known items, 3 to 5 items per helper.
- Launch all independent helpers in one message and wait for them.
- Use the smallest capable model (Haiku) unless judgement-heavy reading is needed.

## Prompt template

Fill in the brackets. Give the absolute path to this skill's folder.

```
Read [skill folder]/SKILL.md, then [skill folder]/references/exa.md and/or references/parallel.md as needed.
Use only the Exa and Parallel connector tools. Never use built-in web search or web fetch.

Today's date is [YYYY-MM-DD].

Task: [the specific sub-question]
Suggested searches: [optional list]
A source qualifies if: [criteria, for example "published since 2026-01-01", "a real listing, not a job board search page"]

Keep results small: Exa searches with textMaxCharacters 1, a highlightsQuery and highlightsMaxCharacters of 800-1500. Parallel reads with an objective, never full_content.

Return only:
- Findings: one line per fact, each with its source URL and date if known
- Confidence, per finding, using exactly these labels:
  - well supported = two or more independent sources agree (mirrors of the same page count as one)
  - single source = only one source says it
  - unconfirmed = implied or partly stated, not clearly sourced
- Gaps: what you looked for and couldn't find
- sources_reviewed: [total number of results across all your searches]
Do not include raw tool output.
```

## After the helpers return

1. Merge findings and remove duplicate URLs. Treat mirrors of the same document as one source.
2. Where helpers disagree, prefer primary sources (official docs, the paper itself, the company's own page) and say there was disagreement.
3. Run the confidence check from SKILL.md Step 4 on the combined findings. Fill any remaining gaps yourself or with one more targeted helper.
