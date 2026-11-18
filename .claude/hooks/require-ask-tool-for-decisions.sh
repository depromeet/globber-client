#!/bin/sh
# Stop 훅: 이번 턴에 AskUserQuestion 답변을 받지 않았는데 마지막 응답에 결정 요청 질문이 텍스트로 있으면 1회 차단
# 질문 경로(질문 창 / 텍스트)만 판정
# 직전 답변의 직접 입력 여부 판정은 block-reask-after-free-text-answer.sh 단독 책임이라 여기서 다시 판정하지 않음
# 재질문 훅에 막힌 호출은 is_error 결과만 남고 answers가 없으므로, answers가 있는 결과만 질문 창 사용으로 셈
# stop_hook_active, 트랜스크립트 읽기 실패, subagent 응답은 통과

input=$(cat)

printf '%s' "$input" | python3 -c '
import json, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("stop_hook_active") or data.get("agent_id"):
    sys.exit(0)

answer = data.get("last_assistant_message") or ""
path = data.get("transcript_path")
if not answer or not path:
    sys.exit(0)

try:
    lines = open(path, encoding="utf-8").read().splitlines()
except Exception:
    sys.exit(0)

def is_user_prompt(entry):
    if entry.get("type") != "user":
        return False
    if entry.get("isMeta") and (entry.get("origin") or {}).get("kind") != "peer":
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and any(isinstance(c, dict) and c.get("type") == "text" for c in content)

asked = False
for line in lines:
    try:
        entry = json.loads(line)
    except Exception:
        continue
    if is_user_prompt(entry):
        asked = False
        continue
    result = entry.get("toolUseResult")
    if entry.get("type") == "user" and isinstance(result, dict) and isinstance(result.get("answers"), dict):
        asked = True

if asked:
    sys.exit(0)

# 코드 블록, 인라인 코드, 인용문은 사용자 문장 인용일 수 있어 제외
text = re.sub(r"```.*?```", "", answer, flags=re.S)
text = re.sub(r"`[^`\n]*`", "", text)
text = "\n".join(l for l in text.splitlines() if not l.lstrip().startswith(">"))

# 번호·이름·경로처럼 값을 입력받는 요청은 고를 선택지가 없어 결정 질문에서 뺌
text = re.sub(r"(번호|이름|브랜치명|경로|주소|값|ID|링크)(\s*\([^)]*\))?(을|를)\s?알려\s?주세요", "", text)
if not re.search(r"(정해|골라|선택해|답해|알려)\s?주세요|까요\s*\?", text):
    sys.exit(0)

reason = ("결정 요청 질문을 AskUserQuestion 없이 텍스트로 씀. 결정 질문은 AskUserQuestion으로 물을 것. "
          "직전 질문 창 답변에 직접 입력이 있어 재질문이 막힌 응답이면, 이 응답에서는 입력 내용에만 답하고 "
          "남은 결정은 다음 사용자 메시지 후 질문 창으로 묻겠다고만 적고 끝낼 것.")
print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
'
exit 0
