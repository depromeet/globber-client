#!/bin/sh
# PreToolUse(Bash) 훅: git commit 직전에 프로젝트 linter를 경고도 실패로 처리하는 옵션으로 실행해 경고·오류가 있으면 커밋 차단
# 프로젝트 lint 스크립트 설정과 무관하게 동작하도록 linter 설정 파일을 보고 명령과 옵션을 직접 정함
#   biome.json(c) -> 공용 Biome·빈 줄 검사 (--error-on-warnings)
#   eslint.config.* -> eslint --max-warnings=0
# ponytail: 위 두 linter의 저장소 루트 설정만 지원하고 다른 linter·하위 폴더 설정·eslintrc 구형 설정은 검사 없이 통과
# 사람이 터미널에서 직접 하는 커밋은 막지 못하므로 프로젝트 pre-commit 훅과 함께 사용

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# heredoc 본문과 따옴표 문자열 속 "git commit"을 명령으로 오인하지 않도록 지운 실행 구문
shell=$(printf '%s\n' "$cmd" | awk '
  in_doc { if ($0 ~ "^[ \t]*" delim "[ \t]*$") in_doc = 0; next }
  {
    print
    if (match($0, /<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
      d = substr($0, RSTART, RLENGTH)
      sub(/^<<-?[ \t]*["\047]?/, "", d); sub(/["\047]$/, "", d)
      delim = d; in_doc = 1
    }
  }' | tr '\n' '\036' | sed -e 's/"[^"]*"//g' -e "s/'[^']*'//g" | tr '\036' '\n')

printf '%s\n' "$shell" | grep -qE '(^|[;&|(][ 	]*)git([ 	]+-C[ 	]+[^ 	;&|]+)?[ 	]+commit\b' || exit 0

dir=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
cd "${dir:-.}" 2>/dev/null || exit 0
# 명령 안에서 cd 또는 git -C로 옮긴 경우 마지막 경로를 커밋 대상 저장소로 봄
target=$(printf '%s\n' "$shell" | grep -oE '(^|[;&|(][ 	]*)cd[ 	]+[^ 	;&|)]+|git[ 	]+-C[ 	]+[^ 	;&|)]+' | tail -1 | awk '{print $NF}')
case "$target" in "~"*) target="$HOME${target#\~}" ;; esac
[ -z "$target" ] || cd "$target" 2>/dev/null || exit 0
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

if [ -f biome.json ] || [ -f biome.jsonc ]; then
  [ -x node_modules/.bin/biome ] || exit 0
  if [ -f .harness/biome-check.mjs ]; then
    set -- node .harness/biome-check.mjs check --error-on-warnings --no-errors-on-unmatched --files-ignore-unknown=true
  else
    set -- node_modules/.bin/biome check --error-on-warnings --no-errors-on-unmatched --files-ignore-unknown=true
  fi
  pattern='.'
elif ls eslint.config.* >/dev/null 2>&1; then
  [ -x node_modules/.bin/eslint ] || exit 0
  set -- node_modules/.bin/eslint --max-warnings=0 --no-warn-ignored
  pattern='\.[cm]?[jt]sx?$'
else
  exit 0
fi

# 같은 명령의 git add·commit -a로 커밋될 파일까지 잡으려고 HEAD 대비 변경 파일과 추적하지 않는 파일을 모두 검사
# ponytail: 이번 커밋에 넣지 않는 작업 트리 변경도 작업 트리 내용 기준으로 검사함
files=$({
  git diff --name-only --diff-filter=ACMR HEAD 2>/dev/null || git diff --cached --name-only --diff-filter=ACMR
  git ls-files --others --exclude-standard
} | grep -E "$pattern" | sort -u)
[ -n "$files" ] || exit 0

if ! out=$(printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 "$@" 2>&1); then
  echo "차단: 변경 파일에 lint 경고 또는 오류가 있습니다. 경고까지 모두 고친 뒤 커밋하세요." >&2
  echo "실행한 명령: $* <변경 파일>" >&2
  printf '%s\n' "$out" | tail -40 >&2
  exit 2
fi

exit 0
