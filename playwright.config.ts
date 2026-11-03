import { defineConfig, devices } from "@playwright/test";
import { E2E_EXAMPLES, serverCommand } from "./e2e/examples";

// Перед запуском: pnpm build && pnpm build:examples (это делает скрипт pnpm e2e).
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure", locale: "ru-RU" },
  projects: E2E_EXAMPLES.map((example) => ({
    name: example.name,
    use: { ...devices["Desktop Chrome"], baseURL: example.baseURL },
  })),
  webServer: E2E_EXAMPLES.map((example) => ({
    command: serverCommand(example),
    url: `${example.baseURL}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  })),
});
