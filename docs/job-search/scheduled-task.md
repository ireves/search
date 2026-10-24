# Daily job search: Claude scheduled task

The prompt for the daily Claude run (plan section 6). It replaces the old "Job Finder" scheduled task.

## Setting it up

1. Finish `setup.md` first, including section 4 (the search plugin updated and the Search connector signed in).
2. Create a scheduled task in Claude, daily, early morning UK time.
   - Model: Sonnet, as the old task used.
   - Connectors: Search, Notion, Indeed.
3. Use this as the prompt:

   ```text
   /job-search
   ```

4. For the first few days, run it beside the old Job Finder task (which writes only to the old databases) and compare the results. Then turn the old task off for good.

## The instructions

The daily instructions live in the `/job-search` skill: [`skills/job-search/SKILL.md`](../../skills/job-search/SKILL.md). Change them there, not in the scheduled task, and bump its `Skill version:` line.

The skill only runs when typed as `/job-search`, so Claude never starts it, or the `run_job_search` tool, on its own. If your scheduled task doesn't run the skill from `/job-search`, paste the skill's text (everything after the `Skill version:` line) as the prompt instead.
