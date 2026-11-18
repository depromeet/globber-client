#!/bin/sh
# PreToolUse(TaskStop) 훅(확인): 이번 턴 사용자 메시지에 중단 표현이 없으면 실행 중 작업을 멈추기 전에 사용자 확인 창을 띄움
# 실행 중 작업을 사용자 지시 없이 멈추는 일을 막으려 둠
# worktree 분기 오류 복구처럼 orchestrator가 스스로 멈춰야 하는 경우(git-safety)가 있어 막지 않고 확인을 받음
# 사용자 메시지는 transcript의 이번 턴 시작 메시지와 작업 중 메시지에서 모으고, 붙여넣은 내용과 subagent 보고와 작업 알림은 뺌
# transcript를 읽지 못하면 근거가 없어 확인 창을 띄움
# Codex에는 대응하는 중단 도구가 없어 Claude판만 둠

input=$(cat)

printf '%s' "$input" | python3 -c '
import json, re, sys

STOP = re.compile(r"멈춰|멈추|중단|중지|취소|그만|끝내|종료|정지|\bstop\b|\bkill\b|\bcancel\b|\babort\b", re.I)
CONTINUE = re.compile(r"계속(?:\s*(?:해|진행|작업))|재개|이어(?:서|가)|\b(?:continue|resume)\b", re.I)
NEGATED_STOP = re.compile(r"\s*(?:하|추|내|시키)?지\s*(?:마|말|않)")
REASON = "이번 턴 사용자 메시지에 작업 중단 지시가 없습니다. 실행 중인 작업을 멈추는 이유를 확인하세요."

def ask():
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": REASON,
    }}, ensure_ascii=False))
    sys.exit(0)

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

def is_user_prompt(entry):
    if entry.get("type") != "user" or entry.get("isMeta"):
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and any(isinstance(c, dict) and c.get("type") == "text" for c in content) and not any(
        isinstance(c, dict) and c.get("type") == "tool_result" for c in content
    )

def text_of(content):
    if isinstance(content, list):
        content = "\n".join(c.get("text", "") for c in content if isinstance(c, dict))
    return str(content or "")

def user_text(text):
    for tag in ("agent-message", "pasted_content", "task-notification"):
        text = re.sub(r"<" + tag + r"\b.*?(</" + tag + r"[^>]*>|\Z)", "", text, flags=re.S)
    return text

try:
    with open(data.get("transcript_path") or "", encoding="utf-8") as transcript:
        entries = [json.loads(line) for line in transcript if line.strip()]
except Exception:
    ask()

start = None
for index, entry in enumerate(entries):
    if isinstance(entry, dict) and is_user_prompt(entry):
        start = index
if start is None:
    ask()

prompts = [user_text(text_of(entries[start]["message"].get("content")))]
for entry in entries[start + 1:]:
    attachment = (entry.get("attachment") or {}) if isinstance(entry, dict) else {}
    if attachment.get("type") == "queued_command" and attachment.get("prompt"):
        prompts.append(user_text(str(attachment["prompt"])))

stopping = False
for prompt in prompts:
    directives = [(m.start(), True) for m in STOP.finditer(prompt)
                  if not NEGATED_STOP.match(prompt[m.end():])
                  and not re.search(r"(?:do not|don.t|never)\s+$", prompt[:m.start()], re.I)]
    directives += [(m.start(), False) for m in CONTINUE.finditer(prompt)]
    if directives:
        stopping = max(directives)[1]
if not stopping:
    ask()
'

exit 0
