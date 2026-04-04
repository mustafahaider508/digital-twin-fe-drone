const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "test-results/uc8-current-flow",
  reporter: [["html", { open: "never", outputFolder: "test-results/uc8-current-flow" }]],
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_UIBUILDER_ENTRY: "dashboard",
      NEXT_PUBLIC_API_BASE: "http://localhost:5556",
    },
  },
});

