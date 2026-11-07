#!/bin/sh
# PreToolUse(Edit|Write) 훅: artifacts/task-team/{run id}/code-review-*.md 저장 시 CodeRabbit 교차검토 누락 차단.
# - Write: `## CodeRabbit 교차검토` 섹션이 없으면 차단
# - 섹션에 "미실행"이 있으면 아래 둘 중 하나일 때만 통과
#   1) 파일 번호가 2 이상인 재작업 재리뷰(code-review-{n}.md, n >= 2, "사이클 전체 최종 리뷰" 제외)
#   2) 실행 실패 사유(타임아웃, 미인증, 네트워크, 오류 등)를 함께 기록

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$file_path" in
  */artifacts/task-team/code-review-*.md|artifacts/task-team/code-review-*.md|*/artifacts/task-team/*/code-review-*.md|artifacts/task-team/*/code-review-*.md) ;;
  *) exit 0 ;;
esac

if [ "$tool_name" = "Write" ]; then
  content=$(printf '%s' "$input" | jq -r '.tool_input.content // empty' 2>/dev/null)
elif [ "$tool_name" = "Edit" ]; then
  content=$(printf '%s' "$input" | jq -r '.tool_input.new_string // empty' 2>/dev/null)
else
  exit 0
fi

deny() {
  echo "차단: $file_path - $1 (.claude/agents/code-reviewer.md CodeRabbit 교차검토 절차)" >&2
  exit 2
}

if [ "$tool_name" = "Write" ] && ! printf '%s' "$content" | grep -q '^## CodeRabbit 교차검토'; then
  deny "'## CodeRabbit 교차검토' 섹션이 없습니다. coderabbit review를 실행하고 결과 섹션을 포함하세요."
fi

printf '%s' "$content" | grep -q '미실행' || exit 0

review_no=$(basename "$file_path" .md | sed -n 's/^code-review-\([0-9][0-9]*\)$/\1/p')
is_final=0
printf '%s' "$content" | grep -q '사이클 전체 최종 리뷰' && is_final=1
if [ "$is_final" = 0 ] && [ -n "$review_no" ] && [ "$review_no" -ge 2 ]; then
  exit 0
fi

if printf '%s' "$content" | grep -qiE '타임아웃|timeout|미인증|인증 실패|unauthenticated|not authenticated|네트워크|network|실행 오류|실행 실패|exit code|rate limit|한도'; then
  exit 0
fi

deny "CodeRabbit을 '미실행'으로 기록했지만 허용된 사유가 아닙니다. 생략은 재작업 재리뷰(code-review-{n}.md, n >= 2, 사이클 전체 최종 리뷰 제외)이거나 실행 실패(사유 명시)일 때만 가능합니다. 'coderabbit review --agent'를 실행하세요."
