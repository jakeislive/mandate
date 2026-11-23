import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "static-demo.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4030", browserName: "chromium", trace: "retain-on-failure" },
  webServer: { command: "pnpm dev --host 127.0.0.1 --port 4030", url: "http://127.0.0.1:4030", reuseExistingServer: false, env: { VITE_STATIC_DEMO: "false" } },
});
