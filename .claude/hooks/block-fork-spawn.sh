#!/bin/sh
# PreToolUse(Agent) 훅: subagent_type "fork" 스폰을 차단

input=$(cat)
subagent_type=$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)

[ "$subagent_type" = "fork" ] || exit 0

cat >&2 <<'EOF'
차단: subagent_type "fork" 스폰이 훅으로 금지되어 있습니다.

대신:
- 직접 도구(Read/Grep/Bash/WebSearch 등)로 작업을 수행하세요.
- 정말 대규모 조사·구현이 필요하면 fork가 아닌 다른 subagent_type을 쓰거나,
  먼저 사용자에게 필요성을 설명하고 확인을 받으세요.
EOF
exit 2
