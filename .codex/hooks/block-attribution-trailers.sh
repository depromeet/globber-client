#!/bin/sh
# PreToolUse(Bash) 훅: git commit 명령에 Co-Authored-By·Claude-Session 트레일러가 섞여 있으면 차단
# .agents/skills/git-commit/SKILL.md 규칙을 대화 중 다짐이 아니라 기계적으로 강제하기 위해 도입
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

case "$cmd" in
  *"git commit"*)
    # 실제 트레일러 형식(줄 시작 + 콜론)만 차단
    # 커밋 메시지 본문에서 이 규칙을 "설명"하는 문장(콜론 없이 "Co-Authored-By 트레일러" 등)까지 막지 않기 위함
    if printf '%s' "$cmd" | grep -qiE '^[[:space:]]*Co-Authored-By[[:space:]]*:'; then
      echo "차단: 이 저장소 커밋에는 Co-Authored-By 트레일러를 넣지 않습니다 (.agents/skills/git-commit/SKILL.md). 커밋 메시지에서 해당 줄을 제거한 뒤 다시 시도하세요." >&2
      exit 2
    fi
    if printf '%s' "$cmd" | grep -qiE '^[[:space:]]*Claude-Session[[:space:]]*:'; then
      echo "차단: 이 저장소 커밋에는 Claude-Session 트레일러를 넣지 않습니다 (.agents/skills/git-commit/SKILL.md). 커밋 메시지에서 해당 줄을 제거한 뒤 다시 시도하세요." >&2
      exit 2
    fi
    ;;
esac
exit 0
