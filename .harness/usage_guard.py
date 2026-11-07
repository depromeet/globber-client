"""모델 호출 없이 문맥·위임·검증 중복을 제한하는 Claude/Codex 훅."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import time

LIMIT = 16000
READERS = {"cat", "head", "tail", "sed", "rg", "grep", "Read", "read_file"}


def tool_name(data):
    # MCP의 서버·도구 경계를 보존하고 로컬 도구 namespace만 정규화한다.
    name = data.get("tool_name", "")
    if name.startswith("mcp__"):
        return name
    name = re.split(r"\.|__", name)[-1]
    for prefix in ("collaboration", "functions"):
        suffix = name.removeprefix(prefix)
        if name.startswith(prefix) and suffix in {"spawn_agent", "wait_agent", "list_agents", "interrupt_agent", "followup_task", "send_message", "exec_command", "write_stdin", "Read", "read_file", "Grep", "Glob"}:
            return suffix
    return name


def actor_key(data):
    # Codex 자식 훅도 부모 session_id를 쓰므로 실제 transcript를 실행 주체로 구분한다.
    transcript = data.get("transcript_path")
    identity = data.get("agent_id") or (str(Path(transcript).resolve()) if transcript else "root")
    return str(data.get("session_id", "")) + ":" + identity


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.DEVNULL)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def report_seen(data, marker):
    # transcript는 안정 API가 아니므로 인식하지 못하면 보고 확인을 요구한다.
    path = data.get("transcript_path")
    if not path:
        return False
    with open(path, "rb") as source:
        source.seek(max(0, os.fstat(source.fileno()).st_size - 131072))
        lines = source.read().decode("utf-8", errors="replace").splitlines()
    for line in lines:
        try:
            record = json.loads(line)
        except ValueError:
            continue
        if not isinstance(record, dict):
            continue
        message = record.get("message", record.get("payload", record))
        if not isinstance(message, dict):
            continue
        if message.get("role") == "assistant":
            content = message.get("content", [])
            if isinstance(content, list):
                text = "\n".join(c.get("text", "") for c in content
                                 if isinstance(c, dict) and c.get("type") in ("text", "output_text"))
                if marker in text:
                    return True
        if record.get("type") == "event_msg" and message.get("type") == "agent_message":
            if marker in message.get("message", ""):
                return True
    return False


def reported_plan(data, task_name):
    """암호화된 도구 본문 대신 같은 작업의 사전 보고에서 계획을 확인한다."""
    path = data.get("transcript_path")
    if not path or not task_name:
        return None
    with open(path, "rb") as source:
        source.seek(max(0, os.fstat(source.fileno()).st_size - 131072))
        lines = source.read().decode("utf-8", errors="replace").splitlines()
    for line in reversed(lines):
        try:
            record = json.loads(line)
        except ValueError:
            continue
        message = record.get("payload", record.get("message", record))
        if not isinstance(message, dict):
            continue
        texts = []
        if message.get("role") == "assistant":
            texts = [c.get("text", "") for c in message.get("content", [])
                     if isinstance(c, dict) and c.get("type") in ("text", "output_text")]
        elif record.get("type") == "event_msg" and message.get("type") == "agent_message":
            texts = [message.get("message", "")]
        for text in texts:
            for match in re.finditer(r"(?:^|\n)USAGE_PLAN (\{[^\n]+\})", text):
                try:
                    plan = json.loads(match[1])
                except ValueError:
                    continue
                if plan.get("task_name") == task_name:
                    return plan
    return None


def text_response(value):
    """이미지 전송 데이터는 문서 텍스트 사용량에 포함하지 않는다."""
    if isinstance(value, list):
        return [text_response(item) for item in value]
    if not isinstance(value, dict):
        return value
    image = value.get("type") in ("image", "image_url", "input_image", "output_image")
    result = {}
    for key, item in value.items():
        if image and key in ("data", "url", "image_url", "b64_json"):
            result[key] = "[image]"
        elif key == "image_url" and isinstance(item, str) and item.startswith("data:image/"):
            result[key] = "[image]"
        else:
            result[key] = text_response(item)
    return result


def fingerprint(root):
    paths = set(git(root, "ls-files", "-z").split(b"\0"))
    paths.update(git(root, "ls-files", "--others", "--exclude-standard", "-z", "--",
                     "src", "tests", ".harness", "package.json", "pnpm-lock.yaml").split(b"\0"))
    result = hashlib.sha256(git(root, "rev-parse", "HEAD"))
    for name in sorted(paths - {b""}):
        path = root / os.fsdecode(name)
        result.update(name + b"\0")
        if path.is_file():
            result.update(path.read_bytes())
        else:
            result.update(b"missing")
    return result.hexdigest()


def response_ok(response):
    if not isinstance(response, dict):
        return False
    if response.get("isError") or response.get("interrupted"):
        return False
    code = response.get("exit_code", response.get("exitCode"))
    if code is not None:
        return code == 0
    text = json.dumps(response, ensure_ascii=False)
    return bool(re.search(r"(?:Process exited with code\s+|exit_code[\"\s:]+)0\b", text))


def normalized_response(response):
    if isinstance(response, str):
        try:
            value = json.loads(response)
            if isinstance(value, dict):
                return value
        except ValueError:
            pass
        return {"output": response}
    if isinstance(response, dict) and isinstance(response.get("content"), list):
        texts = [c.get("text", "") for c in response["content"] if isinstance(c, dict) and c.get("type") == "text"]
        if len(texts) == 1:
            parsed = normalized_response(texts[0])
            return {**response, **parsed}
    return response


def test_scope(command):
    unit = re.search(r"\b(?:(?:pnpm|npm)\s+(?:run\s+)?test\b|vitest\s+(?:run\b|--run\b))([^;&|\n]*)", command)
    if unit and not unit.group(1).startswith(":"):
        # 폴더·옵션이 붙은 실행을 전체 성공으로 기록하면 실제 전체 검사를 잘못 생략한다.
        return "unit:all" if not unit.group(1).strip() else command
    if re.search(r"(?:\bnode\s+--test\b|\bplaywright\s+test\b|\bpnpm\s+(?:run\s+)?(?:typecheck|lint|test:e2e)\b)", command):
        return re.sub(r"\s+", " ", command.strip())
    return None


def shell_code(command):
    lines, delimiter = [], None
    for line in command.splitlines():
        if delimiter is not None:
            if line.lstrip("\t") == delimiter:
                delimiter = None
            continue
        lines.append(line)
        match = re.search(r"<<-?\s*(['\"])([A-Za-z_][A-Za-z_0-9]*)\1", line)
        if match and not re.search(r"(?:^|[;&|])\s*(?:bash|sh|zsh|dash)\b", line):
            delimiter = match[2]
    return "\n".join(lines)


def read_request(data, root):
    name = tool_name(data)
    args = data.get("tool_input", {})
    if not isinstance(args, dict):
        raise ValueError("tool_input은 객체여야 합니다.")
    command = args.get("command", args.get("cmd", ""))
    if name in ("Bash", "exec_command"):
        command = shell_code(command)
        try:
            tokens = shlex.split(command)
        except ValueError:
            return [], command
        if not any(Path(t).name in READERS for t in tokens):
            return [], command
        # shortcut: 정적 셸 인자만 판독한다. 동적 코드·변수·래퍼까지 통제하려면 전용 읽기 도구가 필요하다.
        candidates = [t for t in tokens if t and not t.startswith("-")]
        spec = command
        base = Path(args.get("cwd", args.get("workdir", data.get("cwd", root))))
    elif name in ("Read", "read_file", "Grep", "Glob"):
        candidates = [args.get("file_path", args.get("path", "."))]
        spec = json.dumps({"offset": args.get("offset"), "limit": args.get("limit")}, sort_keys=True)
        base = Path(data.get("cwd", root))
    else:
        return [], ""
    paths = []
    for candidate in candidates:
        path = (base / candidate).resolve()
        if path.exists() and path not in paths:
            paths.append(path)
    return [(p, digest(p.read_bytes()) if p.is_file() else None, spec) for p in paths], command


def settle_pending(state, key, response, root, failed=False):
    pending = state["pending"].pop(key, None)
    if not pending:
        return
    if not failed:
        for read in pending["reads"]:
            state["reads"][read] = True
    test = pending["test"]
    if test and test in state["tests"]:
        if not failed and pending["snapshot"] == fingerprint(root):
            state["tests"][test]["success"] = True
        else:
            state["tests"].pop(test, None)


def refresh_pending(data, actor, root, state):
    # Bash 훅에 없는 종료 코드는 결과가 transcript에 기록된 다음 호출에서 확인한다.
    path = data.get("transcript_path")
    waiting = {k: v for k, v in state["pending"].items()
               if k.startswith(actor + ":") and (v.get("awaiting_output") or v.get("spawn"))}
    if not path or not waiting:
        return
    with open(path, "rb") as source:
        source.seek(max(0, os.fstat(source.fileno()).st_size - 262144))
        lines = source.read().decode(errors="replace").splitlines()
    for line in lines:
        try:
            item = json.loads(line).get("payload", {})
        except (ValueError, AttributeError):
            continue
        if isinstance(item, dict) and item.get("type") == "item_completed":
            execution = item.get("item", {})
            key = actor + ":" + str(execution.get("id", ""))
            if key in waiting and execution.get("type") == "CommandExecution" and execution.get("exit_code") is not None:
                settle_pending(state, key, execution, root, failed=execution["exit_code"] != 0)
            continue
        if not isinstance(item, dict) or item.get("type") not in ("function_call_output", "custom_tool_call_output"):
            continue
        key = actor + ":" + str(item.get("call_id", ""))
        output = item.get("output", "")
        if key in waiting and waiting[key].get("spawn"):
            response = normalized_response(output)
            child = response.get("agent_id") if isinstance(response, dict) else None
            for ident, agent in list(state["agents"].items()):
                if agent["call"] == key:
                    if child:
                        agent["agent_id"] = child
                    else:
                        del state["agents"][ident]
            state["pending"].pop(key, None)
            continue
        if key in waiting and isinstance(output, str) and re.search(r"Process exited with code \d+", output):
            settle_pending(state, key, {"output": output}, root, failed=not response_ok({"output": output}))


def run(data, platform, root, state):
    event = data.get("hook_event_name")
    session = str(data.get("session_id", ""))
    if not session:
        raise ValueError("session_id가 없어 사용량 상태를 구분할 수 없습니다.")
    args = data.get("tool_input", {})
    actor = actor_key(data)
    tool = tool_name(data)
    call = str(data.get("tool_use_id", ""))
    now = time.time()
    state.setdefault("reads", {})
    state.setdefault("agents", {})
    state.setdefault("pending", {})
    state.setdefault("tests", {})
    state.setdefault("transports", {})
    if event in ("PreToolUse", "SessionEnd"):
        refresh_pending(data, actor, root, state)
    if event == "SessionEnd":
        state["agents"] = {k: a for k, a in state["agents"].items() if a["owner"] != session}
        return None
    if event == "SubagentStart":
        candidates = [a for a in state["agents"].values()
                      if a["owner"] == session and a["agent_id"] is None]
        if len(candidates) == 1:
            candidates[0]["agent_id"] = data.get("agent_id")
        return {}
    if event == "SubagentStop":
        child = data.get("agent_id")
        if child and data.get("agent_transcript_path"):
            child_data = {**data, "transcript_path": data["agent_transcript_path"]}
            refresh_pending(child_data, actor_key(child_data), root, state)
        state["agents"] = {k: a for k, a in state["agents"].items()
                           if not (child and a["agent_id"] == child and a["owner"] == session)}
        return {}
    reads, command = read_request(data, root)
    spawn = tool in ("spawn_agent", "Agent")
    pending_key = actor + ":" + call
    if event == "PreToolUse":
        if platform == "codex" and spawn:
            if any(a["owner"] == session and a["agent_id"] is None for a in state["agents"].values()):
                raise ValueError("앞선 작업자의 시작 ID 확인 후 다음 위임을 순서대로 실행하세요.")
            if args.get("fork_turns") != "none":
                raise ValueError('전체 대화 상속 금지: fork_turns: "none"을 명시하세요.')
            message = args.get("message", args.get("prompt", ""))
            encrypted = re.fullmatch(r"gAAAA[A-Za-z0-9_=-]{80,}", message)
            if not encrypted and len(message) > 6000:
                raise ValueError("위임문은 6,000자 이내의 결정·경로·담당 범위로 줄이세요.")
            match = re.match(r"USAGE_PLAN (\{[^\n]+\})\n", message)
            if match:
                plan = json.loads(match[1])
            elif encrypted:
                plan = reported_plan(data, args.get("task_name"))
                if plan is None:
                    raise ValueError("암호화된 위임 본문: 같은 task_name의 USAGE_PLAN을 사용자 사전 보고에 포함하세요.")
            else:
                raise ValueError('위임문 첫 줄에 USAGE_PLAN {"id":"고유ID","paths":["담당/경로"]}를 넣으세요.')
            ident = plan.get("id", "")
            if (not isinstance(ident, str) or not re.fullmatch(r"[\w-]{1,60}", ident)
                    or not isinstance(plan.get("paths"), list) or not plan["paths"]
                    or not all(isinstance(p, str) and p for p in plan["paths"])):
                raise ValueError("계획 ID와 담당 경로가 필요합니다.")
            paths = []
            for p in plan["paths"]:
                target = (root / p).resolve()
                if not target.is_relative_to(root) or target == root:
                    raise ValueError("담당 경로는 저장소 안의 구체적인 경로로 지정하세요.")
                paths.append(str(target))
            if not report_seen(data, "사용량 계획 " + ident + ":"):
                raise ValueError("에이전트 추가 전 '사용량 계획 " + ident + ": 역할·담당 경로·검증 시점·추가 이유'를 사용자에게 보고하세요.")
            if ident in state["agents"]:
                raise ValueError("이미 사용 중인 계획 ID입니다. 기존 에이전트를 재사용하세요.")
            state["agents"][ident] = {"owner": session, "owner_actor": actor, "paths": paths, "call": pending_key, "agent_id": None}
        if platform == "codex":
            active = [a for a in state["agents"].values()
                      if a.get("owner_actor", a["owner"]) == actor
                      and not (data.get("agent_id") and data["agent_id"] == a["agent_id"])]
            for path, _, _ in reads:
                if any(path == Path(p) or path.is_relative_to(p) or Path(p).is_relative_to(path)
                       for a in active for p in a["paths"]):
                    raise ValueError("위임 중인 경로의 메인 재탐색 금지: 에이전트 반환 후 검토하세요.")
            if active and test_scope(command):
                raise ValueError("위임 중 메인 검증 중복 금지: 에이전트 반환 후 검증을 모아 실행하세요.")
        for path, file_hash, spec in reads:
            if file_hash is None:
                continue
            key = digest((actor + str(path) + file_hash + spec).encode())
            if key in state["reads"]:
                raise ValueError("변경 없는 동일 범위 재열람 금지: 기존 결과를 사용하거나 필요한 범위를 지정하세요.")
            if any(key in p["reads"] for p in state["pending"].values() if p.get("awaiting_output")):
                raise ValueError("앞선 읽기의 종료 상태가 아직 확인되지 않았습니다. 기록이 있는 세션에서 완료 결과를 확인하세요.")
        reading = bool(reads) or (tool in ("Bash", "exec_command") and
                                 re.search(r"(?:^|[;&|\n])\s*(?:cat|head|tail|sed|rg|grep)\b", command))
        if reading and re.search(r"(?:handoff|HANDOFF|STATUS)\b", command) and ("*" in command or len(reads) > 1):
            raise ValueError("과거 인계 문서 일괄 출력 금지: 현재 작업의 필요한 파일만 읽으세요.")
        scope = test_scope(command) if platform == "codex" else None
        if scope:
            if scope == "unit:all" and not any(report_seen(data, "사용량 검증 단계: " + stage) for stage in ("완료 후", "병합 후")):
                raise ValueError("전체 테스트 전 '사용량 검증 단계: 완료 후 또는 병합 후, 실행 이유'를 보고하세요.")
            snapshot = fingerprint(root)
            key = digest((scope + snapshot).encode())
            record = state["tests"].get(key)
            if record and (record.get("success") or now - record["at"] < 3600):
                raise ValueError("같은 파일 상태에서 이미 성공했거나 실행 중인 검사입니다. 변경·실패·병합 후 재실행하세요.")
            state["tests"][key] = {"at": now, "success": False}
        else:
            key, snapshot = None, None
        if call:
            state["pending"][pending_key] = {"reads": [digest((actor + str(p) + h + s).encode()) for p, h, s in reads if h is not None],
                                             "test": key, "snapshot": snapshot, "spawn": spawn}
        return None
    if event not in ("PostToolUse", "PostToolUseFailure"):
        return None
    original_response = data.get("tool_response", {})
    response = normalized_response(original_response)
    failed = event == "PostToolUseFailure" or (isinstance(response, dict) and response.get("isError"))
    if platform == "codex":
        if spawn:
            agent_id = (response.get("agent_id") or response.get("agent_name")) if isinstance(response, dict) else None
            for ident, agent in list(state["agents"].items()):
                if agent["call"] == pending_key:
                    if failed or (isinstance(response, dict) and response.get("error")):
                        del state["agents"][ident]
                    elif agent_id:
                        agent["agent_id"] = agent_id
        # 완료 상태만으로 해제하며 단순 폴링·interrupt로는 해제하지 않는다.
        if tool in ("wait", "wait_agent", "close_agent") and isinstance(response, dict):
            statuses = response.get("status", {})
            if isinstance(statuses, dict):
                done = {k for k, v in statuses.items() if isinstance(v, dict) and any(s in v for s in ("completed", "errored", "shutdown"))}
                state["agents"] = {k: a for k, a in state["agents"].items() if a["agent_id"] not in done}
    # 실행 중인 unified-exec는 나중의 완료 이벤트까지 검사 예약을 유지한다.
    if isinstance(response, dict):
        running = re.search(r"Process running with session ID (\d+)", response.get("output", ""))
        transport = response.get("session_id") or (running.group(1) if running else None)
        if transport and not response_ok(response):
            state["transports"][str(transport)] = pending_key
            return None
    if tool == "write_stdin":
        pending_key = state["transports"].pop(str(args.get("session_id")), pending_key)
    pending = state["pending"].get(pending_key)
    if pending:
        claude_shell_ok = (platform == "claude" and isinstance(response, dict)
                           and response.get("interrupted") is False
                           and "exit_code" not in response and "exitCode" not in response)
        known_exit = isinstance(response, dict) and ("exit_code" in response or "exitCode" in response)
        if tool in ("Bash", "exec_command") and not (failed or known_exit or response_ok(response) or claude_shell_ok):
            pending["awaiting_output"] = True
        else:
            success = not failed and (tool not in ("Bash", "exec_command") or response_ok(response) or claude_shell_ok)
            settle_pending(state, pending_key, response, root, failed=not success)
    # 편집 도구 응답은 입력 내용을 되돌려 줄 뿐 모델에 보이는 출력이 아니다.
    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit", "apply_patch"):
        return None
    raw = json.dumps(text_response(original_response), ensure_ascii=False)
    if len(raw) > LIMIT:
        notice = "출력 16,000자 초과: 필요한 파일·행 범위를 지정해 다시 읽으세요."
        if platform == "codex":
            return {"decision": "block", "reason": notice}
        replacement = original_response.copy() if isinstance(original_response, dict) else None
        if replacement is not None and "stdout" in replacement:
            replacement["stdout"] = notice
            if "stderr" in replacement:
                replacement["stderr"] = ""
        elif replacement is not None and "file" in replacement and isinstance(replacement["file"], dict):
            replacement["file"] = {**replacement["file"], "content": notice}
        elif data.get("tool_name", "").startswith("mcp__"):
            replacement = {"content": [{"type": "text", "text": notice}]}
        else:
            return {"systemMessage": notice + " 이 도구의 출력 형식은 교체 미지원입니다."}
        return {"hookSpecificOutput": {"hookEventName": "PostToolUse", "updatedToolOutput": replacement}}
    return None


def main():
    data = json.load(sys.stdin)
    if not isinstance(data, dict):
        raise ValueError("훅 입력은 객체여야 합니다.")
    platform = sys.argv[1]
    root = Path(git(Path(data.get("cwd", os.getcwd())), "rev-parse", "--show-toplevel").decode().strip()).resolve()
    common = git(root, "rev-parse", "--git-common-dir").decode().strip()
    directory = Path(tempfile.gettempdir()) / ("harness-usage-" + digest(str((root / common).resolve()).encode())[:20])
    directory.mkdir(mode=0o700, exist_ok=True)
    with open(directory / "lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = directory / "state.json"
        state = json.loads(path.read_text()) if path.exists() else {}
        try:
            output = run(data, platform, root, state)
        except (ValueError, OSError, TypeError, KeyError) as error:
            print("사용량 훅 차단: " + str(error), file=sys.stderr)
            return 2
        temporary = directory / "state.next"
        temporary.write_text(json.dumps(state, ensure_ascii=False))
        temporary.replace(path)
        if output is not None:
            print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, TypeError, KeyError, subprocess.SubprocessError) as error:
        print("사용량 훅 상태 오류: " + str(error), file=sys.stderr)
        sys.exit(2)
