#!/bin/sh
# Stop 훅(차단): 마지막 응답의 확인 미룸 표현을 정규식으로 턴마다 한 번 먼저 막고, 이어서 근거 없는 단정, 구체성 없는 확인 요청, 자기 행동 이유 질문에 원인 없이 경위만 답한 것을 LLM으로 판정해 턴 종료를 막음
# Stop 판정은 도구 근거와 재진입 상태를 함께 전달하는 command 훅으로 실행함
# Stop은 if를 지원하지 않고 같은 이벤트 훅은 병렬 실행이라, 결정적 가드는 이 스크립트 안에서만 둘 수 있음
# stop_hook_active와 파일에 저장한 턴별 차단 횟수 상한으로 재진입을 제한함
# 판정 호출은 --safe-mode로 hooks를 끄고 환경변수로도 재귀를 막음(--bare는 구독 로그인을 쓰지 않아 제외)
# 판정 실패·타임아웃·해석 불가는 통과시켜 판정기 고장이 작업을 멈추지 않게 함
# Codex는 prompt 판정을 쓰지 않고 .codex/hooks/block-unverified-claims.sh 정규식 판정을 유지함
# 질문에 답했는지는 require-answer-before-edit.sh가 판정하고, 이 훅은 답의 근거와 원인만 판정함

[ -n "${HARNESS_STOP_JUDGE:-}" ] && exit 0

input=$(cat)

printf '%s' "$input" | DEFERRED_PATTERN_FILE="$(dirname "$0")/../../.harness/deferred-claims-pattern.txt" MARK_DIR="${TMPDIR:-/tmp}/stop-judge" python3 -c '
import json, os, re, subprocess, sys

MAX_BLOCKS = 2
MAX_RESULT_CHARS = 1500
MAX_MATCH_CHARS = 3000
MAX_LINE_CHARS = 400
MAX_EVIDENCE_CHARS = 24000
MAX_TURN_TEXT_CHARS = 6000
# 앞선 턴에서 확인한 근거를 인용한 주장을 근거 없음으로 오판하지 않도록, 이번 턴 포함 최근 3개 사용자 턴의 도구 기록을 모음(전체는 MAX_EVIDENCE_CHARS 안에서 최신 쪽 우선)
EVIDENCE_TURNS = 3
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

# transcript를 끝에서부터 읽어 최근 EVIDENCE_TURNS개 사용자 턴의 도구 호출·결과와, 이번 턴 assistant 텍스트를 모음
turn_id = "unknown"
prompts = []
evidence = []
turn_texts = []
turns_seen = 0
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
        # 앞선 턴의 사용자 메시지는 원인 판정 대상이 아니라 prompts에 넣지 않음
        if turns_seen == 0:
            turn_id = entry.get("uuid") or turn_id
            prompts.append(prompt_text(entry))
        turns_seen += 1
        if turns_seen >= EVIDENCE_TURNS:
            break
        evidence.append("[--- 이전 사용자 턴 경계 ---]")
        continue
    # 작업 중에 보낸 사용자 메시지는 queued_command 첨부로 남음
    attachment = entry.get("attachment") or {}
    if turns_seen == 0 and attachment.get("type") == "queued_command" and attachment.get("prompt"):
        prompts.append(str(attachment["prompt"])[-MAX_EVIDENCE_CHARS:])
    # 질문 창 직접 입력은 tool_result로 기록되어 턴 시작 메시지 판별에 잡히지 않으므로 답변 원문을 질문 목록에 넣음
    tool_result = entry.get("toolUseResult")
    if turns_seen == 0 and isinstance(tool_result, dict) and isinstance(tool_result.get("answers"), dict):
        for question in tool_result.get("questions") or []:
            labels = {option.get("label") for option in question.get("options") or []}
            value = tool_result["answers"].get(question.get("question"))
            parts = value.split(", ") if value and question.get("multiSelect") else [value]
            if value and not set(parts) <= labels:
                prompts.append(str(value)[-MAX_EVIDENCE_CHARS:])
    content = (entry.get("message") or {}).get("content")
    if not isinstance(content, list):
        continue
    for block in reversed(content):
        if not isinstance(block, dict):
            continue
        if turns_seen == 0 and entry.get("type") == "assistant" and block.get("type") == "text":
            turn_texts.append(block.get("text", ""))
        elif block.get("type") == "tool_use":
            evidence.append("[도구 호출] " + json.dumps(block.get("input"), ensure_ascii=False)[:MAX_RESULT_CHARS])
        elif block.get("type") == "tool_result":
            evidence.append("[도구 결과] " + block_text(block))
user_prompt = "\n---\n".join(reversed(prompts)) or "(찾지 못함)"
evidence_text = "\n".join(reversed(evidence))[-MAX_EVIDENCE_CHARS:] or "(최근 도구 실행 없음)"
# 질문 창 직전 등 마지막 응답 이전에 쓴 설명도 원인 판정에 쓰도록 이번 턴 텍스트를 넘김
# 마지막 응답과 겹치는 끝부분은 제외
turn_text = "\n".join(reversed(turn_texts)).rstrip()
if turn_text.endswith(answer.strip()):
    turn_text = turn_text[: -len(answer.strip())]
turn_text = turn_text.strip()[-MAX_TURN_TEXT_CHARS:] or "(없음)"

session = re.sub(r"[^\w.-]", "_", str(data.get("session_id") or "default"))
mark = os.path.join(os.environ["MARK_DIR"], session + "-" + re.sub(r"[^\w.-]", "_", turn_id))
try:
    with open(mark, encoding="utf-8") as counter:
        blocks = int(counter.read() or 0)
except Exception:
    blocks = 0
if blocks >= MAX_BLOCKS:
    sys.exit(0)

# LLM은 미검증 표시를 정직한 보고로 보고 놓칠 수 있어 확인 미룸 표현은 정규식으로 먼저 판정
# 코드 표기·큰따옴표·인용 줄은 규칙을 설명하는 문장일 수 있어 판정에서 뺌. 재응답은 다음 판정으로 넘김
deferred_mark = mark + "-deferred"
deferred_text = re.sub(r"`[^`]*`|\"[^\"\n]*\"|“[^”\n]*”|^>.*$", "", answer, flags=re.M)
# 미룸 문구는 Claude·Codex 판정 훅이 함께 쓰는 파일에서 읽고, 읽지 못하면 이 판정만 건너뜀
try:
    with open(os.environ["DEFERRED_PATTERN_FILE"], encoding="utf-8") as pattern_file:
        deferred_pattern = re.compile(pattern_file.read().strip())
except Exception:
    deferred_pattern = None
# 자기 판단의 원인 설명이나 사용자 의도처럼 도구로 확인할 대상이 아닌 문장은 미룸 판정에서 뺌(공용 파일, 읽지 못하면 제외 없이 판정)
try:
    with open(os.environ["DEFERRED_PATTERN_FILE"].replace("deferred-claims-pattern", "deferred-claims-exempt-pattern"), encoding="utf-8") as exempt_file:
        exempt_pattern = exempt_file.read().strip()
        deferred_exempt = re.compile(exempt_pattern) if exempt_pattern else None
except Exception:
    deferred_exempt = None
if deferred_pattern and not os.path.exists(deferred_mark):
    for sentence in re.split(r"(?<=[.!?])\s+|\n", deferred_text):
        if deferred_pattern.search(sentence) and not (deferred_exempt and deferred_exempt.search(sentence)):
            os.makedirs(os.environ["MARK_DIR"], exist_ok=True)
            open(deferred_mark, "w").close()
            print(json.dumps({"decision": "block", "reason": "확인을 미룬 보고가 있습니다: " + sentence.strip()[:120] + " 지금 도구로 확인할 수 있으면 확인한 결과로 다시 보고하세요. 정말 확인할 수 없으면 막힌 이유와 확인 방법을 적으세요."}, ensure_ascii=False))
            sys.exit(0)

prompt = f"""너는 Claude Code 응답 검토기다. 아래 [마지막 응답]을 [최근 도구 기록]과 대조해 판정하고 JSON 한 줄만 출력한다.

차단 대상:
1. 응답 스스로 일반 지식·추측·미확인·미검증이라고 밝히면서 단정하거나 사용자에게 따르라고 안내한 주장
2. 외부 서비스·라이브러리·도구·공식 문서·저장소·배포·환경의 현재 상태에 대한 구체적 단정(버전, 기본값, 메뉴 이름, 자동 동작, 배포 상태 등) 중 [최근 도구 기록]에도 응답에 적힌 출처(실행한 명령, 읽은 파일, 인용 문서)에도 근거가 없는 것
3. 사용자에게 확인·조작을 요청하면서 전체 URL, 클릭·입력 순서, 알려 줄 값 중 하나라도 빠진 요청, 또는 코드·저장소·공개 문서처럼 도구로 직접 확인할 수 있는 것을 사용자에게 넘긴 요청
4. [사용자 메시지](턴 시작 메시지와 작업 중에 보낸 메시지, ---로 구분)가 응답자 자신이 한 행동의 이유(왜 안 지켰나, 왜 그렇게 했나)를 묻는데 [마지막 응답 이전의 이번 턴 텍스트]와 [마지막 응답]이 모두 어긴 사실·경위·근거 파일만 나열하고, 그때 응답자가 무엇을 알고 있었고 무엇을 판단·선택했는지를 원인으로 밝히지 않은 것
5. 응답이 미검증, 확인하지 않음, 시험 전 확정 불가, 추측처럼 확인을 미룬 사항 중 저장소 파일 읽기, 명령 실행, 임시 사본 실험, 세션 기록 조회로 그 턴에 확인할 수 있었던 것. 미검증이나 추론이라고 표시했어도 면제되지 않는다

6. 전체 정리·제거 요청에 대해 테스트·설정·문서·산출물·worktree의 잔여가 [최근 도구 기록]에 남아 있거나 일부를 임의 보존하면서 전체 완료라고 주장한 것
7. TODO 순서·항목별 보고를 요청했고 기록에 미완료 항목이 남아 있는데도 전체 작업 완료라고 주장한 것
8. 사용자 지정 TODO 순서를 독립 작업이라는 이유로 임의 변경했거나 새 지시·응답 전에 TODO 갱신을 생략한 사실이 도구 기록에 드러난 것

차단하지 않는 것: 응답자 자신의 판단 경위·동기·원인 설명, 직전 질문 창 직접 입력 때문에 남은 결정을 다음 사용자 메시지 뒤 질문 창으로 묻겠다고 미룬 것, 도구 기록이나 응답의 출처 표기로 뒷받침되는 주장, 이전 턴에서 확인했다고 출처를 밝힌 주장, 사용자가 준 자료에 근거한 주장, 시도한 명령의 실패, 권한 거부, 외부 시스템 미가동, 사람의 결정 필요처럼 실제로 막힌 이유와 확인 방법을 밝힌 보고, 근거를 대고 추론이라고 표시했으며 도구로 더 확인할 수 없는 판단, 사용자가 고를 선택지 설명, 계획·진행 상황 보고, 일반 프로그래밍 개념 설명.
[사용자 메시지]·[최근 도구 기록]에 없는 세션 스냅샷·시스템 정보·기억을 반박 근거로 쓰지 않는다.
같은 대상의 도구 결과가 여러 번 있으면 가장 마지막 결과를 기준으로 판정하고, 상태를 바꾸는 명령(파일 수정, git add 등) 이후에는 그 전 결과로 반박하지 않는다.
사용자 요청에 명시된 범위와 실제 도구 기록만 대조한다. 관련 대상을 추측해서 추가하지 않는다. 다른 작업 보호나 실제 차단 사유를 밝히고 부분 완료라고 보고한 것은 차단하지 않는다. 확신이 없으면 통과시킨다. 차단할 문장과 보완할 내용을 구체적으로 들 수 없으면 통과다.

출력: 통과면 {{"ok": true}}, 차단이면 {{"ok": false, "reason": "<해당 문장 요약>: <무엇을 확인하거나 보완해 다시 답할지>"}}. reason은 한국어 두 문장 이내.

[사용자 메시지]
{user_prompt}

[최근 도구 기록](이번 턴과 직전 사용자 턴들, 경계 표시로 구분)
{evidence_text}

[마지막 응답 이전의 이번 턴 텍스트]
{turn_text}

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

# 판정기가 사유에 통과라고 적고 ok false를 낸 모순 응답은 차단 사유가 없는 것으로 보고 통과
if verdict.get("ok") is False and verdict.get("reason") and not re.search(r"통과 대상|통과시킨다|통과한다|차단하지 않", str(verdict["reason"])):
    os.makedirs(os.environ["MARK_DIR"], exist_ok=True)
    with open(mark, "w", encoding="utf-8") as counter:
        counter.write(str(blocks + 1))
    print(json.dumps({"decision": "block", "reason": str(verdict["reason"])}, ensure_ascii=False))
'

exit 0
