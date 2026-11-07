import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("usage_guard.py", import.meta.url));
function fixture(t, platform = "codex") {
  const root = mkdtempSync(join(tmpdir(), "usage-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture"
  );
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/a.txt"), "처음\n둘째\n");
  const transcript = join(root, "transcript.jsonl");
  writeFileSync(transcript, "");
  let serial = 0;
  const hook = (event, tool, input = {}, extra = {}) => {
    const result = spawnSync("python3", [script, platform], {
      input: JSON.stringify({
        cwd: root,
        session_id: "main",
        transcript_path: transcript,
        hook_event_name: event,
        tool_name: tool,
        tool_input: input,
        tool_use_id: String(serial),
        ...extra,
      }),
      encoding: "utf8",
    });
    assert.equal(result.error, undefined);
    return {
      code: result.status,
      message: result.stderr,
      output: result.stdout.trim() ? JSON.parse(result.stdout) : null,
    };
  };
  const pre = (tool, input, extra) => {
    serial++;
    return hook("PreToolUse", tool, input, extra);
  };
  const post = (tool, input, response, extra) =>
    hook("PostToolUse", tool, input, { tool_response: response, ...extra });
  const report = (text, role = "assistant") =>
    writeFileSync(
      transcript,
      JSON.stringify({
        type: "response_item",
        payload: {
          role,
          content: [{ type: "output_text", text }],
        },
      }) + "\n"
    );
  return { root, hook, pre, post, report, transcript, git };
}

test("Codex 전체 대화 상속과 생략은 차단하고 보고된 최소 위임만 허용한다", t => {
  const f = fixture(t);
  assert.equal(f.pre("spawn_agent", { fork_turns: "all" }).code, 2);
  assert.equal(f.pre("spawn_agent", {}).code, 2);
  const input = { fork_turns: "none", message: 'USAGE_PLAN {"id":"impl","paths":["src"]}\n이 경로를 구현한다.' };
  assert.equal(f.pre("spawn_agent", input).code, 2);
  f.report("사용량 계획 impl: 구현, src, 완료 후 검증", "user");
  assert.equal(f.pre("spawn_agent", input).code, 2);
  f.report("사용량 계획 impl: 구현, src, 완료 후 검증");
  assert.equal(f.pre("spawn_agent", input).code, 0);
  f.post("spawn_agent", input, { agent_id: "worker" });
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 2);
  assert.equal(f.pre("Bash", { command: "rg 처음 src" }).code, 2);
  assert.equal(f.pre("Grep", { path: "src", pattern: "처음" }).code, 2);
  assert.equal(f.pre("Bash", { command: "pnpm test" }).code, 2);
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }, { session_id: "worker" }).code, 0);
  f.post("wait", {}, { status: { worker: { completed: "완료" } } });
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 0);
});

test("실패한 위임은 예약을 해제하고 지나친 위임문과 외부 경로는 차단한다", t => {
  const f = fixture(t);
  f.report("사용량 계획 impl: 구현, src, 완료 후 검증");
  const input = { fork_turns: "none", message: 'USAGE_PLAN {"id":"impl","paths":["src"]}\n작업' };
  assert.equal(f.pre("spawn_agent", { ...input, message: input.message + "x".repeat(6000) }).code, 2);
  assert.equal(f.pre("spawn_agent", { ...input, message: input.message.replace('"src"', '"../"') }).code, 2);
  assert.equal(f.pre("spawn_agent", { ...input, message: input.message.replace('["src"]', '"src"') }).code, 2);
  assert.equal(f.pre("spawn_agent", input).code, 0);
  f.post("spawn_agent", input, { isError: true });
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 0);
});

for (const platform of ["codex", "claude"]) {
  test(`${platform} 성공한 동일 범위 재열람만 차단하고 변경·부분 읽기·다른 세션은 허용한다`, t => {
    const f = fixture(t, platform);
    const input = { file_path: "src/a.txt" };
    assert.equal(f.pre("Read", input).code, 0);
    f.post("Read", input, { file: { content: "처음\n둘째" } });
    assert.equal(f.pre("Read", input).code, 2);
    assert.equal(f.pre("Read", { ...input, offset: 2, limit: 1 }).code, 0);
    assert.equal(f.pre("Read", input, { session_id: "other" }).code, 0);
    writeFileSync(join(f.root, input.file_path), "수정\n");
    assert.equal(f.pre("Read", input).code, 0);
  });
  test(`${platform} 인계 문서 일괄 출력과 큰 출력을 제한한다`, t => {
    const f = fixture(t, platform);
    assert.equal(f.pre("Bash", { command: "cat artifacts/work/*/HANDOFF.md" }).code, 2);
    const result = f.post("Bash", {}, { stdout: "x".repeat(18000), stderr: "", interrupted: false });
    assert.equal(result.code, 0);
    assert.ok(JSON.stringify(result.output).length < 1000);
    if (platform === "claude") assert.ok(result.output.hookSpecificOutput.updatedToolOutput.stdout.includes("초과"));
    else assert.equal(result.output.decision, "block");
  });
}

test("Claude에는 Codex 전용 위임·검증 정책을 적용하지 않는다", t => {
  const f = fixture(t, "claude");
  assert.equal(f.pre("Agent", { prompt: "QA" }).code, 0);
  assert.equal(f.pre("Bash", { command: "pnpm test" }).code, 0);
});

test("실패한 읽기는 재시도할 수 있고 셸 성공 결과는 재열람을 막는다", t => {
  const f = fixture(t);
  const input = { command: "cat src/a.txt" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { exit_code: 1 });
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { exit_code: 0, output: "처음" });
  assert.equal(f.pre("Bash", input).code, 2);
});

test("Claude Bash의 성공 이벤트로 셸 재열람도 제한한다", t => {
  const f = fixture(t, "claude");
  const input = { command: "cat src/a.txt" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { stdout: "처음", stderr: "", interrupted: false });
  assert.equal(f.pre("Bash", input).code, 2);
});

test("전체 검증은 보고 후 한 번 실행하고 다른 주체·별칭의 중복도 차단한다", t => {
  const f = fixture(t);
  const input = { command: "pnpm test" };
  assert.equal(f.pre("Bash", input).code, 2);
  f.report("사용량 검증 단계: 완료 후, 전체 검증");
  assert.equal(f.pre("Bash", input).code, 0);
  assert.equal(f.pre("Bash", { command: "vitest run" }, { session_id: "worker" }).code, 2);
  // 원래 호출 ID를 써야 실행 중인 다른 호출을 성공으로 오인하지 않는다.
  const original = "2";
  f.post("Bash", input, { exit_code: 0 }, { tool_use_id: original });
  assert.equal(f.pre("Bash", { command: "vitest run" }).code, 2);
  writeFileSync(join(f.root, "src/a.txt"), "수정");
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { exit_code: 1 });
  assert.equal(f.pre("Bash", input).code, 0);
});

test("검사 중 변경과 비동기 실행을 성공으로 잘못 재사용하지 않는다", t => {
  const f = fixture(t);
  const input = { command: "node --test tests/a.test.mjs" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { session_id: 42, output: "실행 중" });
  assert.equal(f.pre("Bash", input).code, 2);
  writeFileSync(join(f.root, "src/a.txt"), "수정");
  f.post("Bash", input, { exit_code: 0 }, { tool_use_id: "1" });
  assert.equal(f.pre("Bash", input).code, 0);
});

test("문자열·MCP 결과와 비동기 완료를 원래 호출에 연결한다", t => {
  const f = fixture(t);
  const input = { command: "node --test tests/a.test.mjs" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, "Process running with session ID 42");
  assert.equal(f.pre("Bash", input).code, 2);
  f.post("write_stdin", { session_id: 42 }, { content: [{ type: "text", text: "Process exited with code 0" }] });
  assert.equal(f.pre("Bash", input).code, 2);
  f.git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--allow-empty",
    "-qm",
    "병합 후 상태 모사"
  );
  assert.equal(f.pre("Bash", input).code, 0);
});

test("검사 단계의 기준선 보고와 미지원 transcript는 전체 검사·위임을 허용하지 않는다", t => {
  const f = fixture(t);
  f.report("사용량 검증 단계: 기준선 검사");
  assert.equal(f.pre("Bash", { command: "pnpm test" }).code, 2);
  assert.equal(
    f.pre(
      "spawn_agent",
      { fork_turns: "none", message: 'USAGE_PLAN {"id":"impl","paths":["src"]}\n구현' },
      { transcript_path: undefined }
    ).code,
    2
  );
});

test("폴더 범위와 도움말 성공을 전체 검사 성공으로 재사용하지 않는다", t => {
  const f = fixture(t);
  const input = { command: "vitest run tests/components" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { exit_code: 0 });
  f.report("사용량 검증 단계: 완료 후, 전체 검사");
  assert.equal(f.pre("Bash", { command: "pnpm test" }).code, 0);
});

test("두 설정이 같은 정책 파일을 등록하고 영구 기억을 가리킨다", () => {
  for (const filename of ["../.codex/hooks.json", "../.claude/settings.json"]) {
    const config = JSON.parse(readFileSync(new URL(filename, import.meta.url), "utf8"));
    for (const event of [
      "PreToolUse",
      "PostToolUse",
      ...(filename.includes(".claude") ? ["PostToolUseFailure"] : ["SubagentStop", "SessionEnd"]),
    ]) {
      assert.ok(config.hooks[event].some(entry => entry.hooks.some(h => h.command.includes("usage_guard.py"))));
    }
  }
  assert.match(readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8"), /usage-budget\.md/);
});

test("부모 세션 ID를 공유해도 작업자 transcript와 재열람 기록을 구분한다", t => {
  const f = fixture(t);
  f.report("사용량 계획 shared: 구현, src, 완료 후 검증");
  const input = { fork_turns: "none", message: 'USAGE_PLAN {"id":"shared","paths":["src"]}\n구현' };
  assert.equal(f.pre("collaboration.spawn_agent", input).code, 0);
  f.post("collaboration.spawn_agent", input, { agent_id: "worker" });
  const extra = { transcript_path: join(f.root, "worker.jsonl") };
  assert.equal(f.pre("functions.Read", { file_path: "src/a.txt" }, extra).code, 0);
  f.post("functions.Read", {}, { file: { content: "처음" } }, extra);
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }, extra).code, 2);
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 2);
  const result = f.hook("SubagentStop", "", {}, { agent_id: "worker" });
  assert.equal(result.code, 0);
  assert.deepEqual(result.output, {});
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 0);
});

test("네임스페이스로 위임 검사를 우회할 수 없고 MCP의 동명 도구는 별도로 취급한다", t => {
  const f = fixture(t);
  for (const name of [
    "spawn_agent",
    "collaboration.spawn_agent",
    "functions.spawn_agent",
    "functions__spawn_agent",
    "collaborationspawn_agent",
    "functionsspawn_agent",
  ]) {
    assert.equal(f.pre(name, { fork_turns: "all" }).code, 2, name);
  }
  assert.equal(f.pre("mcp__example__spawn_agent", { fork_turns: "all" }).code, 0);
});

test("실제 작업자 시작 ID를 연결하고 task_name 응답에도 종료 후 잠금을 해제한다", t => {
  const f = fixture(t);
  f.report("사용량 계획 actual: 구현, src, 완료 후 검증");
  const input = { fork_turns: "none", message: 'USAGE_PLAN {"id":"actual","paths":["src"]}\n구현' };
  assert.equal(f.pre("collaborationspawn_agent", input).code, 0);
  const spawnCall = "1";
  f.hook("SubagentStart", "", {}, { agent_id: "worker", transcript_path: join(f.root, "worker.jsonl") });
  f.post("collaborationspawn_agent", input, '{"task_name":"/root/actual"}', { tool_use_id: spawnCall });
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 2);
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }, { agent_id: "worker" }).code, 0);
  f.hook("SubagentStop", "", {}, { agent_id: "worker" });
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 0);
});

test("실제 Bash 문자열 결과는 transcript의 완료 코드로 판정한다", t => {
  const f = fixture(t);
  const input = { command: "cat src/a.txt" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, "처음\n둘째\n");
  writeFileSync(
    f.transcript,
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "item_completed",
        item: { type: "CommandExecution", id: "1", exit_code: 0 },
      },
    }) + "\n"
  );
  assert.equal(f.pre("Bash", input).code, 2);
});

test("중첩 명령의 실패 완료 코드는 성공으로 재사용하지 않는다", t => {
  const f = fixture(t);
  const input = { command: "cat src/a.txt" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, "실패");
  writeFileSync(
    f.transcript,
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "item_completed",
        item: { type: "CommandExecution", id: "1", exit_code: 1 },
      },
    }) + "\n"
  );
  assert.equal(f.pre("Bash", input).code, 0);
});

test("작업자 종료 시 마지막 실패 결과를 정산해 부모 재검증을 허용한다", t => {
  const f = fixture(t);
  const child = join(f.root, "child.jsonl");
  writeFileSync(child, "");
  const input = { command: "node --test tests/a.test.mjs" };
  const extra = { agent_id: "worker", transcript_path: child };
  assert.equal(f.pre("Bash", input, extra).code, 0);
  f.post("Bash", input, "실패", extra);
  writeFileSync(
    child,
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "item_completed",
        item: { type: "CommandExecution", id: "1", exit_code: 1 },
      },
    }) + "\n"
  );
  f.hook("SubagentStop", "", {}, { agent_id: "worker", agent_transcript_path: child });
  assert.equal(f.pre("Bash", input).code, 0);
});

test("문서 편집과 리터럴 본문은 명령 실행으로 오인하지 않는다", t => {
  const f = fixture(t);
  const content = "HANDOFF.md STATUS.md * pnpm test";
  assert.equal(f.pre("apply_patch", { cmd: content }).code, 0);
  assert.equal(f.pre("Write", { command: content }).code, 0);
  assert.equal(f.pre("Bash", { command: "git add artifacts/* HANDOFF.md STATUS.md" }).code, 0);
  const command = `python3 <<'PY'\ntext = ${JSON.stringify(content)}\nPY`;
  assert.equal(f.pre("Bash", { command }).code, 0);
  assert.equal(f.pre("Bash", { command: command + "\npnpm test" }).code, 2);
  assert.equal(f.pre("Bash", { command: "bash <<'SH'\npnpm test\nSH" }).code, 2);
});

test("암호화된 위임은 작업명이 일치하는 사전 보고 계획으로 검증한다", t => {
  const f = fixture(t);
  const input = { fork_turns: "none", task_name: "impl_task", message: "gAAAA" + "x".repeat(7000) };
  assert.equal(f.pre("spawn_agent", input).code, 2);
  const report =
    '사용량 계획 impl: 구현, src, 완료 후 검증\nUSAGE_PLAN {"id":"impl","task_name":"impl_task","paths":["src"]}';
  f.report(report, "user");
  assert.equal(f.pre("spawn_agent", input).code, 2);
  f.report(report);
  assert.equal(f.pre("spawn_agent", { ...input, task_name: "other" }).code, 2);
  assert.equal(f.pre("spawn_agent", { ...input, fork_turns: "all" }).code, 2);
  assert.equal(f.pre("spawn_agent", { ...input, message: "형식 없는 평문" }).code, 2);
  assert.equal(f.pre("spawn_agent", input).code, 0);
  f.post("spawn_agent", input, { agent_id: "worker" });
  assert.equal(f.pre("Read", { file_path: "src/a.txt" }).code, 2);
});

for (const platform of ["codex", "claude"]) {
  test(`${platform} 이미지 데이터는 허용하고 함께 온 긴 텍스트는 제한한다`, t => {
    const f = fixture(t, platform);
    const image = { type: "image", mimeType: "image/png", data: "x".repeat(20000) };
    assert.equal(f.post("view_image", {}, { content: [image] }).output, null);
    assert.equal(f.post("view_image", {}, { image_url: "data:image/png;base64," + "x".repeat(20000) }).output, null);
    const result = f.post("view_image", {}, { content: [image, { type: "text", text: "x".repeat(18000) }] });
    assert.ok(result.output);
    if (platform === "codex") assert.equal(result.output.decision, "block");
    const plain = f.post("Read", {}, { file: { content: "x".repeat(18000) } });
    assert.ok(plain.output);
  });
}

test("claude 편집 도구 응답의 입력 내용은 출력 크기에 넣지 않는다", t => {
  const f = fixture(t, "claude");
  const body = "x".repeat(18000);
  assert.equal(f.post("Write", { content: body }, { type: "create", content: body }).output, null);
  assert.equal(f.post("Edit", {}, { originalFile: body, structuredPatch: [] }).output, null);
});

test("codex 패치 도구 응답은 출력 크기에 넣지 않는다", t => {
  const f = fixture(t, "codex");
  const body = "x".repeat(18000);
  assert.equal(f.post("apply_patch", { command: body }, { output: body }).output, null);
});

test("모노레포의 미추적 소스가 추가되면 이전 검사 성공을 재사용하지 않는다", t => {
  const f = fixture(t);
  f.report("사용량 검증 단계: 완료 후, 모노레포 변경 검사");
  const input = { command: "pnpm test" };
  assert.equal(f.pre("Bash", input).code, 0);
  f.post("Bash", input, { exit_code: 0 });
  for (const path of ["apps/web/src/new.ts", "packages/shared/src/new.ts"]) {
    mkdirSync(join(f.root, path, ".."), { recursive: true });
    writeFileSync(join(f.root, path), "export const value = 1;\n");
    assert.equal(f.pre("Bash", input).code, 0);
    f.post("Bash", input, { exit_code: 0 });
  }
});
