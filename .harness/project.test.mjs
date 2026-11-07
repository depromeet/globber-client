import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("동기화 이벤트 없이 프로젝트 전용 설정을 보존한다", () => {
  for (const path of [".claude/settings.json", ".codex/hooks.json"]) {
    const hooks = JSON.parse(read(path)).hooks;
    assert.equal(hooks.SessionStart, undefined);
    assert.doesNotMatch(JSON.stringify(hooks), /sync\.sh|auto-format\.sh/);
  }
  for (const path of [".harness/sync.sh", ".harness/lock.json", ".harness/upstream.json"])
    assert.equal(existsSync(new URL("../" + path, import.meta.url)), false);
  assert.match(read(".codex/config.toml"), /@playwright\/mcp@0\.0\.84/);
  assert.match(read(".claude/agents/qa-engineer.md"), /mobile-qa/);
  assert.match(read(".agents/skills/task-team-orchestrator/SKILL.md"), /artifacts\/task-team\/\{run id\}/);
});

test("Codex 패치 입력 형식이 달라도 소스 위반을 차단한다", () => {
  const patch = '*** Begin Patch\n*** Add File: src/example.ts\n+export const text = "bad — text";\n*** End Patch';
  for (const tool_input of [patch, { command: patch }, { patch }, { input: patch }]) {
    const result = spawnSync(
      process.execPath,
      [new URL("../.codex/hooks/codex-tool-adapter.mjs", import.meta.url).pathname, "block-em-dash-in-source"],
      {
        input: JSON.stringify({ tool_name: "functions.apply_patch", tool_input }),
        encoding: "utf8",
      }
    );
    assert.equal(result.status, 2, result.stderr);
  }
});

test("실행별 리뷰 경로에도 CodeRabbit 누락 검사를 적용한다", () => {
  for (const side of [".claude", ".codex"]) {
    const run = content =>
      spawnSync("sh", [new URL(`../${side}/hooks/require-coderabbit-run.sh`, import.meta.url).pathname], {
        input: JSON.stringify({
          tool_name: "Write",
          tool_input: {
            file_path: "artifacts/task-team/GLB-107/code-review-1.md",
            content,
          },
        }),
        encoding: "utf8",
      });
    assert.equal(run("# 리뷰 완료").status, 2);
    assert.equal(run("## CodeRabbit 교차검토\n미실행: 인증 실패").status, 0);
    assert.equal(run("## CodeRabbit 교차검토\n미실행: 생략").status, 2);
  }
});

test("Claude 응답 판정은 거부·허용·판정기 실패와 재응답을 구분한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "globber-response-judge-"));
  const judge = join(fixture, "judge");
  const run = (verdict, active = false) => {
    writeFileSync(judge, `#!/bin/sh\nprintf '%s' '${verdict}'\n`);
    chmodSync(judge, 0o700);
    const result = spawnSync("sh", [new URL("../.claude/hooks/judge-unverified-claims.sh", import.meta.url).pathname], {
      input: JSON.stringify({
        session_id: verdict,
        last_assistant_message: "검사 결과입니다.",
        stop_hook_active: active,
      }),
      encoding: "utf8",
      env: { ...process.env, TMPDIR: fixture, STOP_JUDGE_BIN: judge },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    assert.equal(JSON.parse(run('{"ok":false,"reason":"확인 근거 필요"}')).decision, "block");
    assert.equal(run('{"ok":true}'), "");
    assert.equal(run("판정 오류"), "");
    assert.equal(run('{"ok":false}', true), "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
