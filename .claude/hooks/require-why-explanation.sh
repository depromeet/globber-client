#!/bin/sh
# UserPromptSubmit 훅: 사용자 메시지에 "왜"가 포함되면, 원인 설명을 요구하는 중립적 리마인더를 컨텍스트에 추가
# 답변이 원인을 담았는지는 Stop의 judge-unverified-claims.sh가 LLM으로 판정함

input=$(cat)
prompt=$(printf '%s' "$input" | sh "$(dirname "$0")/user-prompt-text.sh")

case "$prompt" in
  *왜*)
    echo "'왜' 질문 감지: 답변에 실제 판단 근거/원인을 포함할 것(단순 사실 질문이면 해당 없음)."
    ;;
esac

exit 0
