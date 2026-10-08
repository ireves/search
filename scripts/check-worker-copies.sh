#!/bin/sh
# The worker's rules live in agents/search-worker.md and are copied into each
# skill's references/worker.md (pasted into a general-purpose worker when the
# named agent isn't available). This checks the copies match.
# Usage: sh scripts/check-worker-copies.sh [--write]
cd "$(dirname "$0")/.." || exit 1
body() { sed -n '/^You are a search worker\./,$p' "$1"; }
status=0
for copy in skills/uni-search/references/worker.md skills/better-search/references/worker.md; do
  if [ "$1" = "--write" ]; then
    body agents/search-worker.md > "$copy"
  elif ! body agents/search-worker.md | diff -q - "$copy" >/dev/null; then
    echo "Out of date: $copy (run with --write)"; status=1
  fi
done
[ $status -eq 0 ] && echo "Worker copies match."
exit $status
