---
name: search-report
description: Diagnostic report of how a search skill run went in this conversation (uni-search, better-search, web-search, deep-search or the Search connector). Run only when the user types /search-report. Lists every step, tool call, parameter, result, worker brief and worker digest in order, checks the run against the skill's own rules, and lists likely problems.
disable-model-invocation: true
---

Purpose: an exact record of what happened, so problems with the search skills, workers or connector can be found. Accuracy > neatness. Report what happened, never what should have happened. Make no new searches.

STEP 1 SCOPE
Message names a run ("last", "the second one", a question) -> that run. Else every search run in this conversation, oldest first. Leave out this /search-report request and anything after it.

STEP 2 GATHER (use the first that works)
A. Log file (Claude Code, and Claude apps that can run code): run `python3 <this skill's folder>/scripts/timeline.py --full > <scratch or outputs folder>/timeline.txt`, then read the file in parts. With no argument it reads the newest log under ~/.claude/projects, which is this conversation; confirm by finding your own recent messages in it, else pass the right .jsonl path. It prints the main conversation, then each worker's own log ("WORKER n", "started by: main CALL #k", models used). "NO LOG FOUND" or no python -> B.
B. Your own context: rebuild from the messages and tool results you can see. You see each worker's brief and digest, never its own calls. Write "not visible from this app" for what you cannot see. Never fill a gap from memory or guesswork.
Say which source was used at the top of the report.

STEP 3 CHECK
Read the SKILL.md of the skill that ran (it is in this conversation if it ran here; else ../<skill>/SKILL.md beside this skill's folder). Check the run against each rule that applies, with evidence. Always check:
- Mode: asked once before any search, or taken from the message?
- Tools: only Search connector tools? Any built-in web search or web fetch?
- Workers: subagent type, model asked for vs model the log shows, run in the foreground, independent workers started together, brief self-contained (JOBS, FACTS, LIMIT)?
- Worker behaviour: ran the briefed calls exactly; stayed within LIMIT; every finding has a url; ended with a COST line; made calls it was not asked to make.
- Calls: number vs the mode's budget; any repeated call; depth/type/after/fresh as briefed.
- Errors: engine errors, empty results, timeouts, refused or cut-off pages, "NO SEARCH TOOLS".
- Answer: facts traceable to a digest or result; nothing that only came from memory; cost line equals the sum of the COST and "Search cost of this call" lines.
- Time: slow steps (gaps over 30 seconds between a call and its result).

STEP 4 REPORT
Sections, in order (skip a section only when it would be empty):
1. Summary: question, skill, mode, source used (log or context), number of main calls and worker calls, total time, stated cost vs added-up cost, problems found (count).
2. Timeline: numbered table, one row per step: time | who (Main, Worker 1...) | action or tool | key parameters | outcome (results, error, cost line).
3. Workers: per worker: started by step n; type and model (asked / used); brief, word for word; its calls (from the log) as a short table; digest, word for word.
4. Rule check: table: rule | followed? (yes / no / partly / can't tell) | evidence (step number or quote).
5. Problems: each with what happened, evidence (step number, quote), likely cause, and a suggested fix to the skill, worker or connector. Mark each "seen" (in the record) or "guess" (your inference).
6. Final answer: the answer the user got, word for word (cut after 300 words, noting the cut).
7. Not visible: anything you could not see.

RULES
- Copy briefs, digests, errors, parameters and cost lines exactly. Long tool results: keep the lines that matter, note "[cut]".
- Never tidy up, merge or reorder steps. Times as the log gives them.
- Remove API keys, tokens and passwords; write [REDACTED].
- Plain English in the Summary and Problems; tool and parameter names as they appear.

OUTPUT
File tools available -> save as search-report-<YYYY-MM-DD-HHMM>.md in the outputs folder (Claude apps) or working folder (Claude Code), and send it to the user if a send-file tool exists. Then in chat: where the file is, the Summary, and the Problems list. No file tools -> the whole report in chat.
