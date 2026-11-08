#!/bin/sh
# Stop 훅: 마지막 응답의 마지막 문단에 대기 조건 없는 실행 서술(시작합니다 등)이 있으면 1회 차단
# 응답이 끝나면 그 실행은 일어나지 않으므로, 같은 응답에서 도구로 실행하거나 대기 조건을 밝히게 함
# 문구만 판정하고 이번 응답의 도구 호출 여부는 보지 않음
# stop_hook_active, subagent 응답은 통과

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

# 코드 블록, 인라인 코드, 인용문은 사용자 문장 인용일 수 있어 제외
text = re.sub(r"```.*?```", "", answer, flags=re.S)
text = re.sub(r"`[^`\n]*`", "", text)
text = "\n".join(l for l in text.splitlines() if not l.lstrip().startswith(">"))

paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
if not paragraphs:
    sys.exit(0)

declare = re.compile(r"(시작|진행|투입|실행|착수)(하겠습니다|합니다)")
# "하시면·주시면·끝나면"처럼 조건형 어미로 대기 조건을 밝힌 문장도 대기 조건으로 인정
wait = re.compile(r"뒤|후|오면|받으면|되면|전에는|전까지|기다|(하|주|시|나|끝나)면\s")

for sentence in re.split(r"(?<=[.!?])\s+|\n", paragraphs[-1]):
    if declare.search(sentence) and not wait.search(sentence):
        reason = ("실행을 예고만 하고 턴을 끝냄. 이번 응답에서 도구로 실행하거나, "
                  "막혀 있으면 무엇을 기다리는지 대기 조건을 명시할 것.")
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
        break
'
exit 0
