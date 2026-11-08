// 하네스 Claude·Codex 짝 일치 검사: 역할 본문·설명, 스킬 파일 집합, 훅 등록 파일 존재
// 실행: node --test .harness/spec.test.mjs 또는 pnpm test
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// 프로젝트에서는 저장소 루트, 허브에서는 harness/
const H = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(join(H, path), "utf8");
const names = (dir, ext) =>
  readdirSync(join(H, dir))
    .filter(f => f.endsWith(ext))
    .map(f => f.slice(0, -ext.length))
    .sort();
const walk = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );

const roleBody = body => body.replaceAll("`CLAUDE.md` · ", "").replaceAll(".claude/skills/", ".agents/skills/").trim();

test("역할은 Claude판과 Codex판의 집합·설명·본문이 같음", () => {
  assert.deepEqual(names(".claude/agents", ".md"), names(".codex/agents", ".toml"));
  for (const role of names(".claude/agents", ".md")) {
    const [, front, ...rest] = read(`.claude/agents/${role}.md`).split(/^---$/m);
    const toml = read(`.codex/agents/${role}.toml`);
    const description = front.match(/^description: (.*)$/m)[1];
    assert.equal(JSON.parse(toml.match(/^description = (".*")$/m)[1]), description, role);
    const body = toml.match(/^developer_instructions = ("""|''')\n([\s\S]*?)\1$/m)[2];
    // Codex는 CLAUDE.md를 읽지 않아 Claude판에만 있는 참조는 비교에서 뺌
    assert.equal(roleBody(rest.join("---")), roleBody(body), role);
  }
});

test("역할 본문의 도구별 스킬 경로 차이는 허용하되 절차 차이는 구분함", () => {
  const claude = "커밋 전 `.claude/skills/git-commit/SKILL.md`를 읽는다.";
  const codex = "커밋 전 `.agents/skills/git-commit/SKILL.md`를 읽는다.";
  assert.equal(roleBody(claude), roleBody(codex));
  assert.notEqual(roleBody(claude), roleBody(codex.replace("읽는다", "읽지 않는다")));
});

test("스킬은 .claude/skills와 .agents/skills의 파일 집합이 같음", () => {
  const files = dir =>
    walk(join(H, dir))
      .map(f => relative(join(H, dir), f))
      .sort();
  assert.deepEqual(files(".claude/skills"), files(".agents/skills"));
});

test("훅 등록이 가리키는 파일이 모두 있음", () => {
  const commands = [
    ...JSON.stringify(JSON.parse(read(".claude/settings.json")).hooks).matchAll(
      /\.(?:claude|codex|harness)\/[\w/-]+\.(?:sh|mjs)/g
    ),
    ...JSON.stringify(JSON.parse(read(".codex/hooks.json")).hooks).matchAll(
      /\.(?:claude|codex|harness)\/[\w/-]+\.(?:sh|mjs)/g
    ),
  ].map(([path]) => path);
  assert.ok(commands.length > 0);
  for (const path of commands) assert.ok(existsSync(join(H, path)), path);
});

const AGENT_SECTIONS = ["책임", "입력", "출력", "작업 방식", "팀 통신 프로토콜", "하지 말아야 할 일"];
const PROTOCOL_ITEMS = ["메시지 수신", "메시지 발신", "작업 요청", "파일 산출물", "차단 조건"];
const ORCHESTRATOR_SECTIONS = [
  "목적",
  "실행 모드",
  "실행 모드 확인",
  "Agent Team 구성",
  "Task 등록 계약",
  "하이브리드 전환",
  "실패 처리",
  "산출물 계약",
  "테스트 프롬프트",
];
const SKILL_SECTIONS = ["역할", "사용 조건", "입력", "절차", "출력", "품질 기준", "테스트 프롬프트"];
// 외부 가이드와 별도 형식으로 작성된 스킬은 각자의 기존 계약을 검사
const SKILL_CONTRACTS = {
  "scaffold-web-project": ["입력 확인", "구성 순서", "완료 기준", "사용 예시"],
  "feature-team-orchestrator": [
    "목적",
    "전제 조건",
    "실행 모드",
    "실행 모드 확인",
    "Agent Team 구성",
    "Task 등록 계약",
    "Agent Team 실행 흐름",
    "도구 미연결 처리",
    "사람 승인 지점",
    "실패 처리",
  ],
  "harness-lab": ["역할", "기본 원칙", "실행 모드", "품질 기준"],
  "itd-commit": ["Overview", "커밋 컨벤션", "Workflow", "규칙"],
  "pr-create": ["입력과 권한", "변경과 대상 확인", "제목·본문·메타데이터 작성", "저장·게시·확인"],
  "coderabbit-triage": ["Overview", "Workflow", "출력 형식", "품질 기준", "예외 상황"],
  "finding-validity-gate": ["Overview", "트리거", "절차", "출력 형식", "품질 기준", "예외"],
};
const checkHeadings = (source, headings, file) => {
  const lines = source.split("\n").map(line => line.trimEnd());
  for (const heading of headings) assert.ok(lines.includes(`## ${heading}`), `${file}: ## ${heading}`);
};

test("역할 명세에 필수 절·팀 통신 항목과 도구별 메타데이터가 있음", () => {
  for (const role of names(".claude/agents", ".md")) {
    const claude = read(`.claude/agents/${role}.md`);
    const codex = read(`.codex/agents/${role}.toml`);
    for (const [file, source] of [
      [`${role}.md`, claude],
      [`${role}.toml`, codex],
    ]) {
      // Feature Team은 별도 산출물·통신 계약을 쓰며 implementer의 금지사항은 작업 방식에 포함
      const featureRole = ["implementer", "integration-reviewer", "prior-art-researcher", "spec-planner"].includes(
        role
      );
      checkHeadings(
        source,
        role === "implementer"
          ? ["전제 조건", ...AGENT_SECTIONS.filter(heading => heading !== "하지 말아야 할 일")]
          : AGENT_SECTIONS,
        file
      );
      for (const item of featureRole ? PROTOCOL_ITEMS.filter(item => item !== "작업 요청") : PROTOCOL_ITEMS)
        assert.ok(source.includes(item), `${file}: ${item}`);
    }
    const front = claude.split(/^---$/m)[1];
    assert.match(front, /^model: \S+/m, role);
    assert.match(front, /^tools: \S+/m, role);
    assert.match(codex, /^model = "[^"\n]+"$/m, role);
    assert.match(codex, /^model_reasoning_effort = "(?:minimal|low|medium|high|xhigh|max|ultra)"$/m, role);
  }
});

test("양쪽 스킬 명세에 해당 작성 형식의 필수 절이 있음", () => {
  for (const skill of readdirSync(join(H, ".claude/skills"))) {
    const headings =
      SKILL_CONTRACTS[skill] ?? (skill.endsWith("-orchestrator") ? ORCHESTRATOR_SECTIONS : SKILL_SECTIONS);
    for (const tool of [".claude", ".agents"]) {
      const file = `${tool}/skills/${skill}/SKILL.md`;
      checkHeadings(read(file), headings, file);
    }
  }
});
