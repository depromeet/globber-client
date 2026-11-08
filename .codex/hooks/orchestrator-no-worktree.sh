#!/bin/sh
# PreToolUse(EnterWorktree) 훅: orchestrator(메인 세션) 자신이 EnterWorktree를 호출하는 것을 차단
#
# 표준 흐름에서는 이제 아무도 EnterWorktree를 직접 호출하지 않음 - 격리는 orchestrator가 `Agent(isolation: "worktree")` 파라미터로 스폰 시점에 지정하고, 구현자 subagent(T05/T06 등)는 그 안에서 작업할 뿐 EnterWorktree를 스스로 부르지 않음(관리형/child 세션에서는 그 자가 호출이 실패함.)
# 따라서 이 훅은 정상 흐름에서는 더 트리거되지 않으며, orchestrator가 실수로 또는 사고 복구 목적으로 EnterWorktree를 직접 부르는 경우에만 걸리는 보조 안전장치로 유지
#
# 구분 방법: hook 입력 JSON의 `agent_id` 필드는 subagent 내부에서 호출될 때만 존재함(main session에는 없음) - Claude Code 공식 문서 "Common input fields"
# agent_id가 없으면 이 호출은 main/orchestrator 세션이 직접 한 것이므로 차단

input=$(cat)
agent_id=$(printf '%s' "$input" | jq -r '.agent_id // empty' 2>/dev/null)

if [ -n "$agent_id" ]; then
  # subagent 내부 호출 - 표준 흐름에서는 발생하지 않아야 하지만(격리는 Agent isolation 파라미터로 스폰 시점에 이미 적용됨), 차단 대상은 main session 직접 호출뿐이므로 subagent 호출은 통과
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
