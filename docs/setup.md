# Setting up the web-research skill

The skill lives in `.claude/skills/web-research-composio/`. It reaches Exa, Reddit and Parallel through the Composio connector and works best with Claude's built-in web search switched off. The earlier version, which used separate Exa and Parallel connectors, was removed on 4 October 2026.

## 1. Connect Composio (all apps)

1. Add the Composio connector at [claude.ai/customize/connectors](https://claude.ai/customize/connectors).
2. In Composio, connect the **Exa**, **Reddit** and **Parallel** toolkits. Claude can give you sign-in links: ask it to "connect Parallel in Composio".
   - Keep your Exa and Parallel accounts and keys active: Composio uses them.
3. Remove any separate Exa or Parallel connectors, so Claude doesn't see two sets of tools.
4. Start a new chat or session. Connectors load when a session starts.

More detail and test findings are in `composio.md`.

## 2. Install the skill

### Claude Code (terminal, desktop and cloud sessions)

- **This repository:** nothing to do. Claude Code loads `.claude/skills/web-research-composio/` automatically in this project.
- **All your projects:** copy the folder to your personal skills folder:
  ```
  cp -r .claude/skills/web-research-composio ~/.claude/skills/
  ```
  If an older `web-research` folder is there, delete it.

### Claude app (web, desktop, mobile) and Cowork

1. Zip the `web-research-composio` folder (the folder itself, containing `SKILL.md` and `references/`).
2. In Claude, open Settings and find the Skills section (under Capabilities at the time of writing). Delete the older `web-research` skill if it is there, then upload the zip.
3. Custom skills need a paid plan with code execution switched on.

Menu names in the Claude app change often, so check the wording when you get there.

## 3. Switch off built-in web search

### Claude Code

Add this to `~/.claude/settings.json` (all projects) or `.claude/settings.json` (one project):

```json
{
  "permissions": {
    "deny": ["WebSearch", "WebFetch"]
  }
}
```

A deny rule at any level overrides any allow rule. Use the plain names as shown; a reported bug broke plugin loading when wildcard patterns were used.

### Claude app

- Turn off **Web search** in the chat's tools menu.
- Team and Enterprise admins can switch it off for everyone (Admin settings, then Capabilities).
- As a backup, add a line to your personal preferences: "For web research, use the web-research-composio skill through Composio. Never use built-in web search."

### Cowork

A [reported bug](https://github.com/anthropics/claude-code/issues/54087) says deny rules in `settings.json` are ignored in the Cowork desktop app. Rely on the skill and your personal preferences there, and check that Claude is using the Composio tools.

## 4. Check it works

Ask one of the questions in `docs/test-prompts-2.md` and confirm that:

- Claude loads the web-research-composio skill,
- it calls Composio tools (`EXA_SEARCH`, `REDDIT_...`, `PARALLEL_...`), not built-in search,
- Exa searches include `contents.highlights` with a query.
