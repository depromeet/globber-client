#!/bin/sh
# Stop 훅(차단): 마지막 응답의 한 문장에 추측 표현과 미확인 꼬리표가 함께 있거나 확인 미룸 표현이 있으면 턴 종료를 한 번 막음
# 실제로 확인할 수 있었는지는 훅이 알 수 없어, 한 번 막고 재응답(stop_hook_active)은 통과시킴
# 코드 표기와 큰따옴표 인용은 규칙을 설명하는 문장일 수 있어 판정에서 뺌
# Codex 전용 정규식 판정으로, Claude는 같은 목적을 settings.json의 Stop prompt 훅(LLM 판정)으로 처리함
# Codex hooks는 prompt·agent 핸들러를 실행하지 않아 이 방식을 유지함(https://developers.openai.com/codex/hooks)
# 자기 행동 이유를 묻는 질문에 원인 없이 경위만 답한 것은 정규식으로 가릴 수 없어, Claude판처럼 CLI(codex exec)로 LLM 판정함
# 질문은 require-why-explanation.sh가 turn_id별로 저장해 둔 것을 씀. 판정 호출은 --disable hooks와 환경변수로 재귀를 막고, 실패하면 통과시킴

[ -n "${HARNESS_STOP_JUDGE:-}" ] && exit 0

input=$(cat)

printf '%s' "$input" | DEFERRED_PATTERN_FILE="$(dirname "$0")/../../.harness/deferred-claims-pattern.txt" MARK_DIR="${TMPDIR:-/tmp}/codex-why-judge" python3 -c '
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

text = re.sub(r"`[^`]*`|\"[^\"\n]*\"|“[^”\n]*”|^>.*$", "", answer, flags=re.M)
hedge = re.compile(r"것으로 (보입니다|보이지만|보이나|보이고|봅니다|보지만|예상|추정)|것 같(습니다|지만|은데|아)|(가능성|확률)이 높|아마")
unverified = re.compile(r"확인하지 (않았|못했|않은)|확인 안 했|미확인|아직 확인|검증하지 (않|못)|미검증")
# 미룸 문구는 Claude·Codex 판정 훅이 함께 쓰는 파일에서 읽고, 읽지 못하면 이 판정만 건너뜀
try:
    with open(os.environ["DEFERRED_PATTERN_FILE"], encoding="utf-8") as pattern_file:
        deferred = re.compile(pattern_file.read().strip())
except Exception:
    deferred = None
# 자기 판단의 원인 설명이나 사용자 의도처럼 도구로 확인할 대상이 아닌 문장은 미룸 판정에서 뺌(Claude판과 같은 공용 파일)
try:
    with open(os.environ["DEFERRED_PATTERN_FILE"].replace("deferred-claims-pattern", "deferred-claims-exempt-pattern"), encoding="utf-8") as exempt_file:
        exempt_pattern = exempt_file.read().strip()
        exempt = re.compile(exempt_pattern) if exempt_pattern else None
except Exception:
    exempt = None

for sentence in re.split(r"(?<=[.!?])\s+|\n", text):
    deferred_hit = deferred and deferred.search(sentence) and not (exempt and exempt.search(sentence))
    if (hedge.search(sentence) and unverified.search(sentence)) or deferred_hit:
        block(
            "확인을 미룬 보고가 있습니다: " + sentence.strip()[:120]
            + " 지금 도구로 확인할 수 있으면 확인한 결과로 다시 보고하세요. 정말 확인할 수 없으면 막힌 이유와 확인 방법을 적으세요."
        )

MAX_TURN_TEXT_CHARS = 6000

# 질문 창 직전 등 마지막 응답 이전에 쓴 설명도 원인 판정에 쓰도록, transcript에서 이번 턴 assistant 텍스트를 모음(형식은 require-korean-response.sh와 같은 해석). 못 읽으면 마지막 응답만으로 판정
turn_texts = []
try:
    entries = [json.loads(line) for line in open(data.get("transcript_path") or "", encoding="utf-8") if line.strip()]
except Exception:
    entries = []
# 실제 Codex JSONL과 기존 훅 transcript를 모두 읽어 현재 사용자 턴의 근거만 전달
normalized = []
for entry in entries:
    payload = entry.get("payload") or {}
    message = entry.get("message") or {}
    role = payload.get("role") or entry.get("type")
    content = payload.get("content") if payload.get("role") else message.get("content")
    if isinstance(content, str):
        content = [{"type": "text", "text": content}]
    normalized.append((role, content or [], payload))
start = 0
latest_prompt = ""
for index, (role, content, payload) in enumerate(normalized):
    if role != "user":
        continue
    text = "\n".join(part.get("text", "") for part in content
                     if isinstance(part, dict) and part.get("type") in ("text", "input_text"))
    if not text or text.lstrip().startswith(("<hook_prompt", "<codex_internal_context")):
        continue
    latest_prompt = text
    start = index + 1
if why_prompt is None:
    if not re.search(r"정리|걷어|삭제|제거|TODO|todo|동기화", latest_prompt):
        sys.exit(0)
    why_prompt = latest_prompt
evidence = []
for role, content, payload in normalized[start:]:
    if payload.get("type") in ("function_call_output", "custom_tool_call_output"):
        evidence.append(str(payload.get("output", "")))
    for part in content:
        if not isinstance(part, dict):
            continue
        if part.get("type") == "tool_result":
            evidence.append(str(part.get("content", "")))
        if role == "assistant" and part.get("type") in ("text", "output_text"):
            turn_texts.append(part.get("text", ""))
evidence_text = "\n".join(evidence)[-12000:] or "(도구 결과 없음)"
turn_text = "\n".join(turn_texts).rstrip()
if turn_text.endswith(answer.strip()):
    turn_text = turn_text[: -len(answer.strip())]
turn_text = turn_text.strip()[-MAX_TURN_TEXT_CHARS:] or "(없음)"

prompt = f"""너는 Codex 응답 검토기다. 아래 [마지막 응답]을 판정하고 JSON 한 줄만 출력한다. 명령을 실행하거나 파일을 읽지 않는다.

차단 대상: [사용자 메시지]가 응답자 자신이 한 행동의 이유(왜 안 지켰나, 왜 그렇게 했나)를 묻는데 [마지막 응답 이전의 이번 턴 텍스트]와 [마지막 응답]이 모두 어긴 사실·경위·근거 파일만 나열하고, 그때 응답자가 무엇을 알고 있었고 무엇을 판단·선택했는지를 원인으로 밝히지 않은 것.
추가 차단 대상:
- 사용자가 전체 정리·제거를 요구했는데 테스트·설정·문서·산출물·worktree의 잔여가 [도구 결과]에 남아 있거나, 응답자가 일부를 임의 보존하면서 전체 완료라고 주장한 것.
- TODO 순서·항목별 보고를 요청했는데, 기록에 미완료 항목이 남아 있는데도 전체 작업 완료라고 주장한 것.
- 사용자가 지정한 TODO 순서를 다음 작업이 독립적이라는 이유만으로 임의 변경했거나, 새 지시·응답 전에 TODO 갱신을 생략한 사실이 도구 기록에 드러난 것.
관련 대상을 추측해서 추가하지 말고 사용자 요청에 명시된 범위와 실제 도구 결과만 대조한다. 다른 작업 보호나 실제 차단 사유를 밝히고 부분 완료라고 보고한 것은 차단하지 않는다.

이유 설명 검사에서는 코드·도구·외부 동작의 이유를 묻는 질문, 원인을 밝힌 답, "왜"가 질문이 아닌 메시지를 차단하지 않는다. 추가 완료 주장 검사는 별도로 적용한다. 확신이 없으면 통과시킨다.

출력: 통과면 {{"ok": true}}, 차단이면 {{"ok": false, "reason": "<해당 문장 요약>: <무엇을 보완해 다시 답할지>"}}. reason은 한국어 두 문장 이내.

[사용자 메시지]
{why_prompt}

[마지막 응답 이전의 이번 턴 텍스트]
{turn_text}

[도구 결과]
{evidence_text}

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
