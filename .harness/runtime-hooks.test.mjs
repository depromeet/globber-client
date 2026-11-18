// 공용 훅 회귀 검사. 판정 CLI는 고정 응답으로 대체함

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const H = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// pre-commit 안에서는 GIT_DIR 등이 설정돼 임시 저장소 대신 실제 저장소를 가리키므로 제거
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const marks = mkdtempSync(join(tmpdir(), "harness-runtime-"));

process.on("exit", () => rmSync(marks, { recursive: true, force: true }));

const run = (tool, hook, input, cwd = H) =>
  spawnSync("sh", [resolve(H, tool, "hooks", `${hook}.sh`)], {
    cwd,
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...env, TMPDIR: marks, CLAUDE_PROJECT_DIR: cwd },
  });

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 커밋 훅이 정상 메시지를 허용하고 금지 트레일러와 종결어미를 차단한다`, () => {
    assert.equal(
      run(tool, "block-attribution-trailers", {
        tool_input: { command: 'git commit -m "fix: 탐색 수정"' },
      }).status,
      0
    );
    for (const trailer of ["Co-Authored-By", "Claude-Session"]) {
      assert.equal(
        run(tool, "block-attribution-trailers", {
          tool_input: {
            command: `git commit -m "fix: 탐색 수정\n\n${trailer}: sample"`,
          },
        }).status,
        2
      );
    }

    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: { command: 'git commit -m "fix: 탐색 수정"' },
      }).status,
      0
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: { command: 'git commit -m "fix: 탐색을 수정했다"' },
      }).status,
      2
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'git commit -m "fix: 탐색 수정" -m "- 캐시 정리\n- 경로 수정"',
        },
      }).status,
      0
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'git commit -m "fix: 탐색 수정" -m "- 캐시 정리" -m "- 경로 수정"',
        },
      }).status,
      2
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'git commit -m "fix: 탐색 수정" -m "Harness-Sync: Claude만 수정\nHarness-Scope: sync"',
        },
      }).status,
      0
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'git commit -m "fix: 탐색 수정" -m "Harness-Scope: sync\n이어지는 문장"',
        },
      }).status,
      2
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'git commit -m "fix: 탐색 수정" -m "- 캐시를 정리했다"',
        },
      }).status,
      2
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'git commit -m "fix: 탐색 수정" -m "- 캐시 정리\n- 경로를 수정했다"',
        },
      }).status,
      2
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: "cat >> notes.md <<'EOF'\n- 작업을 완료했다\nEOF\ngit commit -m \"docs: 메모 추가\"",
        },
      }).status,
      0
    );
    assert.equal(
      run(tool, "enforce-commit-msg-style", {
        tool_input: {
          command: 'cat > example.md <<\'EOF\'\ngit commit -m "a" -m "- b" -m "- c"\nEOF',
        },
      }).status,
      0
    );
  });
  test(`${tool} lint 경고 훅이 경고가 있는 변경 파일의 커밋만 차단한다`, () => {
    const repo = mkdtempSync(join(marks, "lint-"));
    const git = (...args) => spawnSync("git", args, { cwd: repo, env });

    git("init", "-q");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n");
    writeFileSync(join(repo, "biome.json"), "{}");
    mkdirSync(join(repo, "node_modules/.bin"), { recursive: true });

    // 경고 옵션이 붙고 파일에 WARN이 있으면 실패하는 가짜 biome
    const biome = join(repo, "node_modules/.bin/biome");

    writeFileSync(
      biome,
      '#!/bin/sh\necho "$@" | grep -q -- --error-on-warnings || exit 3\nfor f; do [ -f "$f" ] && grep -q WARN "$f" && exit 1; done\nexit 0\n'
    );
    chmodSync(biome, 0o755);

    const lint = (command, cwd = repo) =>
      run(tool, "block-lint-warnings-on-commit", { cwd, tool_input: { command } }, cwd).status;

    writeFileSync(join(repo, "a.ts"), "ok\n");
    assert.equal(lint('git commit -m "a"'), 0);
    writeFileSync(join(repo, "b.ts"), "WARN\n");
    assert.equal(lint('git add . && git commit -m "a"'), 2);
    assert.equal(lint("git status"), 0);
    assert.equal(lint('echo "git commit"'), 0);
    assert.equal(lint(`cd ${repo} && git commit -m "a"`, marks), 2);
    assert.equal(lint(`git -C ${repo} commit -m "a"`, marks), 2);
    writeFileSync(join(repo, "b.ts"), "ok\n");
    mkdirSync(join(repo, ".harness"));
    writeFileSync(
      join(repo, ".harness/biome-check.mjs"),
      'if (!process.argv.includes("--error-on-warnings")) throw new Error("경고 옵션 누락"); console.error("문장 사이 빈 줄"); process.exit(1);\n'
    );

    const spacing = run(
      tool,
      "block-lint-warnings-on-commit",
      {
        cwd: repo,
        tool_input: { command: 'git commit -m "a"' },
      },
      repo
    );

    assert.equal(spacing.status, 2);
    assert.match(spacing.stderr, /문장 사이 빈 줄/);
    rmSync(join(repo, "biome.json"));
    assert.equal(lint('git commit -m "a"'), 0);
  });
  test(`${tool} 소스 대시 훅이 앱 위반을 차단하고 정상 소스를 허용한다`, () => {
    assert.equal(
      run(tool, "block-em-dash-in-source", {
        tool_name: "Write",
        tool_input: {
          file_path: "src/app/page.tsx",
          content: 'export const value = "정상";',
        },
      }).status,
      0
    );
    assert.equal(
      run(tool, "block-em-dash-in-source", {
        tool_name: "Write",
        tool_input: {
          file_path: "src/app/page.tsx",
          content: 'export const value = "bad — text";',
        },
      }).status,
      2
    );
    assert.equal(
      run(tool, "block-em-dash-in-source", {
        tool_name: "Write",
        tool_input: {
          file_path: "__tests__/lint/sample.test.ts",
          content: 'const sample = "bad — text";',
        },
      }).status,
      0
    );
  });
  test(`${tool} 보고 전용 요청 턴의 소스 편집만 사용자 확인을 요청한다`, () => {
    const session = `report-gate-${tool.slice(1)}-${process.pid}`;

    const prompt = text =>
      run(tool, "confirm-edit-on-report-request", {
        hook_event_name: "UserPromptSubmit",
        session_id: session,
        prompt: text,
      });

    const edit = file_path =>
      run(tool, "confirm-edit-on-report-request", {
        hook_event_name: "PreToolUse",
        session_id: session,
        tool_name: "Edit",
        tool_input: { file_path },
      }).stdout.includes('"ask"');

    prompt("명세 업데이트 및 훅 강제 필요한지 판단하여 보고해");
    assert.equal(edit("/repo/.claude/hooks/sample.sh"), true);
    assert.equal(edit("/repo/artifacts/task-team/report.md"), false);
    assert.equal(edit("/Users/u/.claude/projects/p/memory/note.md"), false);
    prompt("검토 후 보고하고 문제 있으면 고쳐");
    assert.equal(edit("/repo/src/app/page.tsx"), false);
    prompt("가능한 내용은 강제해");
    assert.equal(edit("/repo/src/app/page.tsx"), false);
  });
  test(`${tool} 주석 줄바꿈 훅이 문장 중간 줄바꿈을 차단하고 한 줄 한 문장을 허용한다`, () => {
    const write = content =>
      run(tool, "block-comment-line-wrap", {
        tool_name: "Write",
        tool_input: { file_path: "src/app/page.tsx", content },
      }).status;

    assert.equal(write("// 첫 문장 요약함\n// 두 번째 문장 설명함\nconst a = 1;"), 0);
    assert.equal(write("/**\n * 첫 문장 요약함\n * 두 번째 문장 설명함\n */"), 0);
    assert.equal(write("// 캐시 키는\n// 세션과 경로로 구성함"), 2);
    assert.equal(write("// Keeps the cache\n// warm between requests."), 2);
    assert.equal(write("// 수정함. 다음 단계 진행함"), 2);
    assert.equal(write("/*\n첫 줄 설명함\n*/"), 2);

    const shell = content =>
      run(tool, "block-comment-line-wrap", {
        tool_name: "Write",
        tool_input: { file_path: ".claude/hooks/sample.sh", content },
      }).status;

    assert.equal(shell("#!/bin/sh\n# 첫 문장 요약함\n# 두 번째 문장 설명함"), 0);
    assert.equal(shell("#!/bin/sh\n# 커밋 메시지를\n# 검사함"), 2);
    assert.equal(shell("#!/bin/sh\n# 커밋 메시지를 검사한다."), 2);
    assert.equal(
      run(tool, "block-comment-line-wrap", {
        tool_name: "Write",
        tool_input: {
          file_path: "__tests__/lint/sample.test.ts",
          content: "// 캐시 키는\n// 세션과 경로로 구성함",
        },
      }).status,
      0
    );
  });
  test(`${tool} 런타임 안전 훅이 파괴적 명령을 차단한다`, () => {
    assert.equal(
      run(tool, "git-safety-guard", {
        tool_input: { command: "git reset --hard" },
      }).status,
      2
    );
    assert.equal(
      run(tool, "git-safety-guard", {
        tool_input: { command: 'pkill -f "next-server"' },
      }).status,
      2
    );
    assert.equal(
      run(tool, "git-safety-guard", {
        tool_input: { command: "kill $(lsof -ti tcp:3100)" },
      }).status,
      0
    );
    for (const command of [
      "python3 - <<'EOF'\nnote = '프로세스 이름 기준 종료(pkill, killall) 금지'\nEOF",
      'git commit -m "docs: (pkill) 차단 문구 정리"',
      "echo 'x; killall node'",
    ]) {
      assert.equal(run(tool, "git-safety-guard", { tool_input: { command } }).status, 0);
    }

    assert.equal(
      run(tool, "git-safety-guard", {
        tool_input: { command: "cat <<'EOF'\n본문\nEOF\nkillall node" },
      }).status,
      2
    );
  });
  test(`${tool} 새 브랜치 생성은 브랜치 수와 무관하고 살아 있는 worktree에만 차단된다`, () => {
    const repo = mkdtempSync(join(tmpdir(), "portfolio-branch-"));
    const git = (...args) => spawnSync("git", args, { cwd: repo, env });

    const create = () =>
      run(tool, "git-safety-guard", { tool_input: { command: "git switch -c feature/next" } }, repo).status;

    try {
      git("init", "-q");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
      for (const name of ["a", "b", "c", "d", "e"]) git("branch", name);

      assert.equal(create(), 0);
      git("worktree", "add", "-q", join(repo, "wt"), "a");
      assert.equal(create(), 2);
      rmSync(join(repo, "wt"), { recursive: true, force: true });
      assert.equal(create(), 0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
  test(`${tool} best practice 안내 훅이 키워드에만 조건부 지시를 추가하고 차단하지 않는다`, () => {
    for (const prompt of ["pre-push에서 e2e 돌리는 게 Best Practice야?", "베스트 프랙티스가 뭐야"]) {
      const result = run(tool, "require-single-best-practice", { prompt });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes("권장안 하나"));
    }

    const other = run(tool, "require-single-best-practice", {
      prompt: "pre-push 설정 보여줘",
    });

    assert.equal(other.status, 0);
    assert.equal(other.stdout, "");
  });
  test(`${tool} 가능 여부 안내 훅이 키워드에만 조건부 지시를 추가하고 차단하지 않는다`, () => {
    for (const prompt of ["훅으로 강제할 수 있어?", "이거 가능해?"]) {
      const result = run(tool, "require-feasibility-verdict", { prompt });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes("가능합니다"));
    }

    const other = run(tool, "require-feasibility-verdict", {
      prompt: "pre-push 설정 보여줘",
    });

    assert.equal(other.status, 0);
    assert.equal(other.stdout, "");
  });
  test(`${tool} 안내 훅이 subagent 보고와 붙여넣은 내용에는 반응하지 않는다`, () => {
    const quoted = [
      '<agent-message from="a1">\n  왜 best practice 표로 리스트업이 가능할까?\n</agent-message>',
      '<pasted_content id="p1">\n왜 best practice 표로 리스트업이 가능할까?\n</pasted_content id="p1">',
    ];

    for (const hook of [
      "require-why-explanation",
      "require-status-verification",
      "require-single-best-practice",
      "require-feasibility-verdict",
      "confirm-edit-on-report-request",
    ]) {
      for (const prompt of quoted) {
        const result = run(tool, hook, {
          hook_event_name: "UserPromptSubmit",
          session_id: "quoted",
          prompt,
        });

        assert.equal(result.status, 0);
        assert.equal(result.stdout, "");
      }
    }

    assert.ok(
      run(tool, "require-why-explanation", {
        prompt: `${quoted[1]}\n\n-> 왜 이렇게 돼?`,
      }).stdout.includes("판단 근거")
    );
  });
  test(`${tool} 원인 설명 안내 훅이 실행을 차단하지 않는다`, () => {
    const result = run(tool, "require-why-explanation", {
      prompt: "왜 변경했어?",
    });

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("판단 근거"));
  });
}

test("클로드 에이전트 실행 훅이 fork 스폰과 worktree 진입, 격리 없는 구현자 스폰을 차단한다", () => {
  const claude = (hook, input, cwd) => run(".claude", hook, input, cwd);

  assert.equal(claude("block-fork-spawn", { tool_input: { subagent_type: "fork" } }).status, 2);
  assert.equal(claude("block-fork-spawn", { tool_input: { subagent_type: "qa-engineer" } }).status, 0);
  assert.equal(claude("orchestrator-no-worktree", {}).status, 2);
  assert.equal(claude("orchestrator-no-worktree", { agent_id: "implementation" }).status, 0);

  // 중단 지시가 없는 턴의 TaskStop은 사용자 확인을 받고, 지시가 있으면 통과
  const stopWith = (...prompts) =>
    withTmp("portfolio-task-stop-", tmp => {
      const transcript = join(tmp, "transcript.jsonl");

      writeFileSync(
        transcript,
        `${[
          { type: "user", message: { content: prompts[0] } },
          ...prompts.slice(1).map(prompt => ({ type: "attachment", attachment: { type: "queued_command", prompt } })),
        ]
          .map(entry => JSON.stringify(entry))
          .join("\n")}\n`
      );

      const out = claude("confirm-task-stop", {
        transcript_path: transcript,
        tool_input: { task_id: "a1" },
      }).stdout.trim();

      return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : "allow";
    });

  assert.equal(stopWith("간단한 수정은 agent 스폰하지 말고 직접 진행해"), "ask");
  assert.equal(stopWith("이어서 작업해", "T06 구현자 멈춰"), "allow");
  assert.equal(stopWith("<task-notification>stop</task-notification>"), "ask");

  const fixture = mkdtempSync(join(tmpdir(), "portfolio-hooks-"));

  try {
    spawnSync("git", ["init", "-q"], { cwd: fixture, env });

    const isolation = (subagent_type, isolationValue) =>
      claude(
        "require-isolation-when-dirty",
        { tool_input: { subagent_type, ...(isolationValue ? { isolation: isolationValue } : {}) } },
        fixture
      ).status;

    const agents = join(fixture, ".claude", "agents");

    mkdirSync(agents, { recursive: true });
    writeFileSync(join(agents, "implementer.md"), "---\nname: implementer\ntools: Read, Edit, Bash\n---\n");
    writeFileSync(join(agents, "reader.md"), "---\nname: reader\ntools: Read, Grep\n---\n");
    writeFileSync(join(agents, "inherits.md"), "---\nname: inherits\n---\n");
    spawnSync("git", ["add", "-A"], { cwd: fixture, env });
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"], { cwd: fixture, env });

    // 쓰기 가능 역할(정의 tools, tools 없음, 이름 미상 내장)은 깨끗한 트리에서도 격리 없이 차단
    for (const type of ["implementer", "inherits", "general-purpose", undefined]) {
      assert.equal(isolation(type), 2);
      assert.equal(isolation(type, "worktree"), 0);
    }

    // 다른 subagent가 남긴 worktree 폴더는 dirty로 보지 않음
    mkdirSync(join(fixture, ".claude", "worktrees", "agent-x"), { recursive: true });
    writeFileSync(join(fixture, ".claude", "worktrees", "agent-x", "probe.txt"), "x");
    assert.equal(isolation("implementer", "worktree"), 0);

    // 미커밋 변경이 있으면 쓰기 가능 역할은 격리 스폰도 차단, 읽기 전용 역할은 격리 없이 통과
    writeFileSync(join(fixture, "dirty.txt"), "changed");
    assert.equal(isolation("implementer", "worktree"), 2);
    for (const type of ["reader", "Explore", "web-fetch"]) assert.equal(isolation(type), 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("클로드 스폰 도구 선언 훅이 선언 누락과 정의에 없는 도구를 차단한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "portfolio-agent-tools-"));

  try {
    mkdirSync(join(fixture, ".claude", "agents"), { recursive: true });

    const definition = join(fixture, ".claude", "agents", "designer.md");

    const spawn = (subagent_type, prompt) =>
      run(".claude", "require-agent-tool-declaration", { tool_input: { subagent_type, prompt } }, fixture);

    const webTask = "필요 도구: Read, WebSearch\n카드 디자인 근거를 조사하라";

    writeFileSync(definition, "---\nname: designer\ntools: Read, Write\n---\n");
    assert.equal(spawn("designer", "카드 디자인 근거를 조사하라").status, 2);

    const missing = spawn("designer", webTask);

    assert.equal(missing.status, 2);
    assert.ok(missing.stderr.includes("WebSearch"));
    assert.equal(spawn("designer", "필요 도구: 없음\n요약만 하라").status, 0);

    writeFileSync(definition, "---\nname: designer\ntools: Read, Write, WebSearch\n---\n");

    const allowed = spawn("designer", webTask);

    assert.equal(allowed.status, 0);
    assert.deepEqual(JSON.parse(allowed.stdout).hookSpecificOutput, {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: {
        subagent_type: "designer",
        prompt: "카드 디자인 근거를 조사하라",
      },
    });
    assert.equal(spawn("general-purpose", webTask).status, 0);
    assert.equal(spawn("general-purpose", "선언 없이 조사하라").status, 2);
    assert.equal(spawn("fork", "선언 없이 조사하라").status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("클로드 스폰 모델 훅이 정의의 model·effort 덮어쓰기만 차단한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "portfolio-agent-model-"));

  try {
    mkdirSync(join(fixture, ".claude", "agents"), { recursive: true });
    writeFileSync(
      join(fixture, ".claude", "agents", "backend-developer.md"),
      "---\nname: backend-developer\ntools: Read, Edit\nmodel: sonnet\neffort: medium\n---\n"
    );

    const spawn = (subagent_type, extra) =>
      run(
        ".claude",
        "require-agent-tool-declaration",
        { tool_input: { subagent_type, prompt: "필요 도구: Read\n고쳐라", ...extra } },
        fixture
      );

    const model = spawn("backend-developer", { model: "haiku" });

    assert.equal(model.status, 2);
    assert.ok(model.stderr.includes("model"));
    assert.equal(spawn("backend-developer", { effort: "low" }).status, 2);
    assert.equal(spawn("backend-developer", { model: "sonnet", effort: "medium" }).status, 0);
    assert.equal(spawn("backend-developer", {}).status, 0);
    assert.equal(spawn("general-purpose", { model: "haiku" }).status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 가능 여부 훅이 Stop에서 첫 문장 판정이 없는 응답을 막는다`, () => {
    const marks = mkdtempSync(join(tmpdir(), "portfolio-feasibility-"));

    // 실제 LLM 대신 판정 결과를 고정한 스크립트를 판정기로 씀
    const judge = ask => {
      const path = join(marks, `judge-${ask}.sh`);

      writeFileSync(path, `#!/bin/sh\ncat >/dev/null\necho '{"ask": ${ask}}'\n`);
      chmodSync(path, 0o755);

      return path;
    };

    let judgeBin = judge(true);

    try {
      const hook = input =>
        spawnSync("sh", [resolve(H, tool, "hooks", "require-feasibility-verdict.sh")], {
          input: JSON.stringify({ session_id: "s1", ...input }),
          encoding: "utf8",
          cwd: H,
          env: { ...env, TMPDIR: marks, STOP_JUDGE_BIN: judgeBin },
        });

      const answer = (prompt, message, active = false) => {
        hook({ hook_event_name: "UserPromptSubmit", prompt });

        return hook({
          hook_event_name: "Stop",
          last_assistant_message: message,
          stop_hook_active: active,
        }).stdout;
      };

      const question = "훅으로 강제할 수 있는지 검토 후 보고해";

      assert.equal(answer(question, "가능합니다.\n\n근거는 아래와 같습니다."), "");
      assert.equal(answer(question, "**불가능합니다.** 이유는 아래와 같습니다."), "");
      for (const message of [
        "일부만 가능합니다: 선언 대조는 가능하고 필요 도구 추정은 불가능합니다.",
        "선언 대조는 가능하지만 필요 도구 추정은 불가능합니다. 상세는 아래와 같습니다.",
        "입력을 확인했습니다. 가능합니다.",
        "검토 결과는 아래와 같습니다.",
      ]) {
        assert.equal(JSON.parse(answer(question, message)).decision, "block");
        hook({
          hook_event_name: "Stop",
          last_assistant_message: message,
          stop_hook_active: true,
        });
      }

      hook({ hook_event_name: "UserPromptSubmit", prompt: question });
      hook({
        hook_event_name: "UserPromptSubmit",
        prompt: "이 이미지로 썸네일 바꿔",
      });
      assert.equal(
        JSON.parse(
          hook({
            hook_event_name: "Stop",
            last_assistant_message: "검토 결과입니다.",
          }).stdout
        ).decision,
        "block"
      );
      hook({
        hook_event_name: "Stop",
        last_assistant_message: "검토 결과입니다.",
        stop_hook_active: true,
      });
      assert.equal(answer("가능하다/불가능하다로 대답하라고", "검토 결과입니다."), "");
      assert.equal(answer(question, "검토 결과입니다.", true), "");

      const report = '<agent-message from="a1">\n  구현 가능할까? 검토 결과입니다.\n</agent-message>';

      assert.equal(answer(report, "검토 결과입니다."), "");
      assert.equal(
        answer('<pasted_content id="p1">\n이거 가능해?\n</pasted_content id="p1">\n\n-> 정리해', "정리했습니다."),
        ""
      );
      hook({ hook_event_name: "UserPromptSubmit", prompt: question });
      hook({ hook_event_name: "UserPromptSubmit", prompt: report });
      assert.equal(
        JSON.parse(
          hook({
            hook_event_name: "Stop",
            last_assistant_message: "검토 결과입니다.",
          }).stdout
        ).decision,
        "block"
      );
      hook({
        hook_event_name: "Stop",
        last_assistant_message: "검토 결과입니다.",
        stop_hook_active: true,
      });
      judgeBin = judge(false);
      assert.equal(answer("가능한지 웹 서치 후 가능하다면 적용해", "적용했습니다."), "");
    } finally {
      rmSync(marks, { recursive: true, force: true });
    }
  });

  test(`${tool} 가능 여부 훅이 첫머리 판정 뒤에서 판정을 다시 쪼갠 응답을 막는다`, () => {
    const marks = mkdtempSync(join(tmpdir(), "portfolio-feasibility-split-"));

    // 실제 LLM 대신 판정 결과(또는 고장)를 고정한 스크립트를 판정기로 씀
    const judge = (name, output) => {
      const path = join(marks, `judge-${name}.sh`);

      writeFileSync(path, `#!/bin/sh\ncat >"${marks}/seen"\n${output}\n`);
      chmodSync(path, 0o755);

      return path;
    };

    const splitJudge = judge("split", `echo '{"ask": true, "split": true}'`);
    const keepJudge = judge("keep", `echo '{"ask": true, "split": false}'`);
    const brokenJudge = judge("broken", "exit 1");

    try {
      const answer = (judgeBin, message) => {
        writeFileSync(join(marks, "seen"), "");

        const hook = input =>
          spawnSync("sh", [resolve(H, tool, "hooks", "require-feasibility-verdict.sh")], {
            input: JSON.stringify({ session_id: "s1", ...input }),
            encoding: "utf8",
            cwd: H,
            env: { ...env, TMPDIR: marks, STOP_JUDGE_BIN: judgeBin },
          });

        hook({ hook_event_name: "UserPromptSubmit", prompt: "훅으로 강제할 수 있는지 검토 후 보고해" });

        const { stdout } = hook({ hook_event_name: "Stop", last_assistant_message: message });

        // 다음 확인이 이전 표시의 영향을 받지 않게 재응답 처리로 표시를 지움
        hook({ hook_event_name: "Stop", last_assistant_message: message, stop_hook_active: true });

        return stdout;
      };

      const split = "가능합니다. 다만 막을 수 있는 범위는 둘로 나뉩니다.";

      assert.equal(JSON.parse(answer(splitJudge, split)).decision, "block");
      assert.ok(JSON.parse(answer(splitJudge, split)).reason.includes("다시 쪼갰습니다"));
      assert.equal(answer(keepJudge, "가능합니다. LLM 판정이라 일부는 오탐이 생길 수 있습니다."), "");
      assert.equal(answer(splitJudge, "가능합니다. LLM 판정이라 오탐이 생길 수 있습니다."), "");
      assert.equal(answer(brokenJudge, split), "");
      for (const message of [
        "가능합니다. A는 가능하지만 B는 불가능합니다.",
        "불가능합니다. A는 불가능하지만 B는 가능합니다.",
      ]) {
        assert.equal(JSON.parse(answer(splitJudge, message)).decision, "block");
      }

      for (const message of ["가능합니다. A도 가능합니다.", "불가능합니다. A도 불가능합니다."]) {
        assert.equal(answer(splitJudge, message), "");
        assert.equal(readFileSync(join(marks, "seen"), "utf8"), "");
      }

      const long = `가능합니다. ${"배경 설명입니다. ".repeat(400)}A는 가능하지만 B는 불가능합니다. 후속 문맥입니다.`;

      assert.equal(JSON.parse(answer(splitJudge, long)).decision, "block");

      const seen = readFileSync(join(marks, "seen"), "utf8");

      assert.ok(seen.includes("B는 불가능합니다. 후속 문맥입니다."));
      assert.ok(seen.includes("[검사 후보 주변 문맥]"));
    } finally {
      rmSync(marks, { recursive: true, force: true });
    }
  });

  test(`${tool} 판정 훅이 transcript에서 이번 턴 첫 응답을 판정 대상으로 본다`, () => {
    const marks = mkdtempSync(join(tmpdir(), "portfolio-feasibility-first-"));

    // 실제 LLM 대신 판정 결과를 고정하고, 호출 여부를 seen 파일로 남기는 스크립트를 판정기로 씀
    const judgeBin = join(marks, "judge.sh");

    writeFileSync(judgeBin, `#!/bin/sh\ncat >"${marks}/seen"\necho '{"ask": true, "split": true}'\n`);
    chmodSync(judgeBin, 0o755);

    // Claude 형식(type·message)과 Codex 형식(payload.role)을 모두 만들어 같은 판정이 나오는지 봄
    const claudeEntry = (role, text) =>
      role === "tool"
        ? { type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } }
        : { type: role, message: { content: [{ type: "text", text }] } };
    const codexEntry = (role, text) =>
      role === "tool"
        ? { type: "response_item", payload: { type: "function_call_output", output: "ok" } }
        : {
            type: "response_item",
            payload: { role, content: [{ type: role === "user" ? "input_text" : "output_text", text }] },
          };

    try {
      const answer = (format, prompt, blocks) => {
        const transcript = join(marks, "transcript.jsonl");
        const turns = [
          ["user", prompt],
          ...blocks.flatMap((text, i) => (i ? [["tool"], ["assistant", text]] : [["assistant", text]])),
        ];

        writeFileSync(transcript, turns.map(([role, text]) => JSON.stringify(format(role, text))).join("\n"));
        writeFileSync(join(marks, "seen"), "");

        const hook = input =>
          spawnSync("sh", [resolve(H, tool, "hooks", "require-feasibility-verdict.sh")], {
            input: JSON.stringify({ session_id: "s1", transcript_path: transcript, ...input }),
            encoding: "utf8",
            cwd: H,
            env: { ...env, TMPDIR: marks, STOP_JUDGE_BIN: judgeBin },
          });

        hook({ hook_event_name: "UserPromptSubmit", prompt });

        const { stdout } = hook({ hook_event_name: "Stop", last_assistant_message: blocks.at(-1) });

        // 다음 확인이 이전 표시의 영향을 받지 않게 재응답 처리로 표시를 지움
        hook({ hook_event_name: "Stop", last_assistant_message: blocks.at(-1), stop_hook_active: true });

        return stdout;
      };

      const confirm = "이 브랜치 병합됐나요?";
      const feasible = "훅으로 강제할 수 있는지 검토 후 보고해";

      for (const format of [claudeEntry, codexEntry]) {
        assert.equal(answer(format, confirm, ["네. 병합됐습니다.", "T05 병합을 이어서 진행합니다."]), "");
        assert.equal(answer(format, confirm, ["네, 맞습니다. 병합됐습니다.", "진행 중입니다."]), "");
        assert.equal(
          JSON.parse(answer(format, confirm, ["확인해 보겠습니다.", "네. 병합됐습니다."])).decision,
          "block"
        );
        assert.equal(
          JSON.parse(answer(format, confirm, ["네, 확인해 보겠습니다.", "병합됐습니다."])).decision,
          "block"
        );
        assert.equal(
          JSON.parse(answer(format, feasible, ["가능합니다. 근거는 아래와 같습니다.", "B는 불가능합니다."])).decision,
          "block"
        );
        assert.equal(answer(format, feasible, ["가능합니다. 근거는 아래와 같습니다.", "일부는 아직 남았습니다."]), "");
        assert.equal(readFileSync(join(marks, "seen"), "utf8"), "");
      }
    } finally {
      rmSync(marks, { recursive: true, force: true });
    }
  });
}

test(
  "클로드 리뷰 누락 훅이 위반을 검출한다",
  {
    skip: !existsSync(join(H, ".claude/hooks/require-coderabbit-run.sh")),
  },
  () => {
    assert.equal(
      run(".claude", "require-coderabbit-run", {
        tool_name: "Write",
        tool_input: {
          file_path: "artifacts/task-team/code-review-1.md",
          content: "# 검토 결과",
        },
      }).status,
      2
    );
    assert.equal(
      run(".claude", "require-coderabbit-run", {
        tool_name: "Write",
        tool_input: {
          file_path: "artifacts/task-team/code-review-1.md",
          content: "## CodeRabbit 교차검토\n미실행: 인증 실패",
        },
      }).status,
      0
    );
  }
);

test("AskUserQuestion 직접 입력 답변 뒤 같은 응답의 재질문을 차단하고 새 메시지 뒤에는 허용한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "portfolio-ask-hook-"));

  try {
    const transcript = join(fixture, "transcript.jsonl");

    const answer = value => ({
      type: "user",
      message: { content: [{ type: "tool_result", content: "answered" }] },
      toolUseResult: {
        questions: [
          {
            question: "Preview 지원?",
            multiSelect: false,
            options: [{ label: "지원, DB 공유" }, { label: "미지원" }],
          },
        ],
        answers: { "Preview 지원?": value },
      },
    });

    const prompt = { type: "user", message: { content: "나머지 질문해" } };

    const decide = (...entries) => {
      writeFileSync(transcript, entries.map(entry => JSON.stringify(entry)).join("\n"));

      const { stdout } = run(".claude", "block-reask-after-free-text-answer", {
        transcript_path: transcript,
      });

      return stdout.trim() ? JSON.parse(stdout).hookSpecificOutput.permissionDecision : "allow";
    };

    assert.equal(decide(prompt, answer("best practice가 뭔데?")), "deny");
    assert.equal(decide(prompt, answer("지원, DB 공유")), "allow");
    // 질문 후보가 없는 직접 입력(작업 지시)은 허용
    assert.equal(decide(prompt, answer("feat. 티켓 번호는 발급되지 않았어. 임시 브랜치 생성해")), "allow");
    assert.equal(decide(prompt, answer("지시대로 할게\n이거 왜 3초임")), "deny");
    assert.equal(decide(answer("best practice가 뭔데?"), prompt), "allow");
    // 질문이 아닌 지시형 직접 입력은 차단하지 않고, 물음표 없는 의문형은 차단
    assert.equal(decide(prompt, answer("ip 주소 사용하되, 주소를 환경변수로 관리할 수 있도록 해")), "allow");
    assert.equal(decide(prompt, answer("이건 무슨 소리임")), "deny");
    assert.equal(decide(prompt, answer("운영 먼저 할까요")), "deny");

    // subagent의 수정은 사용자 답변과 무관하므로 허용
    writeFileSync(transcript, [prompt, answer("왜 3초임?")].map(entry => JSON.stringify(entry)).join("\n"));
    assert.equal(
      run(".claude", "block-reask-after-free-text-answer", {
        transcript_path: transcript,
        tool_name: "Edit",
        agent_id: "a1",
      }).stdout.trim(),
      ""
    );
    assert.ok(
      JSON.parse(readFileSync(resolve(H, ".claude/settings.json"), "utf8")).hooks.PreToolUse.some(
        ({ matcher, hooks }) =>
          (matcher ?? "").split("|").includes("Edit") &&
          hooks.some(({ command }) => command.includes("block-reask-after-free-text-answer"))
      )
    );

    // 다른 세션·subagent 메시지로 시작한 새 턴에서도 재질문 허용
    const peer = {
      type: "user",
      isMeta: true,
      origin: { kind: "peer" },
      message: { content: "Another Claude session sent a message:" },
    };

    assert.equal(decide(answer("best practice가 뭔데?"), peer), "allow");

    // 줄이 4095바이트를 넘고 라벨의 한글이 읽기 경계에 걸려도 선택지 답변은 허용
    const padded = pad => ({ pad, ...answer("미지원") });

    const start =
      Buffer.from(JSON.stringify(padded(""))).indexOf('"label":"미지원"') + Buffer.byteLength('"label":"미');

    for (const shift of [0, 1, 2]) {
      assert.equal(decide(prompt, padded("a".repeat(4093 - start + shift))), "allow");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("코덱스 어댑터가 apply_patch와 spawn_agent 입력을 같은 훅 판정으로 변환한다", () => {
  const adapt = (hook, input, cwd = H) =>
    spawnSync("node", [resolve(H, ".codex/hooks/codex-tool-adapter.mjs"), hook], {
      cwd,
      input: JSON.stringify(input),
      encoding: "utf8",
      env: { ...env, TMPDIR: marks, CLAUDE_PROJECT_DIR: cwd },
    });

  const patch = body => ({
    tool_name: "apply_patch",
    tool_input: { command: `*** Begin Patch\n${body}\n*** End Patch` },
  });

  assert.equal(
    adapt("block-em-dash-in-source", patch('*** Add File: src/app/sample.ts\n+export const v = "bad — text";')).status,
    2
  );
  assert.equal(
    adapt(
      "block-em-dash-in-source",
      patch('*** Update File: src/app/sample.ts\n@@\n-export const v = "a";\n+export const v = "bad — text";')
    ).status,
    2
  );
  assert.equal(
    adapt("block-em-dash-in-source", patch('*** Add File: src/app/sample.ts\n+export const v = "정상";')).status,
    0
  );
  assert.equal(
    adapt("block-comment-line-wrap", patch("*** Add File: src/app/sample.ts\n+// 캐시 키는\n+// 세션과 경로로 구성함"))
      .status,
    2
  );

  const session = `report-gate-adapter-${process.pid}`;

  run(".codex", "confirm-edit-on-report-request", {
    hook_event_name: "UserPromptSubmit",
    session_id: session,
    prompt: "훅 강제 필요한지 판단하여 보고해",
  });

  const gated = adapt("confirm-edit-on-report-request", {
    hook_event_name: "PreToolUse",
    session_id: session,
    ...patch("*** Delete File: /repo/src/app/page.tsx"),
  });

  assert.equal(JSON.parse(gated.stdout).hookSpecificOutput.permissionDecision, "deny");

  const stop = run(".codex", "require-korean-response", {
    last_assistant_message: "This response describes the complete implementation and verification results in English.",
  });

  assert.equal(JSON.parse(stop.stdout).decision, "block");
});

test("재질문 차단이 풀린 상태에서 질문을 다음 메시지로 미룬 응답만 차단한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "portfolio-defer-ask-hook-"));

  try {
    const transcript = join(fixture, "transcript.jsonl");

    const prompt = { type: "user", message: { content: "다음 메세지?" } };

    const peer = {
      type: "user",
      isMeta: true,
      origin: { kind: "peer" },
      message: { content: "Another Claude session sent a message:" },
    };

    const freeText = {
      type: "user",
      message: { content: [{ type: "tool_result", content: "answered" }] },
      toolUseResult: {
        questions: [{ question: "R-05?", multiSelect: false, options: [{ label: "닫기" }] }],
        answers: { "R-05?": "레퍼런스는 확인 해봤어?" },
      },
    };

    const defer = "남은 결정은 다음 메시지를 받은 뒤 질문 창으로 묻겠습니다.";

    const decide = (message, ...entries) => {
      writeFileSync(transcript, entries.map(entry => JSON.stringify(entry)).join("\n"));

      const { stdout } = spawnSync(
        "sh",
        [resolve(H, ".claude", "hooks", "block-reask-after-free-text-answer.sh"), "stop"],
        {
          input: JSON.stringify({ transcript_path: transcript, last_assistant_message: message }),
          encoding: "utf8",
        }
      );

      return stdout.trim() ? JSON.parse(stdout).decision : "allow";
    };

    assert.equal(decide(defer, prompt), "block");
    assert.equal(decide(defer, prompt, freeText), "allow");
    assert.equal(decide(defer, prompt, freeText, peer), "block");
    assert.equal(
      decide(defer, prompt, {
        ...freeText,
        toolUseResult: { ...freeText.toolUseResult, answers: { "R-05?": "닫기 대신 유지하도록 해" } },
      }),
      "block"
    );
    assert.equal(decide(`> ${defer}\n\n인용한 문장에 답합니다.`, prompt), "allow");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 실행 예고 훅이 대기 조건 없는 실행 서술로 끝난 응답만 차단한다`, () => {
    const decide = message => {
      const { stdout } = run(tool, "require-execution-for-declared-step", { last_assistant_message: message });

      return stdout.trim() ? JSON.parse(stdout).decision : "allow";
    };

    assert.equal(decide("경로를 기록했습니다.\n\n다음은 T04로, 구현 담당자를 투입해 구현을 시작합니다."), "block");
    assert.equal(decide("보고가 오면 이어서 진행하겠습니다."), "allow");
    assert.equal(decide("구현 담당자를 투입했고, 지금 구현을 진행 중입니다."), "allow");
    assert.equal(decide("> 구현을 시작합니다\n\n인용한 문장에 답합니다."), "allow");
    assert.equal(decide("미리보기입니다.\n\n승인하시면 `git commit --amend`를 실행합니다."), "allow");
    assert.equal(decide("삭제가 끝나면 지난 응답에서 말씀드린 1~4단계를 이어서 진행합니다."), "allow");
    assert.equal(decide("적용할 항목을 지정해 주시면 그 절차로 진행하겠습니다."), "allow");
    for (const noun of ["화면", "장면", "측면", "단면", "평면"]) {
      assert.equal(decide(`공정 현황 ${noun} 구현을 시작합니다.`), "block");
    }
  });
}

test("코덱스 실행 예고 훅은 마지막 문단의 이어가기 약속만 차단한다", () => {
  const decide = (message, extra = {}) => {
    const result = run(".codex", "require-execution-for-declared-step", { last_assistant_message: message, ...extra });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim() ? JSON.parse(result.stdout).decision : "allow";
  };
  for (const message of [
    "진단을 이어가겠습니다.",
    "이어서 가겠습니다.",
    "진단을 이어갑니다.",
    "계속하겠습니다.",
    "재개하겠습니다.",
    "gh로 확인 가능한 진단을 이어가겠습니다. 현재 원인은 확정하지 못했습니다.",
  ])
    assert.equal(decide(message), "block");
  for (const message of [
    "보고가 오면 이어가겠습니다.",
    "확인이 끝나면 계속하겠습니다.",
    "진단을 이어갔습니다.",
    "> 진단을 이어가겠습니다.\n\n인용입니다.",
    "`이어가겠습니다`를 탐지합니다.",
    "진단을 이어가겠습니다.\n\n검토 결과 이 계획은 취소했습니다.",
  ])
    assert.equal(decide(message), "allow");
  assert.equal(decide("이어가겠습니다.", { stop_hook_active: true }), "allow");
  assert.equal(decide("이어가겠습니다.", { agent_id: "worker" }), "allow");
});

const withTmp = (prefix, body) => {
  const tmp = mkdtempSync(join(tmpdir(), prefix));

  try {
    return body(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const runIn = (tool, hook, input, tmp) =>
  spawnSync("sh", [resolve(H, tool, "hooks", `${hook}.sh`)], {
    input: JSON.stringify({ session_id: "s1", ...input }),
    encoding: "utf8",
    cwd: H,
    env: { ...env, TMPDIR: tmp },
  });

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 가능 여부 훅이 검토형 질문을 표시하고 표시된 턴의 도구 결과에 안내를 붙인다`, () => {
    withTmp("portfolio-feasibility-post-", tmp => {
      const post = () => runIn(tool, "require-feasibility-verdict", { hook_event_name: "PostToolUse" }, tmp).stdout;

      assert.equal(post(), "");
      runIn(
        tool,
        "require-feasibility-verdict",
        {
          hook_event_name: "UserPromptSubmit",
          prompt: "훅 강제 가능성 검토 후 보고해",
        },
        tmp
      );

      const context = JSON.parse(post()).hookSpecificOutput.additionalContext;

      assert.ok(context.includes("가능합니다."));
      assert.ok(context.includes("판정을 다시 쪼개지 말고"));
    });
  });

  // Claude는 같은 판정을 Stop의 judge-unverified-claims.sh에서 하므로 이 훅이 Codex에만 있음
  test(
    `${tool} 미확인 추측 보고 훅이 추측과 미확인이 한 문장에 있으면 한 번 막는다`,
    {
      skip: tool !== ".codex",
    },
    () => {
      withTmp("portfolio-unverified-", tmp => {
        const stop = (message, active = false) =>
          runIn(
            tool,
            "block-unverified-claims",
            {
              hook_event_name: "Stop",
              last_assistant_message: message,
              stop_hook_active: active,
            },
            tmp
          ).stdout;

        const claim = "변경은 충돌 없이 적용될 것으로 보지만 아직 확인하지 않았습니다.";

        assert.equal(JSON.parse(stop(claim)).decision, "block");
        assert.equal(stop(claim, true), "");
        assert.equal(stop("패치 적용 검사를 통과했습니다. 충돌은 없습니다."), "");
        assert.equal(stop("권한이 없어 확인하지 못했습니다. 확인 방법은 아래와 같습니다."), "");
        assert.equal(stop('"~것으로 보지만 미확인" 같은 보고를 막는 훅을 추가했습니다.'), "");

        for (const deferred of [
          "시험해 보기 전에는 확정할 수 없습니다.",
          "이번에 다시 시험하지는 않았습니다.",
          "새 훅을 실제로 만들어 돌려 본 결과는 아닙니다.",
          "`/cd` 후 동작은 미시험입니다.",
          "문서에서 찾지 못해 근거는 없습니다.",
          "대기 시간은 측정하지 않았습니다.",
          "아직 시험하지 않았기 때문에 확정할 수 없습니다.",
          "이유는 아직 시험하지 않았습니다.",
        ]) {
          assert.equal(JSON.parse(stop(deferred)).decision, "block");
          assert.equal(stop(deferred, true), "");
        }

        assert.equal(stop("> 시험해 보기 전에는 확정할 수 없습니다."), "");

        for (const exempt of [
          "확인하지 않은 이유는 주석 한 줄을 결론으로 받아들였기 때문입니다.",
          "그래서 피그마대로가 어떤 화면을 뜻하는지 확정할 수 없습니다.",
        ]) {
          assert.equal(stop(exempt), "");
        }
      });
    }
  );
}

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 빈 예외 패턴이 확인 미룸 차단을 해제하지 않는다`, () => {
    withTmp("portfolio-empty-exempt-", tmp => {
      const name = tool === ".claude" ? "judge-unverified-claims" : "block-unverified-claims";
      const hook = join(tmp, tool, "hooks", `${name}.sh`);
      const patterns = join(tmp, ".harness");
      const judge = join(tmp, "judge.sh");

      mkdirSync(dirname(hook), { recursive: true });
      mkdirSync(patterns);
      writeFileSync(hook, readFileSync(resolve(H, tool, "hooks", `${name}.sh`)));
      writeFileSync(
        join(patterns, "deferred-claims-pattern.txt"),
        readFileSync(resolve(H, ".harness/deferred-claims-pattern.txt"))
      );
      writeFileSync(join(patterns, "deferred-claims-exempt-pattern.txt"), " \n\t");
      writeFileSync(judge, "#!/bin/sh\ncat >/dev/null\necho '{\"ok\": true}'\n");
      chmodSync(judge, 0o755);

      const result = spawnSync("sh", [hook], {
        input: JSON.stringify({ last_assistant_message: "대기 시간은 측정하지 않았습니다." }),
        encoding: "utf8",
        cwd: tmp,
        env: { ...env, TMPDIR: tmp, STOP_JUDGE_BIN: judge },
      });

      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).decision, "block");
    });
  });
}

// Claude 형식 transcript: 앞선 턴(도구 기록 A) → 이번 턴 사용자 질문 → 질문 창 직전 설명 텍스트 → 마지막 응답
const writeTranscript = tmp => {
  const path = join(tmp, "transcript.jsonl");

  const entries = [
    { type: "user", uuid: "u1", message: { content: "앞선 턴 지시" } },
    {
      type: "assistant",
      message: { content: [{ type: "tool_use", input: { command: "git log -1 --format=%B OLDCOMMIT" } }] },
    },
    { type: "user", message: { content: [{ type: "tool_result", content: "앞선 턴 결과 PREVIOUS-EVIDENCE" }] } },
    { type: "user", uuid: "u2", message: { content: "왜 남겨둔거임?" } },
    { type: "assistant", message: { content: [{ type: "text", text: "남겨 둔 이유는 EARLIER-REASON 입니다." }] } },
    { type: "assistant", message: { content: [{ type: "text", text: "보관했습니다." }] } },
  ];

  writeFileSync(path, `${entries.map(entry => JSON.stringify(entry)).join("\n")}\n`);

  return path;
};

test("클로드 미확인 판정 훅이 이번 턴 앞선 텍스트와 직전 턴 도구 기록을 판정기에 넘긴다", () => {
  withTmp("portfolio-judge-", tmp => {
    const captured = join(tmp, "prompt.txt");
    const judgeBin = join(tmp, "judge.sh");

    writeFileSync(judgeBin, `#!/bin/sh\ncat >"${captured}"\necho '{"ok": true}'\n`);
    chmodSync(judgeBin, 0o755);

    const result = spawnSync("sh", [resolve(H, ".claude/hooks/judge-unverified-claims.sh")], {
      input: JSON.stringify({
        session_id: "s1",
        transcript_path: writeTranscript(tmp),
        last_assistant_message: "보관했습니다.",
      }),
      encoding: "utf8",
      cwd: H,
      env: { ...env, TMPDIR: tmp, STOP_JUDGE_BIN: judgeBin },
    });

    const prompt = readFileSync(captured, "utf8");

    assert.equal(result.stdout, "");
    assert.ok(prompt.includes("EARLIER-REASON"));
    assert.ok(prompt.includes("PREVIOUS-EVIDENCE"));
    assert.ok(prompt.includes("반박 근거로 쓰지 않는다"));
    // 앞선 턴의 사용자 메시지는 원인 판정 대상에서 제외
    assert.ok(!prompt.split("[최근 도구 기록]")[0].includes("앞선 턴 지시"));
  });
});

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 질문 응답 훅이 답하지 않은 질문이 있으면 파일 수정과 턴 종료를 막는다`, () => {
    const judge = (tmp, name, body) => {
      const path = join(tmp, `${name}.sh`);

      writeFileSync(path, `#!/bin/sh\ncat >"${tmp}/called"\n${body}\n`);
      chmodSync(path, 0o755);

      return path;
    };

    const decide = (prompt, input, verdict, replies = ["기록하겠습니다."], next = input) =>
      withTmp("portfolio-answer-", tmp => {
        const transcript = join(tmp, "transcript.jsonl");

        writeFileSync(
          transcript,
          `${[
            { type: "user", uuid: "u1", message: { content: prompt } },
            ...replies.map(text => ({ type: "assistant", message: { content: [{ type: "text", text }] } })),
          ]
            .map(entry => JSON.stringify(entry))
            .join("\n")}\n`
        );

        const bin = judge(tmp, "judge", verdict);

        const call = (hookInput = input) =>
          spawnSync("sh", [resolve(H, tool, "hooks", "require-answer-before-edit.sh")], {
            input: JSON.stringify({ session_id: "s1", transcript_path: transcript, ...hookInput }),
            encoding: "utf8",
            cwd: H,
            env: { ...env, TMPDIR: tmp, STOP_JUDGE_BIN: bin },
          }).stdout;

        const first = call();
        const parsed = first.trim() ? JSON.parse(first) : null;

        return {
          result: parsed?.hookSpecificOutput?.permissionDecision ?? parsed?.decision ?? "allow",
          again: call(next).trim() ? "block" : "allow",
          called: existsSync(join(tmp, "called")),
        };
      });

    const edit = { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "a.md" } };
    const bash = command => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } });
    const stop = { hook_event_name: "Stop", last_assistant_message: "기록했습니다." };
    const unanswered = `echo '{"unanswered": "뭐가 문제임?"}'`;
    const answered = `echo '{"unanswered": null}'`;
    const question = "28-8462로 하면 되는데 뭐가 문제임?";

    // 도구 호출 직전 응답 텍스트가 transcript에 빠질 수 있어 같은 질문 묶음의 수정은 1회만 막고 재시도는 통과
    assert.deepEqual(decide(question, edit, unanswered), { result: "deny", again: "allow", called: true });
    // 수정 차단 뒤에도 턴 끝 Stop 판정은 건너뛰지 않음
    assert.deepEqual(decide(question, edit, unanswered, undefined, stop), {
      result: "deny",
      again: "block",
      called: true,
    });
    // 답한 질문 묶음은 한 번 통과하면 같은 턴에서 다시 판정하지 않음
    assert.deepEqual(decide(question, edit, answered), { result: "allow", again: "allow", called: true });
    // 의문형 후보가 없는 작업 지시는 판정기를 부르지 않음
    assert.deepEqual(decide("D16 답변 기록해", edit, unanswered), { result: "allow", again: "allow", called: false });
    assert.equal(decide(question, bash("cat a.md 2>/dev/null"), unanswered).called, false);
    assert.equal(decide(question, bash("sed -i '' 's/a/b/' a.md"), unanswered).result, "deny");
    assert.equal(decide(question, bash("echo 기록 > a.md"), unanswered).result, "deny");
    assert.equal(
      decide(question, bash('python3 -c \'from pathlib import Path; Path("x").write_text("x")\''), unanswered).result,
      "deny"
    );
    assert.equal(
      decide(question, bash('python3 -c \'from pathlib import Path; Path("x").write_bytes(b"x")\''), unanswered).result,
      "deny"
    );
    assert.equal(
      decide(question, bash("python3 -c 'from pathlib import Path; print(Path(\"x\").read_text())'"), unanswered)
        .called,
      false
    );
    // Stop은 같은 질문 묶음을 한 번만 막음
    assert.deepEqual(decide(question, stop, unanswered), { result: "block", again: "allow", called: true });
    // 미답변 판정이 한 번만 나오면 재판정 결과(답함)를 따라 통과
    const flaky = `n=$(cat "$0.n" 2>/dev/null || echo 0); echo $((n + 1)) >"$0.n"; if [ "$n" = 0 ]; then ${unanswered}; else ${answered}; fi`;
    assert.deepEqual(decide(question, edit, flaky), { result: "allow", again: "allow", called: true });
    // 판정기가 고장 나면 통과
    assert.equal(decide(question, edit, "echo broken").result, "allow");
    // 응답 기록이 없는 질문 턴도 편집 전 판정하고, 질문 없는 작업 지시는 통과
    assert.deepEqual(decide(question, edit, unanswered, []), { result: "deny", again: "allow", called: true });
    assert.deepEqual(decide("D16 답변 기록해", edit, unanswered, []), {
      result: "allow",
      again: "allow",
      called: false,
    });
    assert.equal(decide(question, stop, unanswered, []).result, "block");
  });

  test(`${tool} 질문 응답 훅이 의문형 메시지만 판정기에 넘기고 작업 알림과 화살표는 무시한다`, () => {
    const run = (entries, input) =>
      withTmp("portfolio-answer-scope-", tmp => {
        const transcript = join(tmp, "transcript.jsonl");
        const captured = join(tmp, "prompt.txt");
        const bin = join(tmp, "judge.sh");

        writeFileSync(transcript, `${entries.map(entry => JSON.stringify(entry)).join("\n")}\n`);
        writeFileSync(bin, `#!/bin/sh\ncat >"${captured}"\necho '{"unanswered": null}'\n`);
        chmodSync(bin, 0o755);
        spawnSync("sh", [resolve(H, tool, "hooks", "require-answer-before-edit.sh")], {
          input: JSON.stringify({ session_id: "s1", transcript_path: transcript, ...input }),
          encoding: "utf8",
          cwd: H,
          env: { ...env, TMPDIR: tmp, STOP_JUDGE_BIN: bin },
        });

        return existsSync(captured) ? readFileSync(captured, "utf8") : null;
      });

    const edit = { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "a.md" } };
    const user = content => ({ type: "user", uuid: "u1", message: { content } });
    const queued = prompt => ({ type: "attachment", attachment: { type: "queued_command", prompt } });
    const reply = text => ({ type: "assistant", message: { content: [{ type: "text", text }] } });

    // 질문과 작업 지시가 섞이면 작업 지시는 판정기에 넘기지 않음
    const mixed = run([user("이건 왜 막힘?"), queued("메모리 업데이트해")], edit);

    assert.ok(mixed.includes("이건 왜 막힘?"));
    assert.ok(!mixed.includes("메모리 업데이트해"));
    // 작업 알림 안의 물음표는 질문 후보가 아님
    assert.equal(run([user("<task-notification>\n<summary>끝났나?</summary>\n</task-notification>")], edit), null);
    // 긴 턴에서도 앞부분 답이 판정기 입력에 남음
    const long = run([user("오탐임?"), reply("네. 오탐입니다."), reply("가".repeat(8000))], edit);

    assert.ok(long.includes("네. 오탐입니다."));
    // 스크립트 문자열 안의 화살표는 파일 리다이렉트가 아님
    const bash = command => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } });

    assert.equal(run([user("오탐임?")], bash(`python3 -c 'print("a -> b")'`)), null);
    assert.notEqual(run([user("오탐임?")], bash("echo 기록 > a.md")), null);
  });
}

test("코덱스 원인 판정 훅이 이번 턴 앞선 텍스트를 판정기에 넘긴다", () => {
  withTmp("portfolio-codex-judge-", tmp => {
    const bin = join(tmp, "bin");
    const captured = join(tmp, "prompt.txt");

    mkdirSync(bin);
    mkdirSync(join(tmp, "codex-why-judge"));
    writeFileSync(join(tmp, "codex-why-judge", "t1"), "왜 남겨둔거임?");
    // codex exec -o <파일> - 형식: 입력은 표준입력, 판정은 -o 파일에 씀
    writeFileSync(
      join(bin, "codex"),
      `#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\nout="$2"\ncat >"${captured}"\necho '{"ok": true}' >"$out"\n`
    );
    chmodSync(join(bin, "codex"), 0o755);

    const result = spawnSync("sh", [resolve(H, ".codex/hooks/block-unverified-claims.sh")], {
      input: JSON.stringify({
        turn_id: "t1",
        transcript_path: writeTranscript(tmp),
        last_assistant_message: "보관했습니다.",
      }),
      encoding: "utf8",
      cwd: H,
      env: { ...env, TMPDIR: tmp, PATH: `${bin}:${env.PATH}` },
    });

    assert.equal(result.stdout, "");
    assert.ok(readFileSync(captured, "utf8").includes("EARLIER-REASON"));
  });
});

test(
  "클로드 기획서 인용 훅이 소문자 경로 인용과 코드 펜스·인용 줄은 통과시키고 근거 없는 주장 줄만 막는다",
  {
    skip: !existsSync(resolve(H, ".claude/hooks/check-prd-claim-citation.sh")),
  },
  () => {
    withTmp("portfolio-prd-", tmp => {
      const stop = text => {
        const path = join(tmp, "transcript.jsonl");

        writeFileSync(
          path,
          `${[
            { type: "user", message: { content: "보고해" } },
            { type: "assistant", message: { content: [{ type: "text", text }] } },
          ]
            .map(entry => JSON.stringify(entry))
            .join("\n")}\n`
        );

        return spawnSync("sh", [resolve(H, ".claude/hooks/check-prd-claim-citation.sh")], {
          input: JSON.stringify({ session_id: "s1", transcript_path: path }),
          encoding: "utf8",
          cwd: H,
          env: { ...env, TMPDIR: tmp, STOP_JUDGE_BIN: judgeBin },
        }).stdout;
      };

      const judgeBin = join(tmp, "judge.sh");

      const judge = output => {
        writeFileSync(judgeBin, `#!/bin/sh\ncat >/dev/null\necho '${output}'\n`);
        chmodSync(judgeBin, 0o755);
      };

      judge('{"claims": [1]}');

      assert.equal(stop("집계 기준은 PRD 근거입니다(docs/prd.md:120)."), "");
      assert.equal(stop("```\n- PRD 사본 추가와 프로젝트 규칙에 PRD 경로 등록\n```"), "");
      assert.equal(stop('본문의 "PRD 사본 추가" 줄은 원래 커밋에 있던 줄입니다.'), "");
      assert.equal(stop("표기 규칙은 PRD 미정이라 사용자 결정 항목으로 분리합니다."), "");
      assert.equal(JSON.parse(stop("집계 기준은 PRD에 따라 일 단위입니다.")).decision, "block");

      judge('{"claims": []}');
      assert.equal(stop("PRD 기간·시간대 불일치는 사람 승인 필요 항목으로 분리합니다."), "");

      judge("해석 불가");
      assert.equal(JSON.parse(stop("집계 기준은 PRD에 따라 일 단위입니다.")).decision, "block");
    });
  }
);

for (const tool of [".claude", ".codex"]) {
  test(`${tool} 확인 질문은 직접 판정을 먼저 요구하고 설명 요청과 인용은 통과시킨다`, () => {
    withTmp("harness-confirmation-", tmp => {
      const judge = join(tmp, "judge.sh");
      const capture = join(tmp, "prompt.txt");

      writeFileSync(judge, `#!/bin/sh\ncat >"${capture}"\necho '{"ask": true}'\n`);
      chmodSync(judge, 0o755);

      const hook = input =>
        spawnSync("sh", [resolve(H, tool, "hooks/require-feasibility-verdict.sh")], {
          input: JSON.stringify({ session_id: "confirmation", ...input }),
          encoding: "utf8",
          env: { ...env, TMPDIR: tmp, STOP_JUDGE_BIN: judge },
        });

      const answer = text => {
        hook({ hook_event_name: "UserPromptSubmit", prompt: "관련 파일까지 정리한거 맞지?" });

        return hook({ hook_event_name: "Stop", last_assistant_message: text }).stdout;
      };

      for (const text of ["네. 정리했습니다.", "**아니요.** 남아 있습니다.", "확인할 수 없습니다."])
        assert.equal(answer(text), "");

      assert.equal(JSON.parse(answer("아직 동기화 중입니다.")).decision, "block");
      assert.ok(readFileSync(capture, "utf8").includes("직접 확인 질문"));
      // 판정기가 잘못 true를 줘도 명확한 이유 질문은 이전 확인 표식을 지움.
      hook({ hook_event_name: "UserPromptSubmit", prompt: "이 내용을 내가 지시한적 있음?" });
      assert.equal(hook({ hook_event_name: "UserPromptSubmit", prompt: "근데 왜 todo에 추가함?" }).stdout, "");
      assert.equal(
        hook({ hook_event_name: "Stop", last_assistant_message: "로그 형식을 잘못 해석했기 때문입니다." }).stdout,
        ""
      );
      assert.equal(JSON.parse(answer("정리했습니다.")).decision, "block");
      writeFileSync(judge, "#!/bin/sh\ncat >/dev/null\necho '{\"ask\": false}'\n");
      hook({ hook_event_name: "UserPromptSubmit", prompt: "왜 그렇게 판단했어?" });
      assert.equal(
        hook({ hook_event_name: "Stop", last_assistant_message: "당시 판단은 다음과 같습니다." }).stdout,
        ""
      );
    });
  });
}

test("코덱스 완료 주장 검사가 실제 JSONL의 최신 사용자 요청과 도구 근거를 전달한다", () => {
  withTmp("harness-completion-evidence-", tmp => {
    const bin = join(tmp, "bin");
    const capture = join(tmp, "prompt.txt");
    const transcript = join(tmp, "transcript.jsonl");

    mkdirSync(bin);
    writeFileSync(
      join(bin, "codex"),
      `#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\nout="$2"\ncat >"${capture}"\necho '{"ok": false, "reason": "남은 파일과 완료 주장이 다릅니다."}' >"$out"\n`
    );
    chmodSync(join(bin, "codex"), 0o755);
    writeFileSync(
      transcript,
      [
        { type: "response_item", payload: { role: "user", content: [{ type: "input_text", text: "이전 질문" }] } },
        { type: "response_item", payload: { type: "function_call_output", output: "OLD-EVIDENCE" } },
        {
          type: "response_item",
          payload: {
            role: "user",
            content: [{ type: "input_text", text: "관련 파일 전부 제거하고 TODO대로 동기화해" }],
          },
        },
        {
          type: "response_item",
          payload: { type: "function_call_output", output: "CURRENT-RESIDUE: remaining.test.mjs" },
        },
        {
          type: "response_item",
          payload: { role: "assistant", content: [{ type: "output_text", text: "EARLIER-EXPLANATION" }] },
        },
        {
          type: "response_item",
          payload: {
            role: "user",
            content: [{ type: "input_text", text: "<codex_internal_context>continue</codex_internal_context>" }],
          },
        },
      ]
        .map(entry => JSON.stringify(entry))
        .join("\n")
    );

    const result = spawnSync("sh", [resolve(H, ".codex/hooks/block-unverified-claims.sh")], {
      input: JSON.stringify({
        turn_id: "completion",
        transcript_path: transcript,
        last_assistant_message: "모두 완료했습니다.",
      }),
      encoding: "utf8",
      env: { ...env, TMPDIR: tmp, PATH: `${bin}:${env.PATH}` },
    });

    const prompt = readFileSync(capture, "utf8");

    assert.equal(JSON.parse(result.stdout).decision, "block");
    assert.ok(prompt.includes("관련 파일 전부 제거"));
    assert.ok(prompt.includes("CURRENT-RESIDUE"));
    assert.ok(prompt.includes("EARLIER-EXPLANATION"));
    assert.ok(!prompt.includes("OLD-EVIDENCE"));
  });
});

for (const tool of [".claude", ".codex"])
  test(`${tool} 질문 창의 질문 본문을 제외하고 선택 답만 판정`, () => {
    const prompt = `<send_user_message_question_reply>${JSON.stringify([{ answer: "위 diff 적용", question: "청사진을 검토하고 적용할까요?" }])}</send_user_message_question_reply>`;
    const extract = prompt =>
      spawnSync("sh", [join(H, tool, "hooks/user-prompt-text.sh")], {
        input: JSON.stringify({ prompt }),
        encoding: "utf8",
      });
    assert.equal(extract(prompt).stdout.trim(), "위 diff 적용");
    const session_id = `question-answer-${tool}`;
    const submit = value =>
      run(tool, "confirm-edit-on-report-request", { hook_event_name: "UserPromptSubmit", session_id, prompt: value });
    const edit = () =>
      run(tool, "confirm-edit-on-report-request", {
        hook_event_name: "PreToolUse",
        session_id,
        tool_input: { file_path: join(H, "src/example.ts") },
      });
    submit(prompt);
    assert.equal(edit().stdout.trim(), "");
    submit("판단 후 보고만 해");
    assert.equal(JSON.parse(edit().stdout).hookSpecificOutput.permissionDecision, "ask");
    submit(
      '<send_user_message_question_reply>[{"answer":"수정해", "question":"보고만 할까요?"}]</send_user_message_question_reply>'
    );
    assert.equal(edit().stdout.trim(), "");
    const invalid = extract("<send_user_message_question_reply>invalid</send_user_message_question_reply>");
    assert.equal(invalid.status, 0, invalid.stderr);
    assert.equal(invalid.stdout.trim(), "");
  });
