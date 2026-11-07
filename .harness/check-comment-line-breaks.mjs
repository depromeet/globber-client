// 주석 줄바꿈·종결어미 기준 검사기
// 기준은 docs/agent-rules/project-structure.md 참조
// 사용법 1: node scripts/check-comment-line-breaks.mjs <file...> (lint-staged, 스테이징 내용 검사)
// 사용법 2: node scripts/check-comment-line-breaks.mjs --hook (PreToolUse 훅, stdin JSON 검사)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|sh)$/;
const SCOPED_DIR = /(^|\/)(src|tests|__tests__|scripts|\.claude\/hooks|\.codex\/hooks)\//;
// 검사기 자체의 차단 동작을 검증하는 위반 입력 샘플 유지
const FIXTURE_DIR = /(^|\/)__tests__\/lint\//;

const DIRECTIVE = /^(biome-ignore|@ts-|eslint|prettier-ignore|react-doctor-disable|istanbul|#(end)?region|TODO|FIXME)/;
const LIST_ITEM = /^([-*+]\s|\d+[.)]\s|@\w)/;
// 문장 중간을 뜻하는 줄 끝: 쉼표, 조사, 연결어미, 접속어
const KO_CONTINUATION =
  /(,|[는를을은에와]|에서|에게|으로|하고|하며|하면|되면|이면|지만|는데|해서|되어|하여|위해|대해|통해|따라|및|또는|그리고|하지만)$/;
const EN_CONTINUATION = /\b(and|or|but|the|a|an|to|of|in|on|for|with|by|from|that|which|is|are|if|when)$/i;
// 완결형 종결어미(~다) 줄 끝, "마다"는 제외
const SENTENCE_ENDING = /(?<!마)다[.!]?[)"'`\]]?\.?$/;
const ABBREVIATION = /\b(e\.g|i\.e|etc|vs|cf)\.$/i;

/** 주석 블록 목록 반환, 블록은 { kind, lines: [{ no, text, raw }] } 형태 */
function collectBlocks(source, shell) {
  const linePrefix = shell ? /^#(?!!)/ : /^\/\//;
  const lineMarker = shell ? /^#+\s?/ : /^\/\/+\s?/;
  const blocks = [];
  let current = null;
  let inBlock = null;
  source.split("\n").forEach((raw, index) => {
    const no = index + 1;
    const trimmed = raw.trim();
    if (inBlock) {
      const closes = trimmed.includes("*/");
      const body = trimmed.replace(/\*\/\}?$/, "").trimEnd();
      inBlock.lines.push({
        no,
        raw: trimmed,
        text: body.replace(/^\*\s?/, ""),
      });
      if (closes) inBlock = null;
      return;
    }
    if (!shell && /^\{?\/\*/.test(trimmed)) {
      current = null;
      const opened = { kind: "block", lines: [] };
      const body = trimmed
        .replace(/^\{?\/\*\*?/, "")
        .replace(/\*\/\}?$/, "")
        .trim();
      opened.lines.push({ no, raw: trimmed, text: body, first: true });
      blocks.push(opened);
      if (!trimmed.slice(2).includes("*/")) inBlock = opened;
      return;
    }
    if (linePrefix.test(trimmed)) {
      const indent = raw.length - raw.trimStart().length;
      if (!current || current.indent !== indent) {
        current = { kind: "line", indent, lines: [] };
        blocks.push(current);
      }
      current.lines.push({
        no,
        raw: trimmed,
        text: trimmed.replace(lineMarker, ""),
      });
      return;
    }
    current = null;
  });
  return blocks;
}

function checkSource(source, path) {
  const violations = [];
  for (const block of collectBlocks(source, path.endsWith(".sh"))) {
    const { lines } = block;
    if (block.kind === "block") {
      for (const line of lines.slice(1)) {
        if (line.raw && !line.raw.startsWith("*")) {
          violations.push({
            no: line.no,
            rule: "블록 주석의 둘째 줄부터는 `*`로 시작해 정렬",
          });
        }
      }
    }
    lines.forEach((line, index) => {
      const text = line.text.trim();
      if (!text || DIRECTIVE.test(text) || /https?:\/\//.test(text)) return;
      if (SENTENCE_ENDING.test(text)) {
        violations.push({
          no: line.no,
          rule: "완결형 종결어미(~다) 대신 명사형(~함, ~됨, ~수정)으로 끝맺음",
        });
      }
      // 목록 번호("1. ")와 말줄임표("...")는 문장 끝으로 보지 않음
      const twoSentences = text.replace(LIST_ITEM, "").match(/^(.*?[^.][.!?])(?!\.)\s+[가-힣A-Z]/);
      if (twoSentences && !ABBREVIATION.test(twoSentences[1])) {
        violations.push({ no: line.no, rule: "한 줄에 한 문장만 작성" });
      }
      const next = lines[index + 1]?.text.trim();
      if (!next || LIST_ITEM.test(next) || DIRECTIVE.test(next)) return;
      const brokenEnglish = /[a-z]$/.test(text) && /^[a-z]/.test(next);
      if (KO_CONTINUATION.test(text) || EN_CONTINUATION.test(text) || brokenEnglish) {
        violations.push({
          no: line.no,
          rule: "문장 중간 줄바꿈 금지, 다음 줄과 이어서 한 줄로 작성",
        });
      }
    });
  }
  return violations;
}

function isScoped(path) {
  return SOURCE_EXT.test(path) && SCOPED_DIR.test(path) && !FIXTURE_DIR.test(path);
}

function format(path, violations, source) {
  const lines = source.split("\n");
  return violations.map(({ no, rule }) => `${path}:${no}: ${rule}\n  ${lines[no - 1]?.trim()}`).join("\n");
}

function runHook() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    // 훅 입력을 해석할 수 없으면 편집을 막지 않고 커밋 시점 검사에 위임
    return 0;
  }
  const path = input.tool_input?.file_path ?? "";
  if (!isScoped(path)) return 0;
  let source;
  let range = null;
  if (input.tool_name === "Write") {
    source = input.tool_input.content ?? "";
  } else if (input.tool_name === "Edit") {
    const { old_string: oldText = "", new_string: newText = "" } = input.tool_input;
    const before = existsSync(path) ? readFileSync(path, "utf8") : "";
    const at = before.indexOf(oldText);
    // 원본에서 old_string을 못 찾으면 수정 조각만 검사
    source = at < 0 ? newText : before.slice(0, at) + newText + before.slice(at + oldText.length);
    const start = at < 0 ? 1 : before.slice(0, at).split("\n").length;
    // 수정 범위와 맞닿은 주석 줄까지 포함해 기존 위반이 무관한 편집을 막지 않도록 함
    range = [start - 1, start + newText.split("\n").length];
  } else {
    return 0;
  }
  const violations = checkSource(source, path).filter(({ no }) => !range || (no >= range[0] && no <= range[1]));
  if (!violations.length) return 0;
  console.error(`차단: 주석 줄바꿈·종결어미 기준 위반\n${format(path, violations, source)}`);
  console.error("→ 한 줄은 한 문장으로 작성하고, 문장 중간에서 줄을 나누지 마세요.");
  return 2;
}

function runFiles(files) {
  const reports = [];
  for (const file of files.filter(isScoped)) {
    let source;
    try {
      // lint-staged의 다른 작업과 병렬 실행돼도 커밋할 index 내용 검사
      source = execFileSync("git", ["show", `:${file}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      source = readFileSync(file, "utf8");
    }
    const violations = checkSource(source, file);
    if (violations.length) reports.push(format(file, violations, source));
  }
  if (!reports.length) return 0;
  console.error(`✖ 차단: 주석 줄바꿈·종결어미 기준 위반\n${reports.join("\n")}`);
  console.error("→ 한 줄은 한 문장으로 작성하고, 문장 중간에서 줄을 나누지 마세요.");
  return 1;
}

const args = process.argv.slice(2);
process.exit(args[0] === "--hook" ? runHook() : runFiles(args));
