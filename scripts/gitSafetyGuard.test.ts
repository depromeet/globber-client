import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = process.cwd();
let fixture: string;

beforeAll(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "globber-hook-")));
  const result = spawnSync("git", ["init", "-b", "feature", fixture]);
  expect(result.status).toBe(0);
});

afterAll(() => rmSync(fixture, { recursive: true, force: true }));

describe.each([".claude", ".codex"])("%s Git 안전 훅", tool => {
  const check = (command: string) =>
    spawnSync("sh", [resolve(root, tool, "hooks/git-safety-guard.sh")], {
      cwd: fixture,
      input: JSON.stringify({ tool_input: { command } }),
      encoding: "utf8",
    });

  it.each([
    "git reset --hard",
    "git -C /tmp push origin main",
    'git -C "/tmp/space dir" -c core.hooksPath=/tmp reset --hard',
    "git -c k=v reset --hard",
    "git --git-dir=/tmp/repo --no-pager reset --hard",
    "git push origin +main",
    "git push origin HEAD:refs/heads/main",
    "git push origin HEAD:main",
    "git push --delete origin feature",
    "git push origin -d feature",
    "git checkout -f feature",
    "git checkout --force feature",
    "git worktree remove --force /tmp/work",
    "git worktree remove -f /tmp/work",
    "git clean -fd",
    "git branch -D feature",
    "git checkout -- .",
    "git restore .",
    "git stash",
    "git stash drop",
    "git push --force origin feature",
    "git commit --no-verify",
    "echo ready && git -C /tmp push origin main",
  ])("고위험 명령을 실행하지 않고 차단한다: %s", command => {
    const result = check(command);
    expect(result.stderr).toContain("차단:");
    expect(result.status).toBe(2);
  });

  it.each([
    "git status --short",
    "git -C /tmp status",
    "git -c k=v diff",
    "git push origin feature",
    "git push origin main-fix",
    "git push origin main:feature",
    "git checkout feature",
    "git worktree remove /tmp/work",
    "git stash apply abc123",
    "pnpm test",
    "printf '%s' --no-verify",
  ])("일반 명령은 허용한다: %s", command => {
    expect(check(command).status).toBe(0);
  });
});

describe("em dash 커밋 검사", () => {
  it.each([false, true])("절대 경로 여부(%s)와 관계없이 작업 파일 대신 index를 검사한다", absolute => {
    const name = "space file.ts";
    const path = join(fixture, name);
    const check = () =>
      spawnSync("sh", [resolve(root, "scripts/check-em-dash-in-source.sh"), absolute ? path : name], {
        cwd: fixture,
      }).status;
    const stage = () => expect(spawnSync("git", ["add", "--", name], { cwd: fixture }).status).toBe(0);

    writeFileSync(path, "// em dash —\n");
    stage();
    writeFileSync(path, "// 하이픈 -\n");
    expect(check()).toBe(1);

    stage();
    writeFileSync(path, "// em dash —\n");
    expect(check()).toBe(0);
  });
});
