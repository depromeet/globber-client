#!/bin/sh
# lint-staged(pre-commit): staged된 src 소스에 em dash(—)가 있으면 커밋을 막는다 (docs/agent-rules/code-conventions.md)
root=$(git rev-parse --show-toplevel)
found=0
for f in "$@"; do
  hit=$(git show ":${f#"$root"/}" 2>/dev/null | grep -n '—' | head -3)
  [ -n "$hit" ] && { found=1; echo "  $f"; echo "$hit" | sed 's/^/    /'; }
done
[ "$found" -eq 0 ] && exit 0
echo "❌ em dash(—) 대신 하이픈(-)을 쓰세요."
exit 1
