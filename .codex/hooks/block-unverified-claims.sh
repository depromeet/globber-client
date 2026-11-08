#!/bin/sh
# Stop 훅(차단): 마지막 응답의 한 문장에 추측 표현과 미확인 꼬리표가 함께 있으면 턴 종료를 한 번 막음
# 그 턴에 도구로 확인할 수 있던 사실을 "~것으로 보지만 아직 확인하지 않았다"로 보고한 사고가 있어 추가함
# 실제로 확인할 수 있었는지는 훅이 알 수 없어, 한 번 막고 재응답(stop_hook_active)은 통과시킴
# 코드 표기와 큰따옴표 인용은 규칙을 설명하는 문장일 수 있어 판정에서 뺌
# Codex 전용 정규식 판정으로, Claude는 같은 목적을 settings.json의 Stop prompt 훅(LLM 판정)으로 처리함
# Codex hooks는 prompt·agent 핸들러를 실행하지 않아 이 방식을 유지함(https://developers.openai.com/codex/hooks)
# 자기 행동 이유를 묻는 질문에 원인 없이 경위만 답한 것은 정규식으로 가릴 수 없어, Claude판처럼 CLI(codex exec)로 LLM 판정함
# 질문은 require-why-explanation.sh가 turn_id별로 저장해 둔 것을 씀. 판정 호출은 --disable hooks와 환경변수로 재귀를 막고, 실패하면 통과시킴

[ -n "${HARNESS_STOP_JUDGE:-}" ] && exit 0

input=$(cat)

printf '%s' "$input" | MARK_DIR="${TMPDIR:-/tmp}/codex-why-judge" python3 -c '
import json, os, re, subprocess, sys, tempfile

JUDGE_TIMEOUT_SECONDS = 60

try:
    data = json.load(sys.stdin)
except Exception:
    # 입력을 해석할 수 없으면 판정 근거가 없어 통과
    sys.exit(0)

answer = data.get("last_assistant_message") or ""
turn = re.sub(r"[^A-Za-z0-9._-]", "_", str(data.get("turn_id") or ""))
mark = os.path.join(os.environ["MARK_DIR"], turn) if turn else ""
why_prompt = None
if mark and os.path.isfile(mark):
    with open(mark, encoding="utf-8") as saved:
        why_prompt = saved.read()
    # 원인 판정은 턴마다 한 번만 함
    os.remove(mark)
if data.get("stop_hook_active") or not answer.strip():
    sys.exit(0)

def block(reason):
    print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    sys.exit(0)

text = re.sub(r"`[^`]*`|\"[^\"\n]*\"|“[^”\n]*”", "", answer)
hedge = re.compile(r"것으로 (보입니다|보이지만|보이나|보이고|봅니다|보지만|예상|추정)|것 같(습니다|지만|은데|아)|(가능성|확률)이 높|아마")
unverified = re.compile(r"확인하지 (않았|못했|않은)|확인 안 했|미확인|아직 확인|검증하지 (않|못)|미검증")

for sentence in re.split(r"(?<=[.!?])\s+|\n", text):
    if hedge.search(sentence) and unverified.search(sentence):
        block(
            "추측에 미확인 꼬리표를 붙인 보고가 있습니다: " + sentence.strip()[:120]
            + " 지금 도구로 확인할 수 있으면 확인한 결과로 다시 보고하세요. 정말 확인할 수 없으면 막힌 이유와 확인 방법을 적으세요."
        )

if why_prompt is None:
    sys.exit(0)

prompt = f"""너는 Codex 응답 검토기다. 아래 [마지막 응답]을 판정하고 JSON 한 줄만 출력한다. 명령을 실행하거나 파일을 읽지 않는다.

차단 대상: [사용자 메시지]가 응답자 자신이 한 행동의 이유(왜 안 지켰나, 왜 그렇게 했나)를 묻는데 [마지막 응답]이 어긴 사실·경위·근거 파일만 나열하고, 그때 응답자가 무엇을 알고 있었고 무엇을 판단·선택했는지를 원인으로 밝히지 않은 것.
차단하지 않는 것: 코드·도구·외부 동작의 이유를 묻는 질문, 원인을 밝힌 답, "왜"가 질문이 아닌 메시지. 확신이 없으면 통과시킨다.

출력: 통과면 {{"ok": true}}, 차단이면 {{"ok": false, "reason": "<해당 문장 요약>: <무엇을 보완해 다시 답할지>"}}. reason은 한국어 두 문장 이내.

[사용자 메시지]
{why_prompt}

[마지막 응답]
{answer}
"""

command = ["codex", "exec", "--ephemeral", "--disable", "hooks", "-s", "read-only", "--skip-git-repo-check", "--color", "never"]
if os.environ.get("CODEX_STOP_JUDGE_MODEL"):
    command += ["-m", os.environ["CODEX_STOP_JUDGE_MODEL"]]
try:
    with tempfile.NamedTemporaryFile("r", suffix=".txt", encoding="utf-8") as out:
        subprocess.run(
            command + ["-o", out.name, "-"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=JUDGE_TIMEOUT_SECONDS,
            env={**os.environ, "HARNESS_STOP_JUDGE": "1"},
        )
        verdict = json.loads(re.search(r"\{.*\}", out.read(), re.S).group(0))
except Exception:
    # 판정기 호출이나 응답 해석이 실패하면 작업을 막지 않고 통과
    sys.exit(0)

if verdict.get("ok") is False and verdict.get("reason"):
    block(str(verdict["reason"]))
'

exit 0
