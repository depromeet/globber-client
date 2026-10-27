const path = require("node:path");

const ROOT = __dirname;
// ESLint 설정이 각 워크스페이스에 있으므로, staged 파일을 워크스페이스별로 묶어 해당 디렉토리에서 실행
const WORKSPACE_PATTERN = /^(apps|packages)\/[^/]+$/;

const buildLintCommands = filenames => {
  const byWorkspace = new Map();

  for (const file of filenames) {
    const relative = path.relative(ROOT, file).split(path.sep);
    const workspace = relative.slice(0, 2).join("/");

    if (!WORKSPACE_PATTERN.test(workspace)) continue;
    byWorkspace.set(workspace, [...(byWorkspace.get(workspace) ?? []), file]);
  }

  return [...byWorkspace.entries()].map(
    ([workspace, files]) => `pnpm --dir ${workspace} exec eslint --fix ${files.map(f => JSON.stringify(f)).join(" ")}`
  );
};

/** @type {import('lint-staged').Configuration} */
module.exports = {
  // JS/TS 파일: 워크스페이스별 ESLint auto-fix
  "*.{js,jsx,ts,tsx,mjs}": [buildLintCommands],
  // 모든 지원 파일: Prettier 자동 포맷
  "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write"],
};
