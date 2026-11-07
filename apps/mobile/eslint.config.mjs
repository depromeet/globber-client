import base from "@globber/config/eslint/base";

export default [
  ...base,
  { ignores: [".expo/", ".expo-export/", "expo-env.d.ts", "metro.config.js"] },
  {
    // 앱 셸에서는 웹 전용 API만 제한합니다.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "앱에서는 Next.js API를 사용할 수 없습니다." },
            { group: ["react-dom", "react-dom/*"], message: "앱에서는 react-dom을 사용할 수 없습니다." },
          ],
        },
      ],
    },
  },
];
