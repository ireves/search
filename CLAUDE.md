# Notes for Claude

## Change history (problem log context)

Every merged change to the connector or skills gets a row in the `search_changes` table in Supabase (the project with the `search_issues` table), added with the Supabase connector after the merge:
- `at` (merge time, UTC), `pr`, `commit` (short), `title`, `areas` (connector, skills, worker, logging, docs), `summary`.
- `effects`: how it changes search output or the problem log, and what entries logged before it will lack.
- `addresses`: ids of `search_issues` entries it was meant to fix.

Any change to a skill's SKILL.md also bumps its `Skill version:` line (date, plus a letter for a second change that day). The skills pass it to `log_issue`, so the log shows which version ran.

The search-log skill reads this history to judge each log entry against what the tool did at the time.
