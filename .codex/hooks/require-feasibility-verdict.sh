#!/bin/sh
# UserPromptSubmit·PostToolUse·Stop 훅: 확인 질문에는 네/아니요(확인할 수 없습니다), 가능 여부 질문에는 가능합니다/불가능합니다로 이번 턴 첫 응답을 시작하게 함
# UserPromptSubmit(안내): 가능 여부 키워드가 있으면 조건부 리마인더를 출력하고, 의문형까지 갖춘 질문이면 세션별 표시 파일에 후보 문장을 남김
# PostToolUse(안내): 표시 파일이 있는 턴의 도구 결과마다 첫 응답 판정 규칙과 분할 판정 금지를 다시 붙임
# Stop(차단): 표시 파일이 있는 세션에서 이번 턴 첫 응답이 판정으로 시작하지 않으면 턴 종료를 막고 다시 답하게 함(첫 응답을 못 찾으면 마지막 응답으로 판정)
# 질문 여부는 UserPromptSubmit의 prompt로 판정하고, Stop은 transcript에서 이번 턴 첫 응답만 읽음
# transcript 형식은 안정 인터페이스가 아니라서 읽지 못하면 마지막 응답으로 판정함
# 키워드·의문형 패턴은 후보만 고르고, 차단 직전에 LLM이 실제 가능 여부 질문인지 다시 판정함
# 판정은 Claude가 haiku, Codex가 gpt-6-luna(effort medium)를 쓰고, 판정 실패·타임아웃·해석 불가는 작업을 막지 않도록 통과시킴
# 판정 호출은 hooks를 끄고 환경변수로도 재귀를 막음
# Claude와 Codex가 같은 본문을 쓰고, 판정 CLI는 스크립트 위치로 고름

[ -n "${HARNESS_STOP_JUDGE:-}" ] && exit 0

case "$0" in
  *.codex/*) judge_tool=codex ;;
  *) judge_tool=claude ;;
esac

input=$(cat)

printf '%s' "$input" | JUDGE_TOOL="$judge_tool" MARK_DIR="${TMPDIR:-/tmp}/feasibility-verdict" python3 -c '
import json, os, re, stat, subprocess, sys, tempfile

JUDGE_TIMEOUT_SECONDS = 60

try:
    data = json.load(sys.stdin)
except Exception:
    # 입력을 해석할 수 없으면 판정 근거가 없어 통과
    sys.exit(0)

session = re.sub(r"[^\w.-]", "_", str(data.get("session_id") or "default"))
turn = str(data.get("turn_id") or "")
mark = os.path.join(os.environ["MARK_DIR"], session)

def clear_mark():
    try:
        os.remove(mark)
    except OSError:
        # 표시가 없으면 지울 것도 없음
        pass

event = data.get("hook_event_name")

def current_request():
    try:
        with open(mark, encoding="utf-8") as candidates:
            request = json.loads(candidates.read().splitlines()[-1])
        return request if not turn or request.get("turn") == turn else None
    except (OSError, ValueError, IndexError, TypeError):
        return None

if event == "PostToolUse":
    if current_request():
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "질문 형식을 구분하세요. 판정은 이번 턴 첫 응답의 첫 문장에 둡니다. 확인 질문이면 네. 또는 아니요.(근거가 없으면 확인할 수 없습니다.), 가능 여부 질문이면 가능합니다. 또는 불가능합니다.입니다. 이후 응답에서 범위가 나뉜다, 일부만 된다처럼 판정을 다시 쪼개지 말고, 단서는 판정을 유지한 조건으로만 덧붙일 것.",
        }}, ensure_ascii=False))
    sys.exit(0)

if event != "Stop":
    # 자동 에이전트 보고는 사용자 질문에서 제외함
    # 붙여넣은 인용 자료는 사용자 질문에서 제외함
    prompt = re.sub(r"<agent-message\b.*?(</agent-message>|\Z)", "", data.get("prompt") or "", flags=re.S)
    prompt = re.sub(r"<pasted_content id=\"([^\"]*)\">.*?(</pasted_content id=\"\1\">|\Z)", "", prompt, flags=re.S)
    if not prompt.strip() or re.fullmatch(r"\s*Another Claude session sent a message[^\n]*\s*", prompt):
        # 사용자 문장이 없는 보고 전달이면 진행 중인 질문의 표시를 지우지 않고 그대로 둠
        sys.exit(0)
    confirmation_ending = re.search(r"(?:맞지|맞나요|맞습니까|아님|아니냐|아닌가요|했지|했나요|했습니까|됐지|됐나요|됐습니까|끝났지|끝났나요|끝났습니까)[.!?]?\s*$", prompt)
    # 직접 이유 질문은 앞선 확인 질문의 답변 형식을 이어받지 않음
    if re.match(r"\s*(?:(?:근데|그런데|그래서)\s*)?(?:왜|어째서)", prompt) and not confirmation_ending:
        clear_mark()
        sys.exit(0)
    keyword = re.search(r"가능|할 수 있|될 수 있|될까|되나|되냐|possible|feasible", prompt, re.I)
    # 키워드만 있는 작업 지시("가능하다로 대답해")는 질문이 아니므로 의문형까지 있어야 표시함
    question = re.search(
        r"\?|가능(성|\s?여부)[^.?!\n]*(검토|확인|판단|보고|알려)|가능(한지|할까|해|합니까|한가|하냐|하니|함)|(할|될) 수 있(는지|어|나|을까|니|냐|습니까)|될까|되나|되냐|되는지",
        prompt,
    )
    confirmation = bool(confirmation_ending or re.search(r"\?", prompt))
    feasibility = bool(keyword and question and not confirmation_ending)
    if keyword and not confirmation_ending:
        print("가능 여부 키워드 감지: 사용자가 가능한지 묻는 질문이면 이번 턴 첫 응답을 가능합니다. 또는 불가능합니다.로 시작할 것. 도구 확인보다 판정을 먼저 쓰고, 일부만 가능하다는 분할 판정, 진행 안내 문장, 얼버무림, 비교표로 시작 금지. 단서와 범위는 둘째 문장부터. 키워드를 언급만 한 메시지(작업 지시 등)면 해당 없음.")
    elif confirmation:
        print("확인 질문이면 이번 턴 첫 응답을 네. 또는 아니요.(마침표 포함)로 시작하고 근거·진행 상황은 뒤에 설명하세요. 도구 확인보다 판정을 먼저 쓰고, 판단 근거가 없으면 확인할 수 없습니다.로 답하세요.")
    # 새 사용자 턴의 표시만 사용한다. turn_id가 없는 Claude는 새 실제 프롬프트에서 갱신한다.
    if not turn or not current_request():
        clear_mark()
    if feasibility or confirmation:
        mark_dir = os.environ["MARK_DIR"]
        os.makedirs(mark_dir, mode=0o700, exist_ok=True)
        directory = os.lstat(mark_dir)
        if not stat.S_ISDIR(directory.st_mode) or directory.st_uid != os.getuid():
            sys.exit(0)
        os.chmod(mark_dir, 0o700)

        fd = os.open(mark, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
        file_info = os.fstat(fd)
        if not stat.S_ISREG(file_info.st_mode) or file_info.st_uid != os.getuid():
            os.close(fd)
            sys.exit(0)
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "a", encoding="utf-8") as candidates:
            candidates.write(json.dumps({"kind": "feasibility" if feasibility else "confirmation", "prompt": prompt.strip(), "turn": turn}, ensure_ascii=False) + "\n")
    sys.exit(0)

if not os.path.exists(mark):
    sys.exit(0)

answer = (data.get("last_assistant_message") or "").strip()
# 이미 한 번 막힌 뒤의 재응답이면 무한 반복을 막으려고 통과
if data.get("stop_hook_active") or not answer:
    clear_mark()
    sys.exit(0)

try:
    request = current_request()
    confirmation = request["kind"] == "confirmation"
    user_prompt = request["prompt"]
except (OSError, ValueError, IndexError, KeyError, TypeError, AttributeError):
    clear_mark()
    sys.exit(0)

# 판정 대상은 사용자 질문 직후 이번 턴의 첫 텍스트 블록
# 중간 블록까지 후보로 넓히면 다른 대상에 한 "네"나 진행 안내가 판정으로 인정돼 미탐이 생기므로 첫 블록 하나로 고정함
# Claude와 Codex transcript를 같은 방식으로 해석하고, 첫 블록을 찾지 못하면 마지막 응답으로 판정함
first_text = None
try:
    entries = [json.loads(line) for line in open(data.get("transcript_path") or "", encoding="utf-8") if line.strip()]
except Exception:
    entries = []
for entry in entries:
    if not isinstance(entry, dict) or entry.get("isMeta"):
        continue
    payload = entry.get("payload") or {}
    role = payload.get("role") or entry.get("type")
    content = payload.get("content") if payload.get("role") else (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        content = [{"type": "text", "text": content}]
    texts = [part.get("text", "") for part in content or []
             if isinstance(part, dict) and part.get("type") in ("text", "input_text", "output_text")]
    if role == "user":
        # 도구 결과만 담긴 user 항목과 훅·내부 문맥은 턴 경계가 아님
        text = "\n".join(texts)
        if text.strip() and not text.lstrip().startswith(("<hook_prompt", "<codex_internal_context", "<agent-message")):
            first_text = None
    elif role == "assistant" and first_text is None:
        first_text = next((text for text in texts if text.strip()), None)

# 제목·강조·인용 기호를 걷어낸 뒤 첫머리가 판정인지 봄
# 확인·가능 여부의 판정어는 지정된 두 값으로 제한함
# 첫 블록과 마지막 응답이 같은 정규식을 써서 판정 기준이 둘로 갈리지 않게 함
# "네, 맞습니다"까지 막는 마침표 강제 대신, 판정어 바로 뒤의 진행 안내("네, 확인해 보겠습니다")만 판정에서 뺌
last_body = re.sub(r"^[\s#*>-]+", "", answer)
body = re.sub(r"^[\s#*>-]+", "", first_text.strip()) if first_text is not None else last_body
verdict = (re.match(r"(?:네|아니요|확인할 수 없습니다)(?=[\s,.!?*]|$)", body)
           if confirmation else re.match(r"(불)?가능합니다", body))
if verdict and re.match(r"[\s,.!]*(?:확인해 보겠|살펴보겠|진행하겠|알겠습니다)", body[verdict.end():]):
    verdict = None
first_len = len(body)
# 첫 블록에서 판정하고 마지막 응답에서 판정을 뒤집을 수 있어 마지막 응답을 붙여 분할 검사함
if verdict and first_text is not None and last_body and last_body != body:
    body += "\n\n" + last_body
# 첫머리 판정 뒤에서 범위를 나누거나 일부만 된다고 다시 쪼개면 분할 판정이라, 후보 표현이 있을 때만 판정기에 함께 물음
# 앞쪽 후보와 별개로 마지막 응답의 분할 표현과 반대 판정도 확인함
if verdict and not confirmation:
    opposing = r"(?<!불)가능(?:하지만|합니다)" if verdict.group(1) else r"불가능(?:하지만|합니다)"
    divided = r"나뉩니다|나뉜다|나뉘어|나눠집니다|일부(?:만|는)[^.!?\n]{0,20}(?:가능|됩니|된다|할 수)|부분적으로|경우에 따라|항목마다 다르|항목별로 다르"
    candidates = [re.search(divided + "|" + opposing, body[verdict.end():first_len]),
                  re.search(divided + "|" + opposing, body[first_len:]),
                  re.search(opposing, body[verdict.end():])]
    offsets = (verdict.end(), first_len, verdict.end())
    spans = sorted({(offset + match.start(), offset + match.end())
                    for match, offset in zip(candidates, offsets) if match})
else:
    spans = []
split_candidate = bool(spans)
if verdict and not split_candidate:
    clear_mark()
    sys.exit(0)
if verdict:
    problem = "첫머리 판정 뒤에서 범위를 나누거나 일부만 된다고 해 판정을 다시 쪼갰습니다."
else:
    problem = ("이번 턴 첫 응답이 네. 또는 아니요.로 시작하지 않습니다." if confirmation
               else "이번 턴 첫 응답이 가능합니다. 또는 불가능합니다.로 시작하지 않습니다.")

judge_prompt = f"""아래 [사용자 메시지]에 사용자가 어떤 일이 가능한지(할 수 있는지, 될 수 있는지)를 직접 묻는 질문이 있는지 판정하고 JSON 한 줄만 출력한다.
질문이 아닌 것: 이전 답변을 인용한 문장, "가능하다면 ~해"처럼 조건을 붙인 작업 지시, "가능한지 확인 후 진행해"처럼 확인을 작업 단계로 둔 지시, 가능 여부라는 말을 언급만 한 문장, 가능 여부가 아닌 다른 것을 묻는 질문.
출력: 가능 여부 질문이 있으면 {{"ask": true}}, 없으면 {{"ask": false}}.

[사용자 메시지]
{user_prompt}
"""
if confirmation:
    judge_prompt = f"""[사용자 메시지]가 네/아니요로 답할 수 있는 직접 확인 질문인지 판정해 JSON 한 줄로 출력한다.
설명 요청, 작업 지시, 인용문, 에이전트 보고는 false다. 질문 대상이나 답변의 사실성은 판정하지 않는다.
출력: {{"ask": true 또는 false}}

[사용자 메시지]
{user_prompt}
"""
if verdict:
    judge_body = body[:3000]
    # 긴 답변에서도 서로 다른 검사 후보의 문맥을 함께 보낸다.
    for start, end in spans:
        if end > 3000:
            judge_body += "\n\n[검사 후보 주변 문맥]\n" + body[max(0, start - 300):end + 300]
    judge_prompt = f"""아래 [사용자 메시지]와 [답변]을 보고 두 가지를 판정해 JSON 한 줄만 출력한다.
ask: [사용자 메시지]에 사용자가 어떤 일이 가능한지(할 수 있는지, 될 수 있는지)를 직접 묻는 질문이 있는지. 이전 답변 인용, "가능하다면 ~해" 같은 조건부 지시, 확인을 작업 단계로 둔 지시, 언급만 한 문장, 다른 것을 묻는 질문은 false.
split: [답변]이 첫머리 판정을 내린 뒤 "범위가 나뉜다", "일부만 된다", 항목마다 다른 판정처럼 판정 자체를 다시 쪼갰는지. 판정을 유지한 채 오탐 가능성·전제 조건·작업 범위를 덧붙인 단서는 false.
출력: {{"ask": true 또는 false, "split": true 또는 false}}

[사용자 메시지]
{user_prompt}

[답변]
{judge_body}
"""

def judge_command(output_path):
    custom = os.environ.get("STOP_JUDGE_BIN")
    if custom:
        return [custom]
    if os.environ["JUDGE_TOOL"] == "codex":
        return ["codex", "exec", "-m", "gpt-6-luna", "-c", "model_reasoning_effort=\"medium\"", "--disable", "hooks",
                "-s", "read-only", "--skip-git-repo-check", "--ephemeral", "-o", output_path, "-"]
    return ["claude", "-p", "--safe-mode", "--model", "haiku", "--tools", "", "--no-session-persistence"]

try:
    with tempfile.TemporaryDirectory() as workdir:
        output_path = os.path.join(workdir, "verdict.txt")
        result = subprocess.run(
            judge_command(output_path),
            input=judge_prompt,
            capture_output=True,
            text=True,
            timeout=JUDGE_TIMEOUT_SECONDS,
            cwd=workdir,
            env={**os.environ, "HARNESS_STOP_JUDGE": "1"},
        )
        # Codex는 진행 로그가 stdout에 섞여 마지막 메시지 파일을 우선 읽음
        text = open(output_path, encoding="utf-8").read() if os.path.exists(output_path) else result.stdout
    parsed = json.loads(re.search(r"\{.*?\}", text, re.S).group(0))
    asked = parsed.get("ask")
    split = parsed.get("split")
except Exception:
    # 판정기 호출이나 응답 해석이 실패하면 작업을 막지 않고 통과
    asked = False
    split = False
if asked is not True or (verdict and split is not True):
    clear_mark()
    sys.exit(0)

print(json.dumps({
    "decision": "block",
    "reason": ("사용자가 확인 질문을 했습니다. " + problem + " 네. 또는 아니요.부터 답한 뒤 설명하세요. 판단 근거가 없으면 확인할 수 없습니다.로 답하세요." if confirmation else
    "사용자가 가능 여부를 물었습니다. " + problem
    + " 가능합니다. 또는 불가능합니다. 중 하나로 시작해 다시 답하세요. 일부만 가능하다는 분할 판정과 진행 안내로 시작하지 말고, 단서와 범위는 둘째 문장부터 쓰세요."
    + " 단서는 판정을 유지한 채 조건(오탐 가능성, 전제, 작업 범위)으로만 덧붙이세요."),
}, ensure_ascii=False))
'

exit 0
