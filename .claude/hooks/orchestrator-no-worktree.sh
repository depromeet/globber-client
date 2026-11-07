#!/bin/sh
# PreToolUse(EnterWorktree) 훅: orchestrator(메인 세션) 자신이 EnterWorktree를 호출하는 것을 차단
# orchestrator가 worktree에 들어가면 메인 체크아웃 병합·pull이 격리 sandbox에 막혀 빠져나올 수 없음
# 격리는 `Agent(isolation: "worktree")` 스폰으로 하므로 정상 흐름에서는 걸리지 않는 보조 안전장치
# `agent_id`는 subagent 내부 호출에만 있는 입력 필드라(Claude Code 공식 문서 "Common input fields") 없으면 메인 세션 호출로 판정

input=$(cat)
agent_id=$(printf '%s' "$input" | jq -r '.agent_id // empty' 2>/dev/null)

if [ -n "$agent_id" ]; then
  exit 0
fi

cat >&2 <<'EOF'
차단: orchestrator(메인 세션) 자신은 EnterWorktree를 호출하지 않는다
(docs/agent-rules/git-workflow.md). 격리가 필요하면 orchestrator는
`Agent(subagent_type: ..., isolation: "worktree", name: ...)`로 구현자
subagent를 스폰한다 - subagent도 EnterWorktree를 직접 호출하지 않는다.

정말 orchestrator 자신이 worktree에 들어가야 하는 예외 상황(예: 사고 복구)이면
사용자에게 사유를 보고하고 명시적 승인을 받은 뒤 진행한다.
EOF
exit 2
