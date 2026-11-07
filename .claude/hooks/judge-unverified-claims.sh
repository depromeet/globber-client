#!/bin/sh
# Stop 훅(차단): 마지막 응답의 근거 없는 단정, 구체성 없는 확인 요청, 사용자 질문 미응답, 자기 행동 이유 질문에 원인 없이 경위만 답한 것을 LLM으로 판정해 턴 종료를 막음
# type prompt 훅은 single-turn이라 도구 결과를 못 보고, stop_hook_active 재판정 지시를 판정 모델이 무시해 반복 차단한 사고가 있어 command 훅으로 감쌈
# Stop은 if를 지원하지 않고 같은 이벤트 훅은 병렬 실행이라, 결정적 가드는 이 스크립트 안에서만 둘 수 있음
# 가드는 stop_hook_active와 턴별 차단 횟수 상한이며, 플래그가 계속 false로 들어온 보고(anthropics/claude-code#54360)가 있어 횟수를 파일로도 셈
# 판정 호출은 --safe-mode로 hooks를 끄고 환경변수로도 재귀를 막음(--bare는 구독 로그인을 쓰지 않아 제외)
# 판정 실패·타임아웃·해석 불가는 통과시켜 판정기 고장이 작업을 멈추지 않게 함
# Codex는 prompt 판정을 쓰지 않고 .codex/hooks/block-unverified-claims.sh 정규식 판정을 유지함

[ -n "${HARNESS_STOP_JUDGE:-}" ] && exit 0

input=$(cat)

printf '%s' "$input" | MARK_DIR="${TMPDIR:-/tmp}/stop-judge" python3 -c '
import json, os, re, subprocess, sys

MAX_BLOCKS = 2
MAX_RESULT_CHARS = 1500
MAX_MATCH_CHARS = 3000
MAX_LINE_CHARS = 400
MAX_EVIDENCE_CHARS = 24000
JUDGE_TIMEOUT_SECONDS = 60

try:
    data = json.load(sys.stdin)
except Exception:
    # 입력을 해석할 수 없으면 판정 근거가 없어 통과
    sys.exit(0)

answer = data.get("last_assistant_message") or ""
if data.get("stop_hook_active") or not answer.strip():
    sys.exit(0)

def is_user_prompt(entry):
    if entry.get("type") != "user" or entry.get("isMeta"):
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )

def prompt_text(entry):
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, list):
        content = "\n".join(part.get("text", "") for part in content if isinstance(part, dict))
    return str(content or "")[-MAX_EVIDENCE_CHARS:]

# 긴 결과를 앞부분만 넘기면 응답이 인용한 줄이 잘려 근거 없음으로 오판하므로, 응답에 나온 파일명·백틱 표기가 든 뒷부분 줄을 함께 넘김
keys = set(re.findall(r"`([^`\n]{3,80})`", answer)) | set(re.findall(r"[\w.-]+\.(?:sh|mjs|js|ts|tsx|json|md|toml|py|css|ya?ml)\b", answer))
keys = {k for k in (re.sub(r":[\d,-]+$", "", key) for key in keys) if len(k) >= 3}

def block_text(block):
    content = block.get("content")
    if isinstance(content, list):
        content = "\n".join(part.get("text", "") for part in content if isinstance(part, dict))
    text = str(content or "")
    if len(text) <= MAX_RESULT_CHARS:
        return text
    hits = [line[:MAX_LINE_CHARS] for line in text[MAX_RESULT_CHARS:].splitlines() if any(key in line for key in keys)]
    matched = "\n".join(hits)[:MAX_MATCH_CHARS]
    return text[:MAX_RESULT_CHARS] + ("\n[...중략. 이후 줄 중 응답이 인용한 이름이 든 줄...]\n" + matched if matched else "\n[...이후 생략...]")

# transcript를 끝에서부터 읽어 마지막 실제 사용자 메시지 이후의 도구 호출과 결과만 모음
turn_id = "unknown"
prompts = []
evidence = []
try:
    with open(data.get("transcript_path") or "", encoding="utf-8") as transcript:
        lines = transcript.readlines()
except Exception:
    lines = []
for line in reversed(lines):
    try:
        entry = json.loads(line)
    except Exception:
        continue
    if is_user_prompt(entry):
        turn_id = entry.get("uuid") or turn_id
        prompts.append(prompt_text(entry))
        break
    # 작업 중에 보낸 사용자 메시지는 queued_command 첨부로 남음
    attachment = entry.get("attachment") or {}
    if attachment.get("type") == "queued_command" and attachment.get("prompt"):
        prompts.append(str(attachment["prompt"])[-MAX_EVIDENCE_CHARS:])
    content = (entry.get("message") or {}).get("content")
    if not isinstance(content, list):
        continue
    for block in reversed(content):
        if not isinstance(block, dict):
            continue
        if block.get("type") == "tool_use":
            evidence.append("[도구 호출] " + json.dumps(block.get("input"), ensure_ascii=False)[:MAX_RESULT_CHARS])
        elif block.get("type") == "tool_result":
            evidence.append("[도구 결과] " + block_text(block))
user_prompt = "\n---\n".join(reversed(prompts)) or "(찾지 못함)"
evidence_text = "\n".join(reversed(evidence))[-MAX_EVIDENCE_CHARS:] or "(이번 턴 도구 실행 없음)"

session = re.sub(r"[^\w.-]", "_", str(data.get("session_id") or "default"))
mark = os.path.join(os.environ["MARK_DIR"], session + "-" + re.sub(r"[^\w.-]", "_", turn_id))
try:
    with open(mark, encoding="utf-8") as counter:
        blocks = int(counter.read() or 0)
except Exception:
    blocks = 0
if blocks >= MAX_BLOCKS:
    sys.exit(0)

prompt = f"""너는 Claude Code 응답 검토기다. 아래 [마지막 응답]을 [이번 턴 도구 기록]과 대조해 판정하고 JSON 한 줄만 출력한다.

차단 대상:
1. 응답 스스로 일반 지식·추측·미확인·미검증이라고 밝히면서 단정하거나 사용자에게 따르라고 안내한 주장
2. 외부 서비스·라이브러리·도구·공식 문서·저장소·배포·환경의 현재 상태에 대한 구체적 단정(버전, 기본값, 메뉴 이름, 자동 동작, 배포 상태 등) 중 [이번 턴 도구 기록]에도 응답에 적힌 출처(실행한 명령, 읽은 파일, 인용 문서)에도 근거가 없는 것
3. 사용자에게 확인·조작을 요청하면서 전체 URL, 클릭·입력 순서, 알려 줄 값 중 하나라도 빠진 요청, 또는 코드·저장소·공개 문서처럼 도구로 직접 확인할 수 있는 것을 사용자에게 넘긴 요청
4. [사용자 메시지](턴 시작 메시지와 작업 중에 보낸 메시지, ---로 구분)의 질문(붙여 넣은 내용 뒤에 단 질문 포함) 중 [마지막 응답]이 답하지 않은 것. 작업 지시는 질문이 아니다
5. [사용자 메시지]가 응답자 자신이 한 행동의 이유(왜 안 지켰나, 왜 그렇게 했나)를 묻는데 [마지막 응답]이 어긴 사실·경위·근거 파일만 나열하고, 그때 응답자가 무엇을 알고 있었고 무엇을 판단·선택했는지를 원인으로 밝히지 않은 것

차단하지 않는 것: 도구 기록이나 응답의 출처 표기로 뒷받침되는 주장, 이전 턴에서 확인했다고 출처를 밝힌 주장, 사용자가 준 자료에 근거한 주장, 확인할 수 없는 이유와 확인 방법을 밝힌 보고, 추론이라고 표시한 판단, 사용자가 고를 선택지 설명, 계획·진행 상황 보고, 일반 프로그래밍 개념 설명.
작업 완료 여부와 남은 단계는 판정하지 않는다. 확신이 없으면 통과시킨다.

출력: 통과면 {{"ok": true}}, 차단이면 {{"ok": false, "reason": "<해당 문장 요약>: <무엇을 확인하거나 보완해 다시 답할지>"}}. reason은 한국어 두 문장 이내.

[사용자 메시지]
{user_prompt}

[이번 턴 도구 기록]
{evidence_text}

[마지막 응답]
{answer}
"""

try:
    result = subprocess.run(
        [os.environ.get("STOP_JUDGE_BIN", "claude"), "-p", "--safe-mode", "--model", "haiku", "--tools", "", "--no-session-persistence"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=JUDGE_TIMEOUT_SECONDS,
        env={**os.environ, "HARNESS_STOP_JUDGE": "1"},
    )
    verdict = json.loads(re.search(r"\{.*\}", result.stdout, re.S).group(0))
except Exception:
    # 판정기 호출이나 응답 해석이 실패하면 작업을 막지 않고 통과
    sys.exit(0)

if verdict.get("ok") is False and verdict.get("reason"):
    os.makedirs(os.environ["MARK_DIR"], exist_ok=True)
    with open(mark, "w", encoding="utf-8") as counter:
        counter.write(str(blocks + 1))
    print(json.dumps({"decision": "block", "reason": str(verdict["reason"])}, ensure_ascii=False))
'

exit 0
