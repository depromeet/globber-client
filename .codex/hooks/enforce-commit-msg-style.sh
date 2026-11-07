#!/bin/sh
# PreToolUse(Bash) 훅: git commit 메시지가 .agents/skills/git-commit/SKILL.md의 기계적으로 검증 가능한 규칙을 지키는지 확인.
# 대화 중 다짐이 아니라 훅으로 강제하기 위해 도입
#
# 여기서 강제하는 것 (SKILL.md 중 grep/awk로 기계적으로 판정 가능한 항목만):
#   1. 종결어미 금지 - 요약 줄·bullet이 "~했다/~한다"류로 끝나면 안 되고 "~추가/~구현/~교체/~수정"류 명사형 필수
#   2. em-dash(—) 금지 - 하이픈(-)만 사용
#   3. 본문 임의 줄바꿈 금지 - bullet이든 평문 문단이든 한 항목은 한 줄로 작성(뷰어의 자동 줄바꿈에 맡김)
#      bullet 뒤 이어지는 줄뿐 아니라, bullet 없는 평문 문단이 여러 줄로 쪼개진 경우도 같은 문제로 함께 처리
#   4. bullet 사이 빈 줄 금지 - bullet마다 -m을 따로 주면 git이 빈 줄을 넣으므로 본문은 -m 하나로 작성
# 커밋 분리 기준·본문 생략 여부 같은 설계 판단은 훅으로 강제할 수 없어 제외

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# heredoc 본문을 셸 구문과 분리하는 함수 (shell: 본문을 뺀 실행 구문, msg: git commit 줄에서 열린 heredoc 본문)
# 같은 명령의 다른 heredoc(cat >> file <<'EOF' 등) 본문이 커밋 메시지나 커밋 감지에 섞이지 않게 하려는 목적
split_cmd() {
  printf '%s\n' "$cmd" | awk -v want="$1" '
    in_doc {
      if ($0 ~ "^[ \t]*" delim "[ \t]*$") { in_doc = 0; if (want == "shell") print; next }
      if (want == "msg" && is_commit) print
      next
    }
    {
      if (want == "shell") print
      if (match($0, /<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
        d = substr($0, RSTART, RLENGTH)
        sub(/^<<-?[ \t]*["\047]?/, "", d); sub(/["\047]$/, "", d)
        delim = d; in_doc = 1; is_commit = ($0 ~ /git[ \t]+commit/)
      }
    }'
}
shell=$(split_cmd shell)

# 문자열·heredoc 본문 속 "git commit"은 빼고 실행 구문에 git commit이 있을 때만 검사
printf '%s\n' "$shell" | grep -qE '(^|[;&|(][ 	]*)git[ 	]+commit\b' || exit 0

# 표준 패턴(-m "$(cat <<'EOF' ... EOF)")의 heredoc을 우선 사용
msg=$(split_cmd msg)
if [ -z "$msg" ]; then
  # git은 -m마다 문단을 나누므로 git commit 뒤 모든 -m 값을 빈 줄로 이어 실제 메시지와 같게 재구성
  # 따옴표 안 줄바꿈을 포함한 값까지 잡으려고 명령 전체를 한 번에 파싱
  msg=$(printf '%s' "$shell" | perl -0ne '
    s/^.*?\bgit\s+commit\b//s or exit;
    my @m; push @m, $1 while /-m\s+"((?:[^"\\]|\\.)*)"/sg;
    print join("\n\n", @m);
  ')
fi
[ -n "$msg" ] || exit 0

fail_reason=""

# 1) em-dash 금지
if printf '%s' "$msg" | grep -qF '—'; then
  fail_reason="em-dash(—)가 포함되어 있습니다. 하이픈(-)만 쓰세요."
fi

# 2) 본문 임의 줄바꿈 금지: 요약 줄(1번째 줄) 이후, 비어있지 않은 줄 바로 다음에 "- "로 시작하지 않는 비어있지 않은 줄이 오면 위반 - bullet 뒤 이어지는 줄이든, bullet 없는 평문 문단이 쪼개진 것이든 동일하게 검출
#    (heredoc 추출 단계에서 이미 EOF 등 종료 토큰은 제거된 $msg 만 검사)
if [ -z "$fail_reason" ]; then
  hit=$(printf '%s\n' "$msg" | awk '
    function is_blank(s,   t) { t = s; gsub(/^[ \t]+|[ \t]+$/, "", t); return (t == "") }
    # git 트레일러(Harness-Scope: sync 등)는 연달아 써야 마지막 문단에서 함께 인식되므로 키: 값 줄끼리는 예외
    function is_trailer(s) { return s ~ /^[A-Za-z][A-Za-z0-9-]*: / }
    NR == 1 { prev = $0; next }
    {
      if (!is_blank(prev) && !is_blank($0) && $0 !~ /^[ \t]*-[ \t]/ && !(is_trailer(prev) && is_trailer($0))) {
        print $0
        exit
      }
      prev = $0
    }
  ')
  if [ -n "$hit" ]; then
    fail_reason="본문이 여러 줄로 임의 줄바꿈된 것으로 보입니다. 이어지는 줄: \"$hit\" (뷰어가 알아서 줄바꿈합니다 - bullet이든 평문 문단이든 한 항목은 한 줄로 쓰세요)"
  fi
fi

# 3) bullet 사이 빈 줄 금지: bullet마다 -m을 따로 주면 git이 빈 줄을 끼워 넣어 목록이 문단으로 흩어짐
if [ -z "$fail_reason" ]; then
  hit=$(printf '%s\n' "$msg" | awk '
    /^[ \t]*-[ \t]/ { if (gap && seen) { print $0; exit } seen = 1; gap = 0; next }
    /^[ \t]*$/ { gap = 1; next }
    { seen = 0; gap = 0 }
  ')
  if [ -n "$hit" ]; then
    fail_reason="bullet 사이에 빈 줄이 있습니다: \"$hit\" (bullet마다 -m을 따로 주지 말고 본문 전체를 -m 하나에 줄바꿈으로 이어 쓰세요)"
  fi
fi

# 4) 종결어미 금지: 요약 줄(첫 줄)과 각 bullet 줄이 "~다" 류 종결형으로 끝나면 안 됨
if [ -z "$fail_reason" ]; then
  summary=$(printf '%s\n' "$msg" | head -1)
  bullets=$(printf '%s\n' "$msg" | grep -E '^[ \t]*-[ \t]')
  hit=$(printf '%s\n%s\n' "$summary" "$bullets" | grep -E '다[.!]?[ \t]*$' | head -1)
  if [ -n "$hit" ]; then
    fail_reason="완결형 어미로 끝나는 줄이 있습니다: \"$hit\" (예: ~했다/~한다 대신 ~추가/~구현/~수정 같은 명사형으로 쓰세요)"
  fi
fi

if [ -n "$fail_reason" ]; then
  echo "차단: 커밋 메시지가 .agents/skills/git-commit/SKILL.md 규칙을 위반합니다." >&2
  echo "→ $fail_reason" >&2
  exit 2
fi

exit 0
