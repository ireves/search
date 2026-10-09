#!/usr/bin/env python3
"""Print a Claude Code conversation log as a readable timeline, with each
worker's own log after it. Used by the search-report skill.

Usage: python3 timeline.py [LOG.jsonl] [--max N] [--full]
  LOG.jsonl  the conversation log; default: the newest one under ~/.claude/projects
  --max N    cut each tool result and text block to N characters (default 2000)
  --full     never cut anything
"""
import glob
import json
import os
import re
import sys

SECRET = re.compile(
    r"(sk-[A-Za-z0-9_-]{12,}|fc-[A-Za-z0-9]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}"
    r"|(?:api[_-]?key|token|secret)[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9._-]{12,})",
    re.I,
)
REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)


def clean(text, limit):
    text = SECRET.sub("[REDACTED]", REMINDER.sub("", text)).strip()
    if limit and len(text) > limit:
        text = text[:limit] + f"\n... [cut: {len(text) - limit} more characters]"
    return text


def as_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            p.get("text", "") if p.get("type") == "text" else f"[{p.get('type')}]"
            for p in content
            if isinstance(p, dict)
        )
    return json.dumps(content)


def read_log(path):
    entries = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return entries


def first_brief(entries):
    for e in entries:
        if e.get("type") == "user":
            return as_text(e.get("message", {}).get("content", ""))
    return ""


def print_log(entries, limit, indent=""):
    names = {}
    step = 0
    for e in entries:
        kind = e.get("type")
        msg = e.get("message")
        if kind not in ("user", "assistant") or not isinstance(msg, dict):
            continue
        time = (e.get("timestamp") or "")[11:19]
        content = msg.get("content")
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        for part in content or []:
            if not isinstance(part, dict):
                continue
            t = part.get("type")
            if kind == "user" and t == "text":
                text = clean(part.get("text", ""), limit)
                if text:
                    print(f"\n{indent}[{time}] USER\n{text}")
            elif t == "text":
                text = clean(part.get("text", ""), limit)
                if text:
                    print(f"\n{indent}[{time}] CLAUDE SAYS\n{text}")
            elif t == "thinking":
                text = clean(part.get("thinking", ""), limit)
                if text:
                    print(f"\n{indent}[{time}] CLAUDE THINKS\n{text}")
            elif t == "tool_use":
                step += 1
                names[part.get("id")] = (step, part.get("name"))
                args = clean(json.dumps(part.get("input", {}), ensure_ascii=False, indent=1), limit)
                model = msg.get("model", "")
                print(f"\n{indent}[{time}] CALL #{step} {part.get('name')} (model: {model})\n{args}")
            elif t == "tool_result":
                n, name = names.get(part.get("tool_use_id"), ("?", "?"))
                error = " ERROR" if part.get("is_error") else ""
                text = clean(as_text(part.get("content", "")), limit)
                print(f"\n{indent}[{time}] RESULT of #{n} {name}{error}\n{text}")
    return names


def main():
    args = sys.argv[1:]
    limit = 2000
    if "--full" in args:
        limit = 0
        args.remove("--full")
    if "--max" in args:
        i = args.index("--max")
        limit = int(args[i + 1])
        del args[i : i + 2]
    if args:
        path = args[0]
    else:
        logs = glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl"))
        if not logs:
            sys.exit("NO LOG FOUND")
        path = max(logs, key=os.path.getmtime)

    print(f"LOG: {path}")
    print("=" * 60, "\nMAIN CONVERSATION")
    calls = print_log(read_log(path), limit)

    workers = glob.glob(os.path.join(path[: -len(".jsonl")], "subagents", "*.jsonl"))
    logs = [(read_log(w), w) for w in workers]
    logs.sort(key=lambda x: next((e.get("timestamp", "") for e in x[0] if e.get("timestamp")), ""))
    if not logs:
        print("\n" + "=" * 60 + "\nNO WORKER LOGS FOUND")
    for i, (entries, w) in enumerate(logs, 1):
        meta = {}
        try:
            with open(w[: -len(".jsonl")] + ".meta.json", encoding="utf-8") as f:
                meta = json.load(f)
        except (OSError, json.JSONDecodeError):
            pass
        models = sorted({e["message"].get("model", "") for e in entries
                         if e.get("type") == "assistant" and isinstance(e.get("message"), dict)} - {""})
        print("\n" + "=" * 60)
        print(f"WORKER {i}: {os.path.basename(w)}")
        if meta:
            started = calls.get(meta.get("toolUseId"), ("?",))[0]
            print(f"started by: main CALL #{started}")
            print(f"details: {json.dumps(meta, ensure_ascii=False)}")
        print(f"models used: {', '.join(models) or 'not recorded'}")
        print(f"brief starts: {clean(first_brief(entries), 160)!r}")
        print_log(entries, limit, indent="  ")


if __name__ == "__main__":
    main()
