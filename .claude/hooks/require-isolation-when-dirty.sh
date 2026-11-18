#!/bin/sh
# PreToolUse(Agent) 훅: 파일을 고칠 수 있는 subagent는 worktree 격리로만 스폰하고, 메인 작업 트리가 dirty하면 격리 스폰도 차단 (docs/agent-rules/git-workflow.md)
# 격리 worktree는 커밋된 HEAD에서 만들어져(worktree.baseRef "head") 미커밋 변경이 빠지므로, 스폰 전에 사용자 승인을 받아 미커밋 변경을 정리하게 함
# 쓰기 가능 판단: 프로젝트 Agent 정의의 tools에 Edit·Write·NotebookEdit·Bash가 있거나 tools가 없으면(전체 상속) 쓰기 가능
# 정의 파일이 없는 내장 에이전트는 읽기 전용으로 알려진 이름만 제외하고 쓰기 가능으로 봄
# subagent worktree 위치(.claude/worktrees/)는 다른 subagent가 남긴 작업이라 dirty 판단에서 제외

input=$(cat)

printf '%s' "$input" | AGENTS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/agents" python3 -c '
import json, os, re, subprocess, sys

READ_ONLY_BUILTINS = {"Explore", "Plan", "claude-code-guide", "web-fetch"}
WRITE_TOOLS = {"Edit", "Write", "NotebookEdit", "Bash"}

try:
    tool_input = json.load(sys.stdin).get("tool_input") or {}
except Exception:
    # 입력을 해석할 수 없으면 판정 근거가 없어 통과
    sys.exit(0)

agent = tool_input.get("subagent_type") or "general-purpose"
definition = os.path.join(os.environ["AGENTS_DIR"], agent + ".md")

if os.path.isfile(definition):
    with open(definition, encoding="utf-8") as handle:
        tools = re.search(r"^tools:\s*(.+)$", handle.read(), re.M)
    can_write = not tools or bool(WRITE_TOOLS & {t.strip() for t in tools.group(1).split(",")})
else:
    can_write = agent not in READ_ONLY_BUILTINS

if not can_write:
    sys.exit(0)

if tool_input.get("isolation") != "worktree":
    sys.stderr.write(
        f"차단: 파일을 고칠 수 있는 subagent({agent})는 isolation 없이 스폰할 수 없습니다 (docs/agent-rules/git-workflow.md).\n"
        "Agent(..., isolation: \"worktree\")로 다시 스폰하세요. 결과 회수 절차도 같은 문서를 따릅니다.\n"
    )
    sys.exit(2)

# 미추적 폴더가 통째로 한 줄로 접히면 worktree 경로를 가려낼 수 없어 파일 단위(-uall)로 나열
status = subprocess.run(["git", "status", "--porcelain=v1", "-z", "-uall"], capture_output=True)
if status.returncode:
    sys.stderr.write("차단: git status 실패. 작업 트리 상태를 확인한 뒤 다시 시도하세요.\n")
    sys.stderr.write(status.stderr.decode(errors="replace"))
    sys.exit(2)
paths = iter(status.stdout.rstrip(b"\0").split(b"\0"))
dirty = False
for item in filter(None, paths):
    names = [item[3:]]
    if b"R" in item[:2] or b"C" in item[:2]:
        names.append(next(paths))
    dirty |= any(not name.startswith(b".claude/worktrees/") for name in names)
if dirty:
    sys.stderr.write(
        "차단: 메인 작업 트리에 미커밋 변경이 있습니다. 격리 worktree는 커밋된 HEAD에서 만들어져\n"
        "이 변경을 볼 수 없습니다 (docs/agent-rules/git-workflow.md).\n"
        "- 자신의 작업 변경이면: git-commit 스킬 기준으로 신규 커밋 또는 amend의 범위를 AskUserQuestion으로 요청하고 사용자 승인 후 진행\n"
        "- 자신이 만들지 않은 변경이면: 커밋하지 말고 사용자에게 보고\n"
        "- 커밋 승인이 필요한 상황에서 사용자에게 요청하지 않고 계획을 바꾸지 말 것(스폰 대신 직접 수행하는 우회 금지)\n"
    )
    sys.exit(2)
'
