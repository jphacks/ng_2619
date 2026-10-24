import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // 結合テストは同じDBを使うため直列で実行する
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
