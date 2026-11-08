#!/bin/sh
# UserPromptSubmit 훅: 사용자 메시지에 "왜"가 포함되면, 원인 설명을 요구하는 중립적 리마인더를 컨텍스트에 추가
# Stop 입력에는 prompt가 없어, block-unverified-claims.sh가 원인 판정에 쓰도록 질문을 turn_id별로 저장함

input=$(cat)
prompt=$(printf '%s' "$input" | sh "$(dirname "$0")/user-prompt-text.sh")

case "$prompt" in
  *왜*)
    turn=$(printf '%s' "$input" | jq -j '.turn_id // empty' 2>/dev/null | tr -c 'A-Za-z0-9._-' '_')
    if [ -n "$turn" ]; then
      mark_dir="${TMPDIR:-/tmp}/codex-why-judge"
      mkdir -p "$mark_dir" && printf '%s' "$prompt" > "$mark_dir/$turn"
    fi
    echo "'왜' 질문 감지: 답변에 실제 판단 근거/원인을 포함할 것(단순 사실 질문이면 해당 없음)."
    ;;
esac

exit 0
