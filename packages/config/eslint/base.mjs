import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import simpleImportSort from "eslint-plugin-simple-import-sort";

/**
 * 플랫폼 공유 패키지(shared/api/query 등)용 ESLint 베이스 설정.
 * 웹(Next.js) 전용 API에 의존하지 않도록 import를 제한합니다.
 */
const config = [
  {
    ignores: ["node_modules/", "dist/", ".turbo/"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [["^\\u0000"], ["^react"], ["^@?\\w"], ["^\\."]],
        },
      ],
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "error",
      "no-void": "error",
      // 웹/네이티브 어느 쪽에서도 동작해야 하므로 Next.js·react-dom·웹 앱 alias 의존 금지
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "공유 패키지에서는 Next.js API를 사용할 수 없습니다." },
            { group: ["react-dom", "react-dom/*"], message: "공유 패키지에서는 react-dom을 사용할 수 없습니다." },
            { group: ["@/*"], message: "공유 패키지에서는 웹 앱 alias(@/)를 사용할 수 없습니다." },
          ],
        },
      ],
    },
  },
];

export default config;
