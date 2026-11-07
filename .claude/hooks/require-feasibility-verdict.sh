#!/bin/sh
# UserPromptSubmit·PostToolUse·Stop 훅: 가능 여부 질문에는 최종 답변을 가능합니다 또는 불가능합니다로 시작하게 함
# UserPromptSubmit(안내): 가능 여부 키워드가 있으면 조건부 리마인더를 출력하고, 의문형까지 갖춘 질문이면 세션별 표시 파일에 후보 문장을 남김
# PostToolUse(안내): 표시 파일이 있는 턴의 도구 결과마다 최종 답변 첫머리 규칙을 다시 붙임
# 턴 끝 직전 진행 안내 요청에 답하느라 판정이 밀려난 사고가 있어, 같은 자리에 반대 방향 안내를 두려는 처리
# Stop(차단): 표시 파일이 있는 세션의 마지막 응답이 가능합니다 또는 불가능합니다로 시작하지 않으면 턴 종료를 막고 다시 답하게 함
# 리마인더만으로는 판정이 둘째 문장으로 밀려도 막지 못해 Stop 검사를 추가함
# Codex 문서상 transcript 형식이 안정 인터페이스가 아니라서 transcript 대신 UserPromptSubmit의 prompt로 질문을 판정함
# 키워드·의문형 패턴은 후보만 고르고, 차단 직전에 LLM이 실제 가능 여부 질문인지 다시 판정함
# 이전 답변을 인용한 문장이나 "가능하다면 ~해" 같은 조건부 지시가 패턴에 걸려 오탐하던 문제 때문에 재판정을 둠
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
mark = os.path.join(os.environ["MARK_DIR"], session)

def clear_mark():
    try:
        os.remove(mark)
    except OSError:
        # 표시가 없으면 지울 것도 없음
        pass

event = data.get("hook_event_name")

if event == "PostToolUse":
    if os.path.exists(mark):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "가능 여부 질문 처리 중: 다음 메시지가 최종 답변이면 진행 안내 없이 가능합니다. 또는 불가능합니다.로 시작할 것.",
        }}, ensure_ascii=False))
    sys.exit(0)

if event != "Stop":
    # 백그라운드 subagent 보고도 UserPromptSubmit으로 들어와 그 본문이 질문으로 판정되던 오탐을 막으려고 제외함
    # 붙여넣은 내용은 사용자가 쓴 문장이 아니라 인용 자료라서 함께 제외함
    prompt = re.sub(r"<agent-message\b.*?(</agent-message>|\Z)", "", data.get("prompt") or "", flags=re.S)
    prompt = re.sub(r"<pasted_content id=\"([^\"]*)\">.*?(</pasted_content id=\"\1\">|\Z)", "", prompt, flags=re.S)
    if not prompt.strip() or re.fullmatch(r"\s*Another Claude session sent a message[^\n]*\s*", prompt):
        # 사용자 문장이 없는 보고 전달이면 진행 중인 질문의 표시를 지우지 않고 그대로 둠
        sys.exit(0)
    keyword = re.search(r"가능|할 수 있|될 수 있|될까|되나|되냐|possible|feasible", prompt, re.I)
    # 키워드만 있는 작업 지시("가능하다로 대답해")는 질문이 아니므로 의문형까지 있어야 표시함
    question = re.search(
        r"\?|가능(성|\s?여부)[^.?!\n]*(검토|확인|판단|보고|알려)|가능(한지|할까|해|합니까|한가|하냐|하니|함)|(할|될) 수 있(는지|어|나|을까|니|냐|습니까)|될까|되나|되냐|되는지",
        prompt,
    )
    if keyword:
        print("가능 여부 키워드 감지: 사용자가 가능한지 묻는 질문이면 최종 답변을 가능합니다. 또는 불가능합니다.로 시작할 것. 일부만 가능하다는 분할 판정, 진행 안내 문장, 얼버무림, 비교표로 시작 금지. 단서와 범위는 둘째 문장부터. 키워드를 언급만 한 메시지(작업 지시 등)면 해당 없음.")
    # 질문이 아닌 메시지는 표시를 지우지 않음
    # 작업 도중 들어온 다른 메시지가 표시를 지워 턴 끝 검사가 돌지 않던 문제를 막으려는 처리
    # 표시는 Stop에서 판정이 끝난 뒤(통과 또는 한 번 막은 뒤의 재응답)에만 지움
    # 작업 중에 들어온 질문도 함께 재판정하도록 후보 문장을 이어 붙여 둠
    if keyword and question:
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
            candidates.write(prompt.strip() + "\n---\n")
    sys.exit(0)

if not os.path.exists(mark):
    sys.exit(0)

answer = (data.get("last_assistant_message") or "").strip()
# 이미 한 번 막힌 뒤의 재응답이면 무한 반복을 막으려고 통과
if data.get("stop_hook_active") or not answer:
    clear_mark()
    sys.exit(0)

# 제목·강조·인용 기호를 걷어낸 뒤 답변 첫머리가 판정인지 봄
# 사용자가 일부만 가능하다는 분할 판정을 금지하고 가능하다/불가능하다로만 답하라고 지시해 두 판정만 허용함
body = re.sub(r"^[\s#*>-]+", "", answer)
if re.match(r"(불)?가능합니다", body):
    clear_mark()
    sys.exit(0)
problem = "답변이 가능합니다. 또는 불가능합니다.로 시작하지 않습니다."

try:
    with open(mark, encoding="utf-8") as candidates:
        user_prompt = candidates.read().strip()
except OSError:
    user_prompt = ""

judge_prompt = f"""아래 [사용자 메시지]에 사용자가 어떤 일이 가능한지(할 수 있는지, 될 수 있는지)를 직접 묻는 질문이 있는지 판정하고 JSON 한 줄만 출력한다.
질문이 아닌 것: 이전 답변을 인용한 문장, "가능하다면 ~해"처럼 조건을 붙인 작업 지시, "가능한지 확인 후 진행해"처럼 확인을 작업 단계로 둔 지시, 가능 여부라는 말을 언급만 한 문장, 가능 여부가 아닌 다른 것을 묻는 질문.
출력: 가능 여부 질문이 있으면 {{"ask": true}}, 없으면 {{"ask": false}}.

[사용자 메시지]
{user_prompt}
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
    asked = json.loads(re.search(r"\{.*?\}", text, re.S).group(0)).get("ask")
except Exception:
    # 판정기 호출이나 응답 해석이 실패하면 작업을 막지 않고 통과
    asked = False
if asked is not True:
    clear_mark()
    sys.exit(0)

print(json.dumps({
    "decision": "block",
    "reason": "사용자가 가능 여부를 물었습니다. " + problem
    + " 가능합니다. 또는 불가능합니다. 중 하나로 시작해 다시 답하세요. 일부만 가능하다는 분할 판정과 진행 안내로 시작하지 말고, 단서와 범위는 둘째 문장부터 쓰세요.",
}, ensure_ascii=False))
'

exit 0
