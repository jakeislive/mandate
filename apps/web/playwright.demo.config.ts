import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "static-demo.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4031", browserName: "chromium", trace: "retain-on-failure" },
  webServer: { command: "pnpm dev --host 127.0.0.1 --port 4031", url: "http://127.0.0.1:4031", reuseExistingServer: false, env: { VITE_STATIC_DEMO: "true" } },
});
