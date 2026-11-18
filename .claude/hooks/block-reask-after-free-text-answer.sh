#!/bin/sh
# PreToolUse(Edit·Write·NotebookEdit·Agent·SendMessage·AskUserQuestion) 훅: 마지막 사용자 메시지 이후 AskUserQuestion 답변에 선택지 밖 직접 입력 질문이 있으면 같은 응답이 끝날 때까지 수정·위임·재질문 차단
# 답변 직후 질문 창이 뜨면 답변 텍스트가 가려지므로 텍스트로 답하고 응답 종료를 유도. Read·Grep·Bash는 답변 조사용으로 허용
# 질문 판정: 물음표, 의문형 어미(~까/나요/가요/니/냐/는지 등), 의문사(왜/뭐/무슨/어떻게 등). 지시형 직접 입력("~하도록 해")은 그대로 진행
# ponytail: 키워드 판정이라 '어느 쪽이든 해' 같은 지시도 질문으로 잡힘(차단 쪽 오탐). 놓친 질문이 질문 창에 가려지는 것보다 안전
# subagent 호출은 사용자 답변과 무관한 작업이라 제외
# 트랜스크립트 형식이 바뀌거나 읽을 수 없으면 차단하지 않음
# stop 인자 모드(Stop 훅): 같은 판정으로 차단이 풀려 있는데 마지막 응답이 "다음 메시지 후 질문 창으로 묻겠다"처럼 질문을 미루면 1회 차단

mode=${1:-pretool}
input=$(cat)
[ -z "$(printf '%s' "$input" | jq -r '.agent_id // empty' 2>/dev/null)" ] || exit 0
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)
[ -n "$transcript" ] && [ -r "$transcript" ] || exit 0

# jq -R은 4095바이트 넘는 줄에서 한글 등 멀티바이트 문자가 읽기 경계에 걸리면 깨뜨려 선택지 라벨 비교가 어긋나므로 JSON으로 직접 읽음
# 다른 세션·subagent 메시지(origin.kind == "peer")는 isMeta로 기록되지만 새 턴을 시작하므로 사용자 메시지처럼 초기화
question_re='[?？]|(까요?|나요|가요|니|냐|는지|은지|인지|던가)[[:space:].!~]*$|왜|뭐|뭔|무슨|무엇|어떻게|어디|언제|누가|누구|어느|몇'
free_text=$(jq -n --arg re "$question_re" '
  reduce (inputs | select(.type == "user" and ((.isMeta | not) or .origin.kind? == "peer"))) as $e (false;
    if ($e.message.content | type) == "string"
      or ([$e.message.content[]? | select(.type == "text")] | length > 0)
    then false
    elif ($e.toolUseResult | type) == "object" and ($e.toolUseResult.answers | type) == "object"
    then . or ([
      $e.toolUseResult.questions[]? as $q
      | ($e.toolUseResult.answers[$q.question] // "") as $a
      | select($a != "")
      | (if $q.multiSelect then ($a | split(", ")[]) else $a end) as $p
      | select(any($q.options[]?; .label == $p) | not)
      | select($p | test($re))
    ] | length > 0)
    else . end)
' "$transcript" 2>/dev/null)

if [ "$mode" = "stop" ]; then
  [ "$free_text" = "false" ] || exit 0
  printf '%s' "$input" | python3 -c '
import json, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("stop_hook_active") or data.get("agent_id"):
    sys.exit(0)

# 코드 블록, 인라인 코드, 인용문은 사용자 문장 인용일 수 있어 제외
text = re.sub(r"```.*?```", "", data.get("last_assistant_message") or "", flags=re.S)
text = re.sub(r"`[^`\n]*`", "", text)
text = "\n".join(l for l in text.splitlines() if not l.lstrip().startswith(">"))

if re.search(r"(다음|이후).{0,30}(메시지|메세지|턴).{0,40}(묻|여쭙|여쭤|질문)", text):
    reason = ("재질문 차단이 풀려 있음(마지막 사용자·팀원 메시지 이후 직접 입력 답변 없음). "
              "질문을 다음 메시지로 미루지 말고 이번 응답에서 AskUserQuestion으로 물을 것.")
    print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
'
  exit 0
fi

[ "$free_text" = "true" ] || exit 0

reason="직전 AskUserQuestion 답변에 사용자가 직접 입력한 질문이 있음. 그 질문에 텍스트로만 답하고 응답을 끝낼 것. 파일 수정·위임은 사용자의 다음 메시지 이후에 할 것. 이 응답에는 새 결정 질문을 텍스트로도 쓰지 말고, 다음 메시지 후 질문 창으로 묻겠다고만 적을 것. 사용자 또는 팀원 메시지가 오면 차단이 풀리므로, 그때는 미루지 말고 바로 질문 창으로 물을 것."
jq -n --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
