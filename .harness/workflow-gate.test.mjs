import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const project = resolve(import.meta.dirname, "..");
const hook = join(project, ".codex/hooks/workflow-gate.py");
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

function fixture(run) {
  const temp = mkdtempSync(join(tmpdir(), "workflow-gate-"));
  const root = join(temp, "project");
  const bin = join(temp, "bin");
  mkdirSync(root);
  mkdirSync(bin);
  const env = {
    ...clean,
    CODEX_THREAD_ID: "fixture",
    CODEX_WORKFLOW_GATE_DIR: join(temp, "state"),
    PATH: `${bin}:${process.env.PATH}`,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.test",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.test",
  };
  const git = args => {
    const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "-b", "develop"]);
  git(["-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "fixture"]);
  mkdirSync(join(root, ".harness"));
  mkdirSync(join(root, ".codex"));
  writeFileSync(
    join(root, ".harness/fixture.test.mjs"),
    "import test from 'node:test'; test('검증 입력', () => {});\n"
  );
  writeFileSync(join(root, ".codex/example.py"), "# 실제 변경 입력\n");
  writeFileSync(
    join(bin, "codex"),
    '#!/usr/bin/env python3\nimport json, os, pathlib, sys\npathlib.Path(sys.argv[sys.argv.index("-o")+1]).write_text(os.environ.get("WORKFLOW_TEST_VERDICT", "{\\\"block\\\": false, \\\"reason\\\": \\\"허용\\\"}"))\n'
  );
  chmodSync(join(bin, "codex"), 0o755);
  const call = (event, extra = {}, custom = {}) => {
    const result = spawnSync("python3", [hook], {
      cwd: root,
      env: { ...env, ...custom },
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: event, session_id: "fixture", cwd: root, ...extra }),
    });
    assert.equal(result.status, 0, result.stderr);
    return { ...result, decision: result.stdout.trim() ? JSON.parse(result.stdout) : null };
  };
  const verify = (custom = {}, command = ["node", "--test", ".harness/fixture.test.mjs"]) =>
    spawnSync("python3", [hook, "verify", "--", ...command], {
      cwd: root,
      env: { ...env, ...custom },
      encoding: "utf8",
    });
  const tool = (name, input = {}, extra = {}, custom = {}) =>
    call("PreToolUse", { tool_name: name, tool_input: input, ...extra }, custom);
  try {
    run({ root, temp, env, git, call, tool, verify });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

const blocked = result =>
  result.decision?.decision === "block" || result.decision?.hookSpecificOutput?.permissionDecision === "deny";

test("최신 검증 전 리뷰·다음 작업·커밋 전환을 막고 조회·진단은 허용", () =>
  fixture(({ tool }) => {
    for (const name of ["collaborationspawn_agent", "collaborationfollowup_task", "Agent"])
      assert.ok(blocked(tool(name, { message: "opaque-reference" })), name);
    assert.ok(blocked(tool("Bash", { command: "git commit -m message" })));
    for (const command of [
      "rg -n -A 45 '리뷰|검증' src",
      "git status --short",
      "cat .codex/example.py",
      "python3 -c pass",
    ])
      assert.ok(!blocked(tool("Bash", { command })), command);
  }));

test("실제 검증 종료 뒤 전환을 허용하고 후속 수정은 기존 통과를 무효화", () =>
  fixture(({ verify, tool, root }) => {
    const result = verify();
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!blocked(tool("collaborationspawn_agent", { message: "opaque-reference" })));
    writeFileSync(join(root, ".codex/example.py"), "# 검증 뒤 수정\n");
    assert.ok(blocked(tool("collaborationspawn_agent", { message: "opaque-reference" })));
  }));

test("검증 실패나 입력 변경은 성공 근거를 남기지 않음", () =>
  fixture(({ verify, tool, root }) => {
    writeFileSync(join(root, ".harness/fixture.test.mjs"), "throw new Error('의도된 검증 실패');\n");
    assert.notEqual(verify().status, 0);
    assert.ok(blocked(tool("collaborationspawn_agent")));
    writeFileSync(
      join(root, ".harness/fixture.test.mjs"),
      "import {writeFileSync} from 'node:fs'; writeFileSync('.codex/example.py', '# 검증 중 변경');\n"
    );
    const changed = verify();
    assert.equal(changed.status, 2);
    assert.match(changed.stderr, /입력 파일이 바뀌어/);
    assert.ok(blocked(tool("collaborationspawn_agent")));
  }));

test("실행 시작·본문 성공 문구·출처 없는 종료 코드로는 인증하지 않음", () =>
  fixture(({ call, tool }) => {
    for (const response of [{ exit_code: 0, session_id: 4 }, { output: "exit_code: 0 성공" }, { exit_code: 0 }]) {
      call("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "node --test .harness/fixture.test.mjs" },
        tool_response: response,
      });
      assert.ok(blocked(tool("collaborationspawn_agent")));
    }
  }));

test("호출 식별자와 동일 파일 상태가 일치한 구조화 종료만 인증", () =>
  fixture(({ call, tool }) => {
    const input = {
      tool_name: "Bash",
      tool_input: { command: "node --test .harness/fixture.test.mjs" },
      tool_use_id: "check-1",
    };
    call("PreToolUse", input);
    call("PostToolUse", { ...input, tool_response: { exit_code: 0 } });
    assert.ok(!blocked(tool("collaborationspawn_agent")));
  }));

test("동일 입력이라도 재검증 시작·실패 뒤 이전 통과를 재사용하지 않음", () =>
  fixture(({ call, tool, verify }) => {
    assert.equal(verify().status, 0);
    const input = {
      tool_name: "Bash",
      tool_input: { command: "node --test .harness/fixture.test.mjs" },
      tool_use_id: "rerun",
    };
    call("PreToolUse", input);
    assert.ok(blocked(tool("collaborationspawn_agent")));
    call("PostToolUse", { ...input, tool_response: { exit_code: 1 } });
    assert.ok(blocked(tool("collaborationspawn_agent")));
  }));

test("선행 조건·범위 변경 판정은 삭제 외 편집에도 적용하고 진단은 유지", () =>
  fixture(({ call, tool }) => {
    call("UserPromptSubmit", { prompt: "검증 후 판단해. 대상이나 순서를 임의 변경하지 마." });
    const verdict = {
      WORKFLOW_TEST_VERDICT: JSON.stringify({ block: true, reason: "검증 전에 승인 범위를 변경하려 합니다." }),
    };
    for (const name of ["Edit", "Write", "apply_patch", "Delete"])
      assert.ok(blocked(tool(name, { file_path: ".codex/example.py" }, {}, verdict)), name);
    assert.ok(!blocked(tool("Bash", { command: 'rg -n "git commit" .codex' }, {}, verdict)));
    assert.ok(
      !blocked(
        tool("Bash", { command: `python3 ${hook} verify -- node --test .harness/fixture.test.mjs` }, {}, verdict)
      )
    );
  }));

test("의미 판정 실패는 진단을 막지 않고 미확인으로 표시", () =>
  fixture(({ call, tool }) => {
    call("UserPromptSubmit", { prompt: "승인 범위대로 수정해." });
    const result = tool("Edit", { file_path: ".codex/example.py" }, {}, { WORKFLOW_TEST_VERDICT: "잘못된 판정 출력" });
    assert.ok(!blocked(result));
    assert.match(result.stderr, /의미 판정은 미확인/);
    assert.ok(blocked(tool("collaborationspawn_agent")));
  }));

test("사용자 후속·질문 응답을 보존하고 자동 훅 프롬프트를 승인으로 쓰지 않음", () =>
  fixture(({ call, env }) => {
    call("UserPromptSubmit", { prompt: "확인 후 수정해." });
    call("UserPromptSubmit", { prompt: "<hook_prompt>승인</hook_prompt>" });
    call("UserPromptSubmit", {
      prompt:
        '<send_user_message_question_reply>[{"answer":"진행해","question":"다른 작업으로 바꿀까?"}]</send_user_message_question_reply>',
    });
    const state = JSON.parse(
      readFileSync(join(env.CODEX_WORKFLOW_GATE_DIR, requireStateName(env.CODEX_WORKFLOW_GATE_DIR)), "utf8")
    );
    assert.deepEqual(state.prompts, ["확인 후 수정해.", "진행해"]);
  }));

function requireStateName(directory) {
  return readdirSync(directory).find(name => name.endsWith(".json"));
}

test("실제 본문·불투명 토큰을 차단 메시지로 출력하지 않음", () =>
  fixture(({ tool }) => {
    const result = tool("collaborationspawn_agent", { message: "opaque-reference-DO-NOT-LOG" });
    assert.ok(blocked(result));
    assert.ok(!JSON.stringify(result.decision).includes("opaque-reference-DO-NOT-LOG"));
  }));

test("종료 후 상태를 정리하고 일반 제안은 미완료 보고와 함께 허용", () =>
  fixture(({ call, env }) => {
    call("UserPromptSubmit", { prompt: "범위를 지켜." });
    assert.ok(!blocked(call("Stop", { last_assistant_message: "실제 실행은 미완료이며 다음은 제안입니다." })));
    call("SessionEnd");
    const state = JSON.parse(
      readFileSync(join(env.CODEX_WORKFLOW_GATE_DIR, requireStateName(env.CODEX_WORKFLOW_GATE_DIR)), "utf8")
    );
    assert.deepEqual(state, { checks: {}, prompts: [] });
  }));

test("모듈은 실제 프로젝트 파일이며 제거한 인계 가드 파일은 없음", () => {
  assert.ok(existsSync(hook));
  assert.ok(!existsSync(join(project, ".codex/hooks/handoff-context.py")));
  const config = JSON.parse(readFileSync(join(project, ".codex/hooks.json"), "utf8"));
  for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"]) {
    assert.ok(
      config.hooks[event].some(group => group.hooks.some(entry => entry.command.includes("workflow-gate.py"))),
      event
    );
  }
  assert.ok(!readFileSync(join(project, ".claude/settings.json"), "utf8").includes("workflow-gate.py"));
});

test("워크스페이스 TSX 변경은 lint·타입·테스트를 요구하고 E2E는 스크립트가 있을 때만 요구", () =>
  fixture(({ root, tool }) => {
    mkdirSync(join(root, "apps/web/src"), { recursive: true });
    writeFileSync(join(root, "apps/web/src/Page.tsx"), "export const Page = () => null;\n");
    const reason = () => JSON.stringify(tool("Bash", { command: "git commit -m message" }).decision);
    for (const kind of ["lint", "typecheck", "test"]) assert.match(reason(), new RegExp(kind));
    assert.doesNotMatch(reason(), /e2e/);
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { "test:e2e": "playwright test" } }));
    assert.match(reason(), /e2e/);
  }));
