#!/bin/sh
# 프로젝트 전용 검사기가 있으면 우선하고, 없으면 함께 배포한 공용 검사기로 검사
project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
checker="$project_dir/scripts/check-comment-line-breaks.mjs"
[ -f "$checker" ] || checker="$(dirname "$0")/../../.harness/check-comment-line-breaks.mjs"
exec node "$checker" --hook
