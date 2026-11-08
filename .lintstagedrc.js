const { existsSync } = require("node:fs");
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
    if (!["js", "mjs", "cjs"].some(ext => existsSync(path.join(ROOT, workspace, `eslint.config.${ext}`)))) continue;
    byWorkspace.set(workspace, [...(byWorkspace.get(workspace) ?? []), file]);
  }

  return [...byWorkspace.entries()].map(
    ([workspace, files]) =>
      `pnpm --dir ${workspace} exec eslint --fix --max-warnings=0 --no-warn-ignored ${files.map(f => JSON.stringify(f)).join(" ")}`
  );
};

/** @type {import('lint-staged').Configuration} */
module.exports = {
  // JS/TS 파일: 워크스페이스별 ESLint auto-fix
  "*.{js,jsx,ts,tsx,mjs}": [buildLintCommands],
  // 웹·공유·앱 소스의 em dash 금지 검사를 유지
  "{apps,packages}/**/src/**/*.{js,jsx,ts,tsx}": ["sh scripts/check-em-dash-in-source.sh"],
  // 모든 지원 파일: Prettier 자동 포맷
  "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write"],
};
