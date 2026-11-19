// 시험 틀 (B8): 시험마다 시험 DB를 시연 데이터로 되돌리고(freshDb), 두 번째 사용자 문맥을 열어 줘요.
// 폰 · 웹 프로젝트가 같은 이야기를 같은 시연 데이터에서 따로 돌 수 있게, 시험은 한 줄로(workers 1) 돌아요.
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { loginApi } from "./api";
import { resetDb } from "./db";

type Fixtures = {
  freshDb: void;
  /** 두 번째 사용자(업체 · 관리자) 문맥을 열어요. 시험이 끝나면 닫혀요 */
  other: (email?: string) => Promise<{ context: BrowserContext; page: Page }>;
};

export const test = base.extend<Fixtures>({
  freshDb: [
    // Playwright는 fixture 첫 인자를 꼭 구조 분해 꼴로 받아요(쓰는 fixture가 없으면 빈 꼴)
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      resetDb();
      await use();
    },
    { auto: true, timeout: 120_000 },
  ],
  other: async ({ browser }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (email?: string) => {
      const context = await browser.newContext();
      opened.push(context);
      if (email) await loginApi(context, email);
      return { context, page: await context.newPage() };
    });
    for (const c of opened) await c.close().catch(() => {});
  },
});

export { expect };
