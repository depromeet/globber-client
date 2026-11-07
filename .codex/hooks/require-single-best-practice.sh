#!/bin/sh
# UserPromptSubmit 훅: 사용자 메시지에 best practice 키워드가 있으면 권장안 하나만 답하라는 조건부 리마인더를 컨텍스트에 추가
# 질문인지 여부는 셸 패턴으로 판정 불가 - 키워드로 1차 필터 후 판단은 응답 모델에 위임, 준수 여부는 사후 검증 불가

input=$(cat)
prompt=$(printf '%s' "$input" | sh "$(dirname "$0")/user-prompt-text.sh")

if printf '%s' "$prompt" | grep -qiE 'best[ _-]?practice|베스트[ ]?프랙티스'; then
  echo "best practice 키워드 감지: 사용자가 best practice가 무엇인지 묻는 질문이면 권장안 하나를 첫 문장에 단정적으로 답하고, 이유는 짧게만 덧붙일 것. 찬반 의견 나열·출처별 견해 비교·선택지 제시 금지. 키워드를 언급만 한 메시지(규칙·훅 요청 등)면 해당 없음."
fi

exit 0
