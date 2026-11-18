#!/bin/sh
# PreToolUse(Edit|Write|NotebookEdit, 파일 쓰는 Bash) 훅(차단): 사용자가 요청하지 않은 메모리 저장을 막음
# 대상은 Claude 프로필의 projects/<프로젝트>/memory/ 아래 파일 쓰기, 읽기와 조회는 통과
# 통과: 가장 최근 사용자 메시지에 메모리 저장·갱신 요청 표현이 있음("메모리 업데이트해", "기억해" 등)
# 부정 표현("메모리에 저장하지 마")과 동사 없이 "기억"만 들어 있는 문장은 요청으로 보지 않음
# 작업 도중 들어온 사용자 메시지(queued_command)도 최근 사용자 메시지로 읽음
# transcript를 읽지 못하면 막지 않고 통과, subagent 호출은 대상에서 제외

input=$(cat)

printf '%s' "$input" | python3 -c '
import json, re, sys

BASH_WRITE = re.compile(r"\bsed\s+(-\w+\s+)*-i|(^|[^0-9&>])>>?\s*(?!&|/dev/null)[\w\"./$~-]|\btee\b|(^|[\s;&|(])(cp|mv|touch)\s")
MEMORY = re.compile(r"(^|/)projects/[^/]+/memory/")
REQUEST = re.compile(r"(메모리|기억|memory)[^\n.?!]{0,12}?(업데이트|저장|추가|갱신|기록|수정|삭제|정리|반영|update|save|add)|기억해|기억하|잊지\s*마|remember\s+(this|that|to)", re.I)
NEGATION = re.compile(r"^[^\n.?!]{0,8}?(하지\s*마|하지\s*말|말아|말고|안\s*해)")
MARKERS = ("<hook_prompt", "<system-reminder", "<task-notification", "<agent-message", "[Request interrupted")

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("hook_event_name") != "PreToolUse" or data.get("agent_id"):
    sys.exit(0)

args = data.get("tool_input") or {}

if data.get("tool_name") == "Bash":
    command = str(args.get("command") or "")
    touched = bool(BASH_WRITE.search(command) and MEMORY.search(command))
else:
    touched = bool(MEMORY.search(str(args.get("file_path") or args.get("notebook_path") or "")))

if not touched:
    sys.exit(0)

try:
    with open(data.get("transcript_path") or "", encoding="utf-8") as handle:
        entries = [json.loads(line) for line in handle if line.strip()]
except Exception:
    sys.exit(0)

def text_of(entry):
    if entry.get("type") == "attachment":
        attachment = entry.get("attachment") or {}
        return str(attachment.get("prompt") or "") if attachment.get("type") == "queued_command" else ""
    if entry.get("type") != "user" or entry.get("isMeta"):
        return ""
    answers = (entry.get("toolUseResult") or {}).get("answers")
    if isinstance(answers, dict):
        return "\n".join(str(value) for value in answers.values())
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    return "\n".join(part.get("text", "") for part in content or [] if isinstance(part, dict) and part.get("type") == "text")

latest = ""
for entry in reversed(entries):
    text = text_of(entry).strip()
    if text and not text.startswith(MARKERS):
        latest = text
        break

found = REQUEST.search(latest)
if found and not NEGATION.match(latest[found.end():]):
    sys.exit(0)

sys.stderr.write(
    "차단: 사용자가 요청하지 않은 메모리 저장입니다. 가장 최근 사용자 메시지에 메모리 저장·업데이트 요청이 없습니다.\n"
    "방침은 대화 안에서 지키고 작업 상태는 STATUS·HANDOFF에 적으세요. 저장이 필요하면 사용자에게 먼저 요청하세요.\n"
)
sys.exit(2)
'
