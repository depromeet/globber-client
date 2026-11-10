import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) },
  },
  test: {
    include: ["apps/web/src/**/*.test.ts", "packages/shared/src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
