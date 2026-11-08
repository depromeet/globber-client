// 판정 CLI는 고정 응답으로 대체하고 실제 훅과 Codex 패치 어댑터를 실행한다.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

for (const side of [".claude", ".codex"]) {
  test(`${side} 질문에 답하기 전 수정은 차단하고 읽기·답변 완료·판정기 실패는 허용한다`, t => {
    const dir = mkdtempSync(join(tmpdir(), "globber-answer-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const transcript = join(dir, "transcript.jsonl");
    const judge = join(dir, "judge");
    writeFileSync(
      transcript,
      JSON.stringify({ type: "user", uuid: "u1", message: { content: "왜 실패했어?" } }) + "\n"
    );
    const run = (event, tool, verdict, session = tool) => {
      writeFileSync(judge, `#!/bin/sh\ncat >/dev/null\nprintf '%s' '${verdict}'\n`);
      chmodSync(judge, 0o700);
      const result = spawnSync("sh", [resolve(side, "hooks/require-answer-before-edit.sh")], {
        input: JSON.stringify({
          hook_event_name: event,
          tool_name: tool,
          session_id: session,
          transcript_path: transcript,
          tool_input: { command: "cat a.md" },
          last_assistant_message: "기록했습니다.",
        }),
        encoding: "utf8",
        env: { ...process.env, TMPDIR: dir, STOP_JUDGE_BIN: judge },
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim() ? JSON.parse(result.stdout) : null;
    };
    const unanswered = '{"unanswered":"왜 실패했어?"}';
    assert.equal(run("PreToolUse", "Edit", unanswered).hookSpecificOutput.permissionDecision, "deny");
    assert.equal(run("PreToolUse", "Bash", unanswered), null);
    assert.equal(run("PreToolUse", "Edit", '{"unanswered":null}'), null);
    assert.equal(run("PreToolUse", "Write", "broken"), null);
    assert.equal(run("Stop", "Stop", unanswered).decision, "block");
    assert.equal(run("Stop", "Stop", unanswered), null);
  });
  test(`${side} 실행 예고만 남기는 종료와 대기 조건을 구분한다`, () => {
    const run = (message, active = false) => {
      const result = spawnSync("sh", [resolve(side, "hooks/require-execution-for-declared-step.sh")], {
        input: JSON.stringify({ last_assistant_message: message, stop_hook_active: active }),
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim() ? JSON.parse(result.stdout).decision : null;
    };
    assert.equal(run("구현을 시작합니다."), "block");
    assert.equal(run("승인하시면 진행하겠습니다."), null);
    assert.equal(run("구현을 완료했습니다."), null);
    assert.equal(run("구현을 시작합니다.", true), null);
    assert.equal(run("> 구현을 시작합니다.\n\n인용한 문장입니다."), null);
  });
}

test("새 응답 훅을 양쪽 설정의 수정 전·종료 시점에 등록한다", () => {
  for (const file of [".claude/settings.json", ".codex/hooks.json"]) {
    const { hooks } = JSON.parse(readFileSync(file, "utf8"));
    for (const event of ["PreToolUse", "Stop"]) {
      assert.ok(hooks[event].some(group => group.hooks.some(h => h.command.includes("require-answer-before-edit"))));
    }
    assert.ok(
      hooks.Stop.some(group => group.hooks.some(h => h.command.includes("require-execution-for-declared-step")))
    );
  }
});
