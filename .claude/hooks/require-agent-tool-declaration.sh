#!/bin/sh
# PreToolUse(Agent) 훅: 스폰 지시문에 `필요 도구:` 선언이 없거나, 선언한 도구가 대상 에이전트 정의의 tools에 없으면 차단, 통과하면 선언 줄을 지운 지시문으로 실행
# 사용법: 지시문에 `필요 도구: Read, Edit, Bash` 한 줄을 넣음, 도구가 필요 없으면 `필요 도구: 없음`
# 지시문 자연어에서 필요 도구를 추정하면 오탐·누락이 생겨, 작성자가 선언하고 훅은 정의 파일과 대조만 함
# 선언에서 필요한 도구를 빠뜨린 경우는 잡지 못함, 단 기존 파일 수정에 Edit를 빠뜨린 경우는 `수정 파일:` 줄로 잡음
# `수정 파일: 경로, 경로`에 이미 있는 파일이 있으면 Edit 선언을 요구함(Write로 통째 재작성하는 우회 방지), 고칠 파일이 없으면 `수정 파일: 없음`
# Edit 없이 Write를 선언하면 `수정 파일:` 줄을 요구함, 줄이 빠지면 같은 구멍이 남기 때문
# 선언은 orchestrator의 확인 기록이라 subagent에 넘기지 않음, 통과하면 updatedInput으로 그 줄을 지움
# updatedInput은 allow와 함께 써야 하며, ask는 스폰마다 의미 없는 확인 창을 띄워 쓰지 않음
# allow를 돌려줘도 사용자 설정의 deny·ask 권한 규칙과 다른 훅의 deny는 그대로 우선함

input=$(cat)

printf '%s' "$input" | PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}" AGENTS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/agents" python3 -c '
import json, os, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    # 입력을 해석할 수 없으면 판정 근거가 없어 통과
    sys.exit(0)

tool_input = data.get("tool_input") or {}
agent = tool_input.get("subagent_type") or "general-purpose"
prompt = tool_input.get("prompt") or ""

# fork 스폰은 block-fork-spawn.sh가 따로 차단함
if agent == "fork":
    sys.exit(0)

declaration = re.search(r"^\W*필요 도구\s*:\s*(.+)$", prompt, re.M)
if not declaration:
    sys.stderr.write(
        "차단: 스폰 지시문에 `필요 도구:` 선언이 없습니다.\n"
        "지시에 필요한 도구를 에이전트 목록의 Tools와 대조한 뒤 한 줄로 선언하세요.\n"
        "예: 필요 도구: Read, Edit, Bash (도구가 필요 없으면 `필요 도구: 없음`)\n"
    )
    sys.exit(2)

def allow_without_declaration():
    # 선언 줄과 그 줄바꿈을 지우고, 맨 앞에 남는 빈 줄도 지움
    stripped = prompt[:declaration.start()] + prompt[declaration.end():].removeprefix("\n")
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "updatedInput": {**tool_input, "prompt": stripped.lstrip("\n")},
        },
    }, ensure_ascii=False))
    sys.exit(0)

declared = [name for name in re.split(r"[\s,]+", declaration.group(1)) if name]
if declared == ["없음"]:
    allow_without_declaration()

targets_line = re.search(r"^\W*수정 파일\s*:\s*(.+)$", prompt, re.M)
targets = [t.strip() for t in targets_line.group(1).split(",") if t.strip()] if targets_line else []
if "Write" in declared and "Edit" not in declared and not targets:
    sys.stderr.write(
        "차단: Edit 없이 Write를 선언했는데 `수정 파일:` 줄이 없습니다.\n"
        "기존 파일을 고치면 `수정 파일: 경로`를 적고 Edit를 선언하세요. 새 파일만 만들면 `수정 파일: 없음`을 적으세요.\n"
    )
    sys.exit(2)
existing = [t for t in targets if t != "없음" and os.path.isfile(os.path.join(os.environ["PROJECT_DIR"], t))]
if existing and "Edit" not in declared:
    sys.stderr.write(
        "차단: 이미 있는 파일을 수정하는데 Edit를 선언하지 않았습니다: " + ", ".join(existing) + "\n"
        "Edit를 선언하세요. 대상 에이전트에 Edit가 없으면 Write 통째 재작성으로 대신하지 말고 사용자에게 보고하세요.\n"
    )
    sys.exit(2)

# 에이전트 이름이 경로 조작에 쓰이지 않도록 파일명 문자만 허용
if not re.fullmatch(r"[\w.-]+", agent):
    allow_without_declaration()

try:
    definition = open(os.path.join(os.environ["AGENTS_DIR"], agent + ".md"), encoding="utf-8").read()
except OSError:
    # 정의 파일이 없는 내장 타입(general-purpose 등)은 대조 기준이 없어 선언 유무만 확인함
    allow_without_declaration()

frontmatter = re.match(r"---\n(.*?)\n---", definition, re.S)
tools = re.search(r"^tools:\s*(.*)$", frontmatter.group(1), re.M) if frontmatter else None
if not tools:
    # tools를 생략한 정의는 모든 도구를 상속함
    allow_without_declaration()

allowed = [name.strip() for name in tools.group(1).split(",") if name.strip()]
missing = [name for name in declared if name not in allowed]
if missing:
    sys.stderr.write(
        "차단: " + agent + " 에이전트에 없는 도구를 선언했습니다: " + ", ".join(missing) + "\n"
        + agent + " tools: " + ", ".join(allowed) + "\n"
        "이 도구가 있는 에이전트로 스폰하거나, 사용자에게 보고하고 대안을 정하세요.\n"
    )
    sys.exit(2)

allow_without_declaration()
'
