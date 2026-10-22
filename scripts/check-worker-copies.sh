#!/bin/sh
# Each worker's rules live in agents/<worker>.md and are copied into its
# skills' references/worker.md (pasted into a general-purpose worker when the
# named agent isn't available). This checks the copies match.
# Usage: sh scripts/check-worker-copies.sh [--write]
cd "$(dirname "$0")/.." || exit 1
body() { sed -n '/^You are a \(search\|job research\) worker\./,$p' "$1"; }
status=0
for pair in search-worker:uni-search search-worker:better-search job-pick-worker:job-pick; do
  agent="agents/${pair%%:*}.md"; copy="skills/${pair#*:}/references/worker.md"
  if [ "$1" = "--write" ]; then
    body "$agent" > "$copy"
  elif ! body "$agent" | diff -q - "$copy" >/dev/null; then
    echo "Out of date: $copy (run with --write)"; status=1
  fi
done
[ $status -eq 0 ] && echo "Worker copies match."
exit $status
