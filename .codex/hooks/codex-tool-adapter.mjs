// Codex 훅 입력을 Claude 형식으로 바꿔 같은 훅 스크립트를 실행하는 어댑터
// 사용법: node .codex/hooks/codex-tool-adapter.mjs <훅 이름> (stdin JSON)
// - apply_patch: tool_input.command의 패치를 파일별 Write(추가)·Edit(hunk 단위 수정)·Delete 입력으로 분해
// - spawn_agent: tool_input.agent_type을 subagent_type으로 복사
// - Codex PreToolUse는 permissionDecision "ask"를 지원하지 않아 "deny"로 변환
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function patchCalls(input, patch) {
  const calls = [];
  const call = (tool_name, tool_input) => calls.push({ ...input, tool_name, tool_input });
  let file = null;
  let hunk = null;
  const flush = () => {
    if (!file) return;
    if (file.kind === "add") {
      call("Write", { file_path: file.path, content: file.added.join("\n") });
    } else if (file.kind === "delete") {
      call("Delete", { file_path: file.path });
    }
    file = null;
  };
  const flushHunk = () => {
    if (hunk && (hunk.old.length || hunk.new.length)) {
      call("Edit", {
        file_path: file.path,
        old_string: hunk.old.join("\n"),
        new_string: hunk.new.join("\n"),
      });
    }
    hunk = null;
  };
  for (const line of patch.split("\n")) {
    const header = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
    if (header) {
      flushHunk();
      flush();
      file = { kind: header[1].toLowerCase(), path: header[2], added: [] };
      continue;
    }
    if (!file) continue;
    const move = line.match(/^\*\*\* Move to: (.+)$/);
    if (move) {
      file.path = move[1];
    } else if (file.kind === "add") {
      if (line.startsWith("+")) file.added.push(line.slice(1));
    } else if (file.kind === "update") {
      if (line.startsWith("@@") || line.startsWith("***")) {
        flushHunk();
        if (line.startsWith("@@")) hunk = { old: [], new: [] };
        continue;
      }
      hunk ??= { old: [], new: [] };
      const body = line.slice(1);
      if (line.startsWith("-")) hunk.old.push(body);
      else if (line.startsWith("+")) hunk.new.push(body);
      else if (line.startsWith(" ")) {
        hunk.old.push(body);
        hunk.new.push(body);
      }
    }
  }
  flushHunk();
  flush();
  return calls;
}

function toCalls(input) {
  const tool_input = input.tool_input ?? {};
  if (input.tool_name?.split(".").at(-1) === "apply_patch") {
    const patch =
      typeof tool_input === "string" ? tool_input : (tool_input.command ?? tool_input.patch ?? tool_input.input ?? "");
    return patchCalls(input, patch);
  }
  if (tool_input.agent_type && !tool_input.subagent_type) {
    return [
      {
        ...input,
        tool_input: { ...tool_input, subagent_type: tool_input.agent_type },
      },
    ];
  }
  return [input];
}

function askToDeny(stdout) {
  try {
    const output = JSON.parse(stdout);
    if (output.hookSpecificOutput?.permissionDecision !== "ask") return stdout;
    output.hookSpecificOutput.permissionDecision = "deny";
    return JSON.stringify(output);
  } catch {
    return stdout;
  }
}

const hook = process.argv[2];
let input;
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // 입력을 해석할 수 없으면 원본 훅과 같이 통과시킴
  process.exit(0);
}
const script = join(dirname(fileURLToPath(import.meta.url)), `${hook}.sh`);
for (const call of toCalls(input)) {
  const result = spawnSync("sh", [script], {
    input: JSON.stringify(call),
    encoding: "utf8",
  });
  process.stderr.write(result.stderr ?? "");
  if (result.status === 2) process.exit(2);
  const stdout = askToDeny(result.stdout ?? "");
  // 첫 판정 출력만 전달해 여러 JSON이 이어 붙지 않도록 함
  if (stdout.trim()) {
    process.stdout.write(stdout);
    break;
  }
}
process.exit(0);
