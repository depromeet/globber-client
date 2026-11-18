#!/bin/sh
# PreToolUse(Edit|Write|NotebookEdit, 파일 쓰는 Bash) 훅(차단): 사용자가 요청하지 않은 메모리 저장을 막음
# 대상은 Claude 프로필의 projects/<프로젝트>/memory/ 아래 파일 쓰기, 읽기와 조회는 통과
# 통과: 가장 최근 사용자 메시지에 메모리 저장·갱신 요청 표현이 있음("메모리 업데이트해", "기억해" 등)
# 부정 표현("메모리에 저장하지 마")과 동사 없이 "기억"만 들어 있는 문장은 요청으로 보지 않음
# 작업 도중 들어온 사용자 메시지(queued_command)도 최근 사용자 메시지로 읽음
# transcript를 읽지 못하면 막지 않고 통과, subagent 호출은 대상에서 제외

input=$(cat)

printf '%s' "$input" | python3 -c '
import json, re, shlex, sys

REDIRECT = re.compile(r"[\x27][^\x27]*[\x27]|\"(?:\\.|[^\"\\])*\"|\\.|(?:&?>>?|<>)\s*(?P<path>\"[^\"]+\"|[\x27][^\x27]+[\x27]|[^\s;&|<>]+)")
MEMORY = re.compile(r"(^|/)projects/[^/]+/memory/")
REQUEST = re.compile(r"(메모리|기억|memory)[^\n.?!]{0,12}?(업데이트|저장|추가|갱신|기록|수정|삭제|정리|반영|update|save|add)|기억(?:해|하)|잊지\s*마|remember\s+(?:this|that|to)", re.I)
DENIED = re.compile(r"(?:기억|메모리|memory|저장|remember)[^\n.!?]{0,26}(?:하지\s*(?:마|말|않)|말아|말고|안\s*해)|\b(?:do not|don.t|never)\s+(?:save|remember)", re.I)
APPROVAL_ENDING = re.compile(r"^(?:해(?:\s*(?:줘|주세요))?|하(?:고|도록|라|세요)|해라|해주십시오|해\s*주시기\s*바랍니다|\s*(?:[.!\n]|$))")
QUESTION_ENDING = re.compile(r"(?:[?？]|(?:수 있|가능|될까|하겠|인가|해도)[^.!\n]{0,16}$)")
MARKERS = ("<hook_prompt", "<system-reminder", "<task-notification", "<agent-message", "[Request interrupted")

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("hook_event_name") != "PreToolUse" or data.get("agent_id"):
    sys.exit(0)

args = data.get("tool_input") or {}

if data.get("tool_name") == "Bash":
    command = str(args.get("command") or "")
    touched = any(m.group("path") and MEMORY.search(m.group("path").strip(chr(34) + chr(39)))
                  for m in REDIRECT.finditer(command))
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>\n")
        lexer.whitespace_split = True
        lexer.whitespace = " \t\r"
        segments = [[]]
        tokens = iter(lexer)
        for token in tokens:
            if token in (";", "&&", "||", "|", "&") or "\n" in token and not token.strip(";&|\n"):
                segments.append([])
            elif re.fullmatch(r"[<>]+", token):
                next(tokens, None)
            else:
                segments[-1].append(token)
        for tokens in filter(None, segments):
            program, *args = tokens
            files = [arg for arg in args if not arg.startswith("-")]
            if program == "cp":
                target = next((arg.split("=", 1)[1] for arg in args if arg.startswith("--target-directory=")), None)
                if not target:
                    target = next((value for option, value in zip(args, args[1:]) if option in ("-t", "--target-directory")), None)
                files = [target] if target else files[-1:]
            elif program not in ("mv", "touch", "tee") and not (program == "sed" and any(arg.startswith("-i") for arg in args)):
                continue
            touched |= any(MEMORY.search(arg) for arg in files)
    except ValueError:
        pass
else:
    touched = bool(MEMORY.search(str(args.get("file_path") or args.get("notebook_path") or "")))

if not touched:
    sys.exit(0)

try:
    with open(data.get("transcript_path") or "", encoding="utf-8") as handle:
        entries = [json.loads(line) for line in handle if line.strip()]
except Exception:
    sys.exit(0)

def text_of(entry):
    if entry.get("type") == "attachment":
        attachment = entry.get("attachment") or {}
        return str(attachment.get("prompt") or "") if attachment.get("type") == "queued_command" else ""
    if entry.get("type") != "user" or entry.get("isMeta"):
        return ""
    answers = (entry.get("toolUseResult") or {}).get("answers")
    if isinstance(answers, dict):
        return "\n".join(str(value) for value in answers.values())
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    return "\n".join(part.get("text", "") for part in content or [] if isinstance(part, dict) and part.get("type") == "text")

latest = ""
for entry in reversed(entries):
    text = text_of(entry).strip()
    if text and not text.startswith(MARKERS):
        latest = text
        break

if not DENIED.search(latest):
    for clause in re.split(r"(?<=[.!?？])\s+|\n", latest):
        found = REQUEST.search(clause)
        if found:
            rest = clause[found.end():]
            if re.match(r"^하고(?:\s|$)", rest) or (
                not QUESTION_ENDING.search(clause[found.start():])
                and (APPROVAL_ENDING.match(rest) or found.group().endswith("기억해")
                     or found.group().lower().startswith(("remember ", "잊지")))
            ):
                sys.exit(0)

sys.stderr.write(
    "차단: 사용자가 요청하지 않은 메모리 저장입니다. 가장 최근 사용자 메시지에 메모리 저장·업데이트 요청이 없습니다.\n"
    "방침은 대화 안에서 지키고 작업 상태는 STATUS·HANDOFF에 적으세요. 저장이 필요하면 사용자에게 먼저 요청하세요.\n"
)
sys.exit(2)
'
