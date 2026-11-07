#!/bin/sh
# UserPromptSubmit·PreToolUse(Edit|Write|NotebookEdit) 훅: 판단·검토·보고 요청 턴의 파일 편집에 사용자 확인(ask) 요청
# Codex는 ask를 지원하지 않아 .codex/hooks/codex-tool-adapter.mjs가 deny로 바꿈
# UserPromptSubmit에서 보고 전용 상태를 session_id별 파일로 남기고, PreToolUse(Edit|Write|NotebookEdit)에서 그 상태를 확인
# Bash(sed, python, git 등)로 하는 수정은 명령 패턴이 너무 다양해 대상에서 제외하며, 이 부분은 메모리 규칙으로만 보완
# 실행 지시 판정은 키워드 기반이라 오탐·미탐이 있을 수 있어 차단 대신 확인(ask)만 요청

input=$(cat)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)
session=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -n "$session" ] || exit 0
state="${TMPDIR:-/tmp}/claude-report-only-$(printf '%s' "$session" | tr -c 'A-Za-z0-9_-' '_')"

if [ "$event" = "UserPromptSubmit" ]; then
  prompt=$(printf '%s' "$input" | sh "$(dirname "$0")/user-prompt-text.sh")
  # 사용자 문장이 없는 subagent 보고 전달이면 진행 중인 보고 전용 상태를 유지함
  [ -n "$(printf '%s' "$prompt" | tr -d '[:space:]')" ] || exit 0
  rm -f "$state"
  # 끝이 판단·검토·보고·제시인 요청만 대상으로 하고 실행 지시가 함께 있으면 제외
  printf '%s' "$prompt" | grep -qE '(판단|검토|분석|조사|확인)[^.?!]*(보고|알려)|청사진|보고해|보고만' || exit 0
  printf '%s' "$prompt" | grep -qE 'ㄱㄱ|진행해|고쳐|수정해|적용해|반영해|작업해|구현해|추가해|바꿔|변경해|삭제해|커밋해|강제해' && exit 0
  : > "$state"
  echo "보고 전용 요청 감지: 나열된 항목 전부를 판단해 보고만 할 것. 파일 수정·커밋·설정 변경은 사용자가 실행을 명시할 때만 하며, 이 턴의 Edit/Write는 사용자 확인을 거침."
  exit 0
fi

[ -f "$state" ] || exit 0
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)

# 보고서·메모리·임시 파일 작성은 보고 작업의 일부라 확인 없이 허용
# 메모리 위치는 CLAUDE_CONFIG_DIR에 따라 ~/.claude 밖(예: Orca 프로필)일 수 있어 projects/*/memory만 봄
case "$path" in
  */artifacts/*|*/projects/*/memory/*|/tmp/*|/private/tmp/*|"${TMPDIR:-/nonexistent}"*) exit 0 ;;
esac

reason="이번 요청은 판단·검토 후 보고로 보입니다(${path}). 실제로 수정을 원하셨다면 승인하세요."
jq -n --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
exit 0
