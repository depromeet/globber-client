#!/bin/sh
# commit-msg 훅: Claude/Codex 하네스 쌍 파일 중 한쪽만 staged된 커밋을 막는다.
# 쌍: .claude/agents/*.md <-> .codex/agents/*.toml, .claude/hooks/*.sh <-> .codex/hooks/*.sh,
#     .claude/skills/** <-> .agents/skills/** (같은 상대 경로)
# 한쪽만 바꾸는 게 맞으면 커밋 메시지에 `Harness-Sync: {사유}` 줄을 넣어 통과시킨다(사유가 이력에 남는다).
msg_file="$1"
staged=$(git diff --cached --name-only)
found=0

check_pair() {
  [ -f "$2" ] || return 0
  printf '%s\n' "$staged" | grep -qxF "$2" && return 0
  found=1
  echo "  $1 변경됨 -> 짝 $2 은(는) staged되지 않음"
}

for f in $staged; do
  case "$f" in
    .claude/agents/*.md) check_pair "$f" ".codex/agents/$(basename "$f" .md).toml" ;;
    .codex/agents/*.toml) check_pair "$f" ".claude/agents/$(basename "$f" .toml).md" ;;
    .claude/hooks/*.sh) check_pair "$f" ".codex/hooks/${f#.claude/hooks/}" ;;
    .codex/hooks/*.sh) check_pair "$f" ".claude/hooks/${f#.codex/hooks/}" ;;
    .claude/skills/*) check_pair "$f" ".agents/skills/${f#.claude/skills/}" ;;
    .agents/skills/*) check_pair "$f" ".claude/skills/${f#.agents/skills/}" ;;
  esac
done

[ "$found" -eq 0 ] && exit 0
[ -n "$msg_file" ] && grep -qE '^Harness-Sync: *[^ ]' "$msg_file" && exit 0

echo ""
echo "❌ Claude/Codex 하네스 파일은 쌍으로 관리합니다. 짝도 함께 수정해 staged하세요."
echo "   한쪽만 바꾸는 게 맞다면 커밋 메시지 끝에 사유 줄을 추가하세요: Harness-Sync: Codex만 - {사유}"
exit 1
