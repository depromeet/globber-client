#!/bin/sh
# PreToolUse(Agent) 훅: 구현자 subagent를 isolation 없이 스폰하려는데 저장소가 dirty하면 차단한다 (docs/agent-rules/git-workflow.md).

input=$(cat)
subagent_type=$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)
isolation=$(printf '%s' "$input" | jq -r '.tool_input.isolation // empty' 2>/dev/null)

case "$subagent_type" in
  frontend-developer|qa-engineer|bug-fixer) ;;
  *) exit 0 ;;
esac

[ -n "$isolation" ] && exit 0

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  cat >&2 <<'EOF'
차단: 저장소에 미커밋 변경사항이 있는데 isolation 없이 구현자 subagent를
스폰하려 합니다 (docs/agent-rules/git-workflow.md).

이 훅은 tool_input(subagent_type, isolation)과 git status만 검사하며, 프롬프트에 적은
사유는 읽지 않습니다 - 통과하는 방법은 다음 두 가지뿐입니다:
- 다른 세션이 있으면 Agent(..., isolation: "worktree", name: ...)로 재시도
- 이 diff가 자신이 만든 것이라 무관함을 확인했으면, 먼저 커밋해서 저장소를 clean하게
  만든 뒤 재시도 (ListAgents로 다른 세션 여부도 함께 확인)
EOF
  exit 2
fi

exit 0
