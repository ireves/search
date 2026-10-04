# Setting up the web-research skill

The skill lives in `.claude/skills/web-research/`. It needs two connectors and works best with Claude's built-in web search switched off.

## 1. Connect Exa and Parallel (all apps)

At [claude.ai/customize/connectors](https://claude.ai/customize/connectors):

1. **Exa:** add a custom connector with this URL, then sign in to your Exa account:
   `https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,agent_run,web_search_advanced_exa`
   Remove any older Exa connector so Claude doesn't see two sets of Exa tools.
2. **Parallel:** add a custom connector with this URL, then sign in to your Parallel account:
   `https://search.parallel.ai/mcp-oauth`
   The anonymous address (`/mcp`) hits rate limits quickly.
3. Start a new chat or session. Connectors load when a session starts.

## 2. Install the skill

### Claude Code (terminal, desktop and cloud sessions)

- **This repository:** nothing to do. Claude Code loads `.claude/skills/web-research/` automatically in this project.
- **All your projects:** copy the folder to your personal skills folder:
  ```
  cp -r .claude/skills/web-research ~/.claude/skills/
  ```

### Claude app (web, desktop, mobile) and Cowork

1. Zip the `web-research` folder (the folder itself, containing `SKILL.md` and `references/`).
2. In Claude, open Settings and find the Skills section (under Capabilities at the time of writing), then upload the zip.
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
- As a backup, add a line to your personal preferences: "For web research, use the web-research skill with Exa and Parallel. Never use built-in web search."

### Cowork

A [reported bug](https://github.com/anthropics/claude-code/issues/54087) says deny rules in `settings.json` are ignored in the Cowork desktop app. Rely on the skill and your personal preferences there, and check that Claude is using Exa and Parallel.

## 4. Check it works

Ask one of the questions in `docs/test-prompts.md` and confirm that:

- Claude loads the web-research skill,
- it calls Exa or Parallel tools (not built-in search),
- Exa searches include `textMaxCharacters: 1` and a `highlightsQuery`.
