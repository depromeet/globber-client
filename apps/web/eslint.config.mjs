import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  // 전역 제외 패턴 — CJS 설정 파일 및 빌드 산출물 제외
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "dist/",
      "next-env.d.ts",
      "scripts/",
      ".lintstagedrc.js", // CJS 문법을 사용하는 lint-staged 설정 파일
    ],
  },

  // 레거시 플러그인/익스텐드를 flat config로 변환
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "plugin:@tanstack/eslint-plugin-query/recommended",
    "prettier"
  ),
  ...compat.plugins("simple-import-sort"),

  // 프로젝트 커스텀 룰
  {
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [["^\\u0000"], ["^react", "^next"], ["^@?\\w"], ["^@/"], ["^.+\\.s?css$"], ["^\\."]],
        },
      ],
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "no-void": "error",
      "@typescript-eslint/no-array-index-key": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",

      // eslint-plugin-react-hooks v7에서 추가된 React Compiler 전용 룰
      // 이 프로젝트는 React Compiler를 사용하지 않으므로 비활성화
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
];

export default config;
