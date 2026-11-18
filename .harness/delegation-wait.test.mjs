import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const hook = join(root, ".codex/hooks/delegation-wait.py");
const fixture = run => {
  const dir = mkdtempSync(join(tmpdir(), "codex-wait-"));
  const call = (event, extra = {}) => {
    const result = spawnSync("python3", [hook], {
      input: JSON.stringify({
        session_id: "parent",
        transcript_path: "/parent.jsonl",
        hook_event_name: event,
        ...extra,
      }),
      encoding: "utf8",
      env: { ...process.env, CODEX_DELEGATION_WAIT_DIR: dir },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim() ? JSON.parse(result.stdout) : null;
  };
  const start = () => {
    call("PreToolUse", { tool_name: "collaboration.spawn_agent", tool_input: { task_name: "worker" } });
    call("SubagentStart", { agent_id: "a1" });
  };
  try {
    run(call, start);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("Codex 대기 훅은 등록된 실제 스크립트로 메인의 중복 도구만 차단", () =>
  fixture((call, start) => {
    assert.equal(call("PreToolUse", { tool_name: "Bash" }), null);
    start();
    for (const tool of ["Bash", "apply_patch", "collaboration.list_agents", "mcp__files__read", "functions.exec"])
      assert.equal(call("PreToolUse", { tool_name: tool }).hookSpecificOutput.permissionDecision, "deny");
    for (const tool of [
      "collaboration.wait_agent",
      "collaborationwait_agent",
      "collaboration.send_message",
      "functions.wait",
      "collaboration.interrupt_agent",
    ])
      assert.equal(call("PreToolUse", { tool_name: tool }), null);
    assert.equal(call("PreToolUse", { tool_name: "Bash", transcript_path: "/child.jsonl" }), null);
    assert.equal(call("PreToolUse", { tool_name: "Bash", agent_id: "a1" }), null);
    assert.equal(call("PreToolUse", { tool_name: "Bash", session_id: "other" }), null);
  }));

test("작업자 여러 명의 종료와 기존 작업자 재개를 구분", () =>
  fixture((call, start) => {
    start();
    call("SubagentStart", { agent_id: "a2" });
    call("SubagentStop", { agent_id: "a1" });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }).hookSpecificOutput.permissionDecision, "deny");
    call("SubagentStop", { agent_id: "a2" });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }), null);
    call("PreToolUse", { tool_name: "collaboration.followup_task", tool_input: { target: "/root/worker" } });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }).hookSpecificOutput.permissionDecision, "deny");
    call("SubagentStop", { agent_id: "a1" });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }), null);
  }));

test("새 사용자 지시는 허용하고 자동 작업자 보고로 제한을 해제하지 않음", () =>
  fixture((call, start) => {
    start();
    call("UserPromptSubmit", { prompt: "<agent-message>완료</agent-message>" });
    call("UserPromptSubmit", { prompt: "<hook_prompt>다시 확인</hook_prompt>" });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }).hookSpecificOutput.permissionDecision, "deny");
    call("UserPromptSubmit", { prompt: "다른 문제를 먼저 확인해줘" });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }), null);
    call("PreToolUse", { tool_name: "spawn_agent", tool_input: { task_name: "next" } });
    assert.equal(call("PreToolUse", { tool_name: "Bash" }).hookSpecificOutput.permissionDecision, "deny");
    call("SessionEnd");
    assert.equal(call("PreToolUse", { tool_name: "Bash" }), null);
  }));

test("Codex 전용 생명주기 등록과 Claude 미등록을 확인", () => {
  const config = JSON.parse(readFileSync(join(root, ".codex/hooks.json"), "utf8"));
  for (const event of ["PreToolUse", "SubagentStart", "SubagentStop", "UserPromptSubmit", "SessionEnd"])
    assert.ok(
      config.hooks[event].some(group => group.hooks.some(entry => entry.command.includes("delegation-wait.py")))
    );
  assert.ok(!readFileSync(join(root, ".claude/settings.json"), "utf8").includes("delegation-wait.py"));
});
