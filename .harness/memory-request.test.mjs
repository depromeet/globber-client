// 메모리 저장 차단 훅과 격리 스폰 차단 메시지 검사
// 실행: node --test .harness/memory-request.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const H = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// pre-commit 안에서는 GIT_DIR 등이 설정돼 임시 저장소 대신 실제 저장소를 가리키므로 제거
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const memory = "/home/u/.claude/projects/-p/memory/a.md";
const user = text => ({ type: "user", message: { content: text } });

const check = (entries, extra = {}) => {
  const tmp = mkdtempSync(join(tmpdir(), "memory-request-"));

  try {
    const transcript = join(tmp, "transcript.jsonl");

    writeFileSync(transcript, entries.map(entry => JSON.stringify(entry)).join("\n"));

    return spawnSync("sh", [join(H, ".claude/hooks/require-memory-request.sh")], {
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: memory, content: "x" },
        transcript_path: transcript,
        ...extra,
      }),
      encoding: "utf8",
      env,
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

test("메모리 저장 훅이 최신 사용자 메시지에 요청이 없으면 차단하고 요청 표현이 있으면 허용한다", () => {
  assert.equal(check([user("이어서 작업해")]).status, 2);
  assert.match(check([user("이어서 작업해")]).stderr, /요청하지 않은 메모리 저장/);
  assert.equal(check([user("메모리 업데이트하고 훅으로 강제할 수 있는지 검토 후 보고해")]).status, 0);
  assert.equal(check([user("이거 기억해")]).status, 0);
  assert.equal(check([user("이어서"), user("메모리 업데이트해")]).status, 0);
  assert.equal(check([user("메모리 업데이트해"), user("이어서 작업해")]).status, 2);
});

test("메모리 저장 훅이 동사 없는 기억 언급과 부정 표현을 요청으로 보지 않는다", () => {
  assert.equal(check([user("방침 기억은 지시한 적 없는데?")]).status, 2);
  assert.equal(check([user("메모리에 저장하지 마")]).status, 2);
});

test("메모리 저장 훅이 작업 중 들어온 메시지와 질문 창 답변을 최신 사용자 메시지로 읽고 알림은 건너뛴다", () => {
  assert.equal(
    check([user("이어서"), { type: "attachment", attachment: { type: "queued_command", prompt: "메모리 업데이트해" } }])
      .status,
    0
  );
  assert.equal(
    check([
      user("이어서"),
      {
        type: "user",
        toolUseResult: { answers: { q: "메모리에만 업데이트" } },
        message: { content: [{ type: "tool_result", content: "x" }] },
      },
    ]).status,
    0
  );
  assert.equal(
    check([user("메모리 업데이트해"), { type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } }])
      .status,
    0
  );
  assert.equal(check([user("메모리 업데이트해"), user("<system-reminder>알림</system-reminder>")]).status, 0);
});

test("메모리 저장 훅이 메모리 폴더 밖 쓰기와 읽기, subagent, 읽지 못한 기록은 막지 않는다", () => {
  const plain = [user("이어서 작업해")];

  assert.equal(check(plain, { tool_input: { file_path: "/repo/src/a.ts", content: "x" } }).status, 0);
  assert.equal(
    check(plain, { tool_name: "Bash", tool_input: { command: "cat /home/u/.claude/projects/-p/memory/MEMORY.md" } })
      .status,
    0
  );
  assert.equal(check(plain, { agent_id: "a1" }).status, 0);
  assert.equal(check(plain, { transcript_path: "/nonexistent/transcript.jsonl" }).status, 0);
  assert.equal(
    check(plain, {
      tool_name: "Bash",
      tool_input: { command: "cat >> /home/u/.claude/projects/-p/memory/MEMORY.md <<EOF\nx\nEOF" },
    }).status,
    2
  );
});

test("격리 스폰 훅이 미커밋 변경으로 막을 때 질문 창으로 커밋 범위를 요청하라고 안내한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "isolation-message-"));

  try {
    spawnSync("git", ["init", "-q"], { cwd: fixture, env });
    mkdirSync(join(fixture, ".claude", "agents"), { recursive: true });
    writeFileSync(
      join(fixture, ".claude", "agents", "implementer.md"),
      "---\nname: implementer\ntools: Read, Edit, Bash\n---\n"
    );
    spawnSync("git", ["add", "-A"], { cwd: fixture, env });
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"], { cwd: fixture, env });
    writeFileSync(join(fixture, "dirty.txt"), "changed");

    const result = spawnSync("sh", [join(H, ".claude/hooks/require-isolation-when-dirty.sh")], {
      cwd: fixture,
      input: JSON.stringify({ tool_input: { subagent_type: "implementer", isolation: "worktree" } }),
      encoding: "utf8",
      env: { ...env, CLAUDE_PROJECT_DIR: fixture },
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /AskUserQuestion/);
    assert.match(result.stderr, /계획을 바꾸지/);
    assert.doesNotMatch(result.stderr, /itd-commit/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
