#!/usr/bin/env python3
"""Codex 작업자가 실행 중이면 메인의 작업자 상태 폴링을 막는다."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile


def name_of(value):
    if value.startswith('mcp__'):
        return value
    value = re.split(r'\.|__', value)[-1]
    for prefix in ('collaboration', 'functions'):
        if value.startswith(prefix):
            value = value[len(prefix):]
    return value


def main():
    data = json.load(sys.stdin)
    event = data.get('hook_event_name')
    session = data.get('session_id')
    if not session:
        return
    key = hashlib.sha256(str(session).encode()).hexdigest()
    directory = Path(os.environ.get('CODEX_DELEGATION_WAIT_DIR', Path(tempfile.gettempdir()) / 'codex-delegation-wait'))
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (directory / (key + '.lock')).open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = directory / (key + '.json')
        state = json.loads(path.read_text()) if path.exists() else {'owner': None, 'active': [], 'suspended': False, 'aliases': {}, 'pending': None}
        tool = name_of(data.get('tool_name', ''))
        actor = data.get('agent_id') or data.get('transcript_path') or ('session:' + str(session))
        root = state['owner'] is not None and actor == state['owner']
        reason = None
        if event == 'SessionEnd':
            path.unlink(missing_ok=True)
            return
        if event == 'UserPromptSubmit':
            prompt = data.get('prompt', '')
            # 작업자 보고·자동 계속 프롬프트는 사용자 새 지시로 취급하지 않는다.
            if prompt.strip() and not re.match(r'\s*(?:<agent-message(?:\s|>)|Message Type: (?:MESSAGE|FINAL_ANSWER)|Another .* session sent a message|<hook_prompt\b)', prompt):
                state['suspended'] = True
        elif event == 'SubagentStart':
            agent = data.get('agent_id')
            if agent and agent not in state['active']:
                state['active'].append(agent)
            if agent and state['pending']:
                state['aliases'][state['pending']] = agent
                state['pending'] = None
        elif event == 'SubagentStop':
            agent = data.get('agent_id')
            state['active'] = [a for a in state['active'] if a != agent]
        elif event == 'PreToolUse':
            if tool in ('spawn_agent', 'Agent'):
                if state['owner'] is None and actor:
                    state['owner'] = actor
                    root = True
                if root:
                    state['suspended'] = False
                    state['pending'] = data.get('tool_input', {}).get('task_name')
            elif tool in ('followup_task', 'resume_agent') and root:
                target = data.get('tool_input', {}).get('target') or data.get('tool_input', {}).get('id')
                agent = state['aliases'].get(target, state['aliases'].get(str(target).rsplit('/', 1)[-1], target))
                if agent and agent not in state['active']:
                    state['active'].append(agent)
                state['suspended'] = False
            elif root and state['active'] and not state['suspended'] and tool == 'list_agents':
                reason = '작업자가 실행 중입니다. 상태 폴링 대신 wait_agent로 기다리세요. 독립 작업과 필요한 조율은 계속할 수 있습니다.'
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(state, ensure_ascii=False))
        os.replace(temp, path)
        if reason:
            print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny', 'permissionDecisionReason': reason}}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, TypeError) as error:
        print('Codex 대기 훅 상태 확인 실패: ' + str(error), file=sys.stderr)
        sys.exit(2)
