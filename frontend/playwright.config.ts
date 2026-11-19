// 믿집 v3 흐름 검증 e2e (B8, ADR docs/v3/adr/dev-09-e2e.md)
// - 프로젝트 둘: 폰 390×844 · 웹 1280×800. 같은 이야기를 두 배치에서 끝까지 눌러요.
// - 서버: API 8018(시연 DB를 mitjip_v3_e2e로 복사해 띄움, 리드 도구) + 화면 3108(next dev, 출력 폴더 .next-e2e).
// - 시험마다 시험 DB를 시연 데이터로 되돌려서(e2e/support/fixtures.ts) 한 줄로 돌아요(workers 1).
// - 브라우저는 내려받지 않아요: 로컬은 깔린 Edge(channel msedge), E2E_CHANNEL=chrome이면 Chrome. CI만 내려받은 chromium.
// - 결과 · 스크린샷 · 서버 기록은 e2e/.out/ (git 밖에 둘 곳)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import { API_PORT, OUT_DIR, WEB_PORT, WEB_URL, bashEnv, bashPath } from "./e2e/support/env";

const CI = !!process.env.CI;
const BASH = `"${bashPath()}"`;
// 서버 기록 파일 자리(서버가 globalSetup보다 먼저 떠요). 셸(Windows cmd · bash)이 바로 이 파일로 넘겨요
mkdirSync(OUT_DIR, { recursive: true });
const log = (name: string) => `"${path.join(OUT_DIR, name)}"`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  outputDir: "./e2e/.out/results",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: CI,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e/.out/report.json" }],
    ["html", { outputFolder: "e2e/.out/html", open: "never" }],
  ],
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: {
    baseURL: WEB_URL,
    channel: CI ? undefined : process.env.E2E_CHANNEL || "msedge",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: "web", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      // 리드 도구: 시연 DB(mitjip_v3)를 mitjip_v3_e2e로 새로 복사하고 API를 띄워요(Redis db 6, APP_ENV=local, LLM 키 비움)
      // 셸이 bash 하나만 띄워요(프로세스 줄이 이어져 시험 끝에 서버까지 같이 꺼져요)
      command: `${BASH} ../.claude/run-api-copy.sh e2e ${API_PORT} > ${log("api.log")} 2>&1`,
      env: bashEnv(),
      url: `http://127.0.0.1:${API_PORT}/health/live`,
      reuseExistingServer: !CI,
      timeout: 240_000,
    },
    {
      command: `pnpm exec next dev --port ${WEB_PORT} > ${log("web.log")} 2>&1`,
      env: { NEXT_DIST_DIR: ".next-e2e", API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: "1" },
      url: `${WEB_URL}/offline`,
      reuseExistingServer: !CI,
      timeout: 300_000,
    },
  ],
});
