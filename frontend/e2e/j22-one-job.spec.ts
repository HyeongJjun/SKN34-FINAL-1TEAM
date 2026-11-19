// J22 공사 한 건 · 추가 금액 · 공사 끝(D25 · D23 · D24)
// 화면: V03(작업함 공사 탭) · V23 · V12 · C37 · V13 · C38 · C39 (+ C44 알림). 웹은 같은 경로의 D04 배치예요.
//   ① 장공사(c09, 오늘이 마지막 공사일): 업체가 화면으로 로그인(C06) → 공사 탭 → 공사 한 건 → 추가 금액 → 고객 승인
//      → 업체 '공사 끝냈어요' → 고객 공사 끝 확인 → 리뷰
//   ② 임끝남(c10, 공사 끝 확인 기다림): 기한 당기기(지금 + 8일, 리드 도구 run-due-copy.sh)로 자동 끝(D24) → 고객 화면 · 알림
// 시험마다 시험 DB가 시연 데이터로 돌아가요. 금액은 API 값(계산 엔진)과 견줘요.
// 화면 글은 9판이 기준이고, copy-fixes로 바뀐 글은 지금 글을 써요(CF-23 '공사 끝냈어요' 단추 → '공사 끝 알리기', CF-64 · CF-65 V12 칸 이름).
import type { BrowserContext, Page } from "@playwright/test";
import { apiGet, loginApi, myProject } from "./support/api";
import { runDue } from "./support/db";
import { DEMO, demoPassword } from "./support/env";
import { asset } from "./support/files";
import { expect, test } from "./support/fixtures";
import { choose, expectNoEnglishState, expectNoSideScroll, isPhone, loginUi, shot, shown, won, wonFull } from "./support/ui";

const MARU = "마루와벽";

// ---- 화면 글 모양(lib/format과 같은 꼴, 시험 쪽에서 따로 만들어 견줘요) ----
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function seoulDay(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
const ymdOf = (iso: string) => seoulDay(iso).split("-").map(Number);
const weekOf = (y: number, m: number, d: number) => WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
/** '11.26(목)' */
function dShort(iso: string): string {
  const [y, m, d] = ymdOf(iso);
  return `${m}.${d}(${weekOf(y, m, d)})`;
}
/** '11월 19일(목)' */
function dLong(iso: string): string {
  const [y, m, d] = ymdOf(iso);
  return `${m}월 ${d}일(${weekOf(y, m, d)})`;
}
const wonDelta = (n: number) => (n > 0 ? `+${won(n)}` : won(n));

// ---- API 모양(필요한 칸만) ----
type MoneyOut = { supply: number; vat: number; total: number };
type ExtraOut = { id: string; title: string; reason: string; total: number; answer: string; superseded: boolean; after_total?: number | null };
type Extras = { items: ExtraOut[]; ok: MoneyOut; pending: MoneyOut; deal_total?: number | null; grand_total?: number | null };
type DealOut = {
  id: string;
  status: string;
  vendor_id: string | null;
  vendor_name: string;
  quote: { total: number; days: number | null; sent_at: string };
  work_days: string[];
  work_done_on: string | null;
  done_note?: string | null;
  auto_done_at?: string | null;
  done_remind_at?: string | null;
  review_open: boolean;
  review_id?: string | null;
  grand_total?: number | null;
};
type TradeDates = { deal: DealOut; dates_state: string; extras: Extras };
type Schedule = { trades: TradeDates[] };
type Job = {
  deal_id: string;
  status: string;
  dates_state: string;
  quote: { total: number; days: number | null };
  work_days: string[];
  can_finish: boolean;
  day_no?: number | null;
  grand_total?: number | null;
  auto_done_at?: string | null;
  extras: Extras;
};

async function dobaeOf(c: BrowserContext, pid: string): Promise<TradeDates> {
  const s = await apiGet<Schedule>(c, `/projects/${pid}/schedule`);
  const t = s.trades.find((x) => x.deal.vendor_name === MARU) ?? s.trades[0];
  expect(t, "공사(확정) 한 줄").toBeTruthy();
  return t;
}

async function customer(page: Page, email: string): Promise<string> {
  await loginApi(page.context(), email);
  return (await myProject(page.context())).id;
}

/** V12 업체 추가 금액 올리기(50,000원 · 부가세 빼고 · 이유 · 사진 1장) → 공사 한 건으로 돌아와요 */
async function postExtra(vpage: Page, dealId: string): Promise<void> {
  await shown(vpage.getByRole("link", { name: "추가 금액 올리기" })).first().click();
  await vpage.waitForURL(/step=extra/);
  await expect(vpage.getByRole("heading", { name: "추가 금액 올리기", level: 1 })).toBeVisible();
  await vpage.getByLabel("항목", { exact: true }).fill("곰팡이 방지 처리");
  await vpage.getByLabel("이유", { exact: true }).fill("작은방 벽 1면에 곰팡이가 있어요");
  await vpage.getByLabel("금액", { exact: true }).fill("50000");
  const preview = vpage.waitForResponse((r) => r.url().includes(`/api/vendor/jobs/${dealId}/extras/preview`) && r.status() === 200);
  await choose(vpage, "부가세", "빼고");
  const p = (await (await preview).json()) as MoneyOut;
  expect(p.supply + p.vat, "추가 금액 미리 보기: 공급가 + 부가세 = 합계").toBe(p.total);
  expect(p.total, "50,000원 부가세 빼고 → 55,000원(계산 엔진)").toBe(55_000);
  const calc = vpage.getByText("믿집 계산").locator("..");
  await expect(calc).toContainText(`공급가 ${wonFull(p.supply)}`);
  await expect(calc).toContainText(`부가세 ${wonFull(p.vat)}`);
  await expect(calc).toContainText(wonFull(p.total));
  const up = vpage.waitForResponse((r) => r.url().endsWith("/api/files") && r.request().method() === "POST");
  await vpage.locator('input[type="file"][aria-label="추가 금액 사진"]').setInputFiles(asset("wall-gps-1.jpg"));
  expect((await up).ok(), "추가 금액 사진 올리기").toBeTruthy();
  await expect(vpage.getByRole("list", { name: "추가 금액 사진" }).getByRole("listitem")).toHaveCount(1);
  await expectNoSideScroll(vpage, "V12 추가 금액 올리기");
  await shot(vpage, "03-V12-extra");
  const sent = vpage.waitForResponse((r) => r.url().endsWith(`/api/vendor/jobs/${dealId}/extras`) && r.request().method() === "POST");
  await shown(vpage.getByRole("button", { name: "고객에게 보내기" })).first().click();
  expect((await sent).ok(), "POST 추가 금액").toBeTruthy();
  await vpage.waitForURL((u) => u.pathname === `/vendor/jobs/${dealId}` && !u.search.includes("step="));
  await expect(vpage.getByText("곰팡이 방지 처리").first()).toBeVisible();
  await expect(vpage.getByText("기다림 1건").first()).toBeVisible();
}

test("J22 ① 공사 한 건(장공사): V03 공사 탭 → V23 → V12 → C37 승인 → V13 공사 끝냈어요 → C38 확인 → C39 리뷰", async ({ page, other }, info) => {
  test.setTimeout(420_000);
  const ctx = page.context();
  const pid = await customer(page, DEMO.c09);
  const t0 = await dobaeOf(ctx, pid);
  expect(t0.deal.status, "장공사: 공사 중(시연 데이터)").toBe("scheduled");
  const dealId = t0.deal.id;
  const v = await other();

  await test.step("C06 업체 화면 로그인 → V03 · D04 작업함 공사 탭", async () => {
    await loginUi(v.page, DEMO.maru, demoPassword(), "/vendor");
    await expect(v.page).toHaveURL(/\/vendor$/);
    await expect(v.page.getByRole("heading", { name: "작업함", level: 1 })).toBeAttached();
    const sum = await apiGet<{ jobs: number }>(v.context, "/vendor/visits/summary");
    const tabs = shown(v.page.getByRole("navigation", { name: "작업함 탭" }));
    await tabs.getByRole("link", { name: new RegExp(`^공사\\s*${sum.jobs}$`) }).click();
    await v.page.waitForURL(/tab=jobs/);
    const jobs = await apiGet<{ items: { deal_id?: string | null }[] }>(v.context, "/vendor/visits?tab=jobs");
    expect(jobs.items.map((r) => r.deal_id), "공사 탭에 장공사 공사가 있어요(API)").toContain(dealId);
    expect(jobs.items.length, "공사 탭 수 = 요약 수").toBe(sum.jobs);
    if (isPhone(info)) {
      const card = v.page.getByRole("list", { name: "공사 목록", exact: true }).locator(":scope > li").filter({ has: v.page.locator(`a[href="/vendor/jobs/${dealId}"]`) });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText("상계동");
      await expectNoSideScroll(v.page, "V03 작업함 공사 탭");
      await shot(v.page, "01-V03-jobs");
      await card.getByRole("link", { name: "공사 한 건 보기" }).click();
    } else {
      await v.page.locator(`a[href*="sel=${dealId}"]`).click();
      await v.page.waitForURL(new RegExp(`sel=${dealId}`));
      const side = v.page.getByRole("complementary", { name: "고른 줄 자세히" });
      await expect(side).toContainText("확정 금액");
      await expect(side).toContainText(won(t0.deal.quote.total));
      await expectNoSideScroll(v.page, "D04 작업함 공사 탭");
      await shot(v.page, "01-D04-jobs");
      await side.getByRole("link", { name: "공사 한 건 보기" }).click();
    }
    await v.page.waitForURL((u) => u.pathname === `/vendor/jobs/${dealId}`);
  });

  await test.step("V23 공사 한 건: 상태 · 공사 날짜 · 견적서 · 추가 금액 = API", async () => {
    const job = await apiGet<Job>(v.context, `/vendor/jobs/${dealId}`);
    expect(job.can_finish, "마지막 공사일부터 공사 끝을 알릴 수 있어요(API)").toBe(true);
    await expect(v.page.getByRole("heading", { name: "공사 한 건", level: 1 })).toBeVisible();
    await expect(v.page.getByText("공사 중", { exact: true }).first()).toBeVisible();
    if (job.day_no) await expect(v.page.getByText(`공사 중 · ${job.day_no}일째`)).toBeVisible();
    await expect(v.page.getByText(won(job.quote.total)).first()).toBeVisible();
    await expect(v.page.getByText("아직 없어요").first()).toBeVisible();
    await expect(shown(v.page.getByRole("link", { name: "추가 금액 올리기" }))).toHaveCount(1);
    // CF-23: 단추 '공사 끝냈어요' → '공사 끝 알리기'(V13 제목은 그대로)
    const finish = shown(v.page.getByRole("link", { name: "공사 끝 알리기" }));
    await expect(finish).toHaveCount(1);
    await expect(finish).not.toHaveAttribute("aria-disabled", "true");
    await expectNoEnglishState(v.page, "V23");
    await expectNoSideScroll(v.page, "V23 공사 한 건");
    await shot(v.page, "02-V23-job");
  });

  await test.step("V12 업체 추가 금액 올리기", async () => {
    await postExtra(v.page, dealId);
  });

  await test.step("C37 고객 추가 금액: 승인 전 합계 밖 → 승인 → 승인 뒤 합계 = API", async () => {
    const before = await dobaeOf(ctx, pid);
    const x = before.extras.items.find((i) => !i.superseded && i.answer === "pending");
    expect(x, "답을 기다리는 추가 금액").toBeTruthy();
    const base = before.extras.deal_total ?? before.deal.quote.total;
    expect(before.extras.grand_total, "승인 전에는 합계에 넣지 않아요(API grand_total)").toBe(base);
    expect(x!.after_total, "승인하면 공사 금액(API after_total)").toBe(base + x!.total);
    await page.goto(`/projects/${pid}/schedule`);
    await expect(page.getByRole("heading", { name: "추가 금액", level: 1 })).toBeVisible();
    await expect(page.getByText(`${MARU}이 추가 금액을 올렸어요`)).toBeVisible();
    await expect(page.getByText(wonDelta(x!.total)).first()).toBeVisible();
    await expect(page.getByText("승인하면 더해져요")).toBeVisible();
    await expect(page.getByText(won(base)).first()).toBeVisible();
    await expect(page.getByText("승인하기 전에는 합계에 넣지 않아요.", { exact: false }).first()).toBeVisible();
    await expectNoSideScroll(page, "C37 추가 금액");
    await shot(page, "04-C37-extra");
    const ans = page.waitForResponse((r) => r.url().includes(`/extras/${x!.id}/answer`) && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: "승인", exact: true })).first().click();
    expect((await ans).ok(), "POST 추가 금액 승인").toBeTruthy();
    await expect(page.getByRole("status").filter({ hasText: "추가 금액을 승인했어요" }).first()).toBeVisible();
    // 승인 뒤 공사 화면으로 돌아가요. 추가 금액 화면(?view=extra)에 '승인했어요 · 시각'이 남아요
    await page.goto(`/projects/${pid}/schedule?view=extra`);
    await expect(page.getByText(/^승인했어요/).first()).toBeVisible();
    const after = await dobaeOf(ctx, pid);
    expect(after.extras.grand_total, "승인 뒤 공사 금액 = 확정 금액 + 승인한 추가 금액(계산 엔진)").toBe(base + x!.total);
  });

  await test.step("V13 업체 공사 끝냈어요: 끝낸 날 · 사진 · 남길 말 → 고객에게 알리기", async () => {
    const job = await apiGet<Job>(v.context, `/vendor/jobs/${dealId}`);
    const last = [...job.work_days].sort().at(-1)!;
    await v.page.goto(`/vendor/jobs/${dealId}`);
    await expect(v.page.getByText("승인 1건").first()).toBeVisible();
    await shown(v.page.getByRole("link", { name: "공사 끝 알리기" })).first().click();
    await v.page.waitForURL(/step=done/);
    await expect(v.page.getByRole("heading", { name: "공사 끝냈어요", level: 1 })).toBeVisible();
    expect(job.grand_total, "승인한 추가 금액까지 더한 합계(API)").toBe(job.extras.grand_total);
    await expect(v.page.getByText(`합계 ${won(job.grand_total!)}`).first()).toBeVisible();
    await expect(v.page.getByRole("combobox", { name: "끝낸 날" })).toHaveValue(last);
    let ups = 0;
    const onUp = (r: { url(): string; request(): { method(): string } }) => { if (r.url().endsWith("/api/files") && r.request().method() === "POST") ups += 1; };
    v.page.on("response", onUp);
    await v.page.locator('input[type="file"][aria-label="끝낸 사진"]').setInputFiles([asset("wall-gps-1.jpg"), asset("wall-gps-2.jpg")]);
    await expect(v.page.getByRole("list", { name: "끝낸 사진" }).getByRole("listitem")).toHaveCount(2);
    v.page.off("response", onUp);
    expect(ups, "끝낸 사진 두 장 올리기").toBe(2);
    await v.page.getByRole("textbox", { name: /남길 말/ }).fill("남은 벽지 1롤은 다용도실에 두었어요");
    await expect(v.page.getByText("고객이 확인하면 공사가 끝나요").first()).toBeVisible();
    await expectNoSideScroll(v.page, "V13 공사 끝냈어요");
    await shot(v.page, "05-V13-done");
    const res = v.page.waitForResponse((r) => r.url().endsWith(`/api/vendor/jobs/${dealId}/done`) && r.request().method() === "POST");
    await shown(v.page.getByRole("button", { name: "고객에게 알리기" })).first().click();
    expect((await res).ok(), "POST 공사 끝").toBeTruthy();
    await v.page.waitForURL((u) => u.pathname === `/vendor/jobs/${dealId}` && !u.search.includes("step="));
    await expect(v.page.getByText("고객 확인 기다림").first()).toBeVisible();
    await expect(v.page.getByText(/공사 끝을 알렸어요\. 고객이 확인하면 공사가 끝나요/)).toBeVisible();
  });

  await test.step("C38 고객 공사 끝 확인: 끝낸 날 · 남길 말 · 승인한 추가 금액 · 자동 끝 날짜 = API", async () => {
    const t = await dobaeOf(ctx, pid);
    expect(t.deal.status).toBe("checking");
    expect(t.deal.auto_done_at, "자동 끝 시각(API)").toBeTruthy();
    await page.goto(`/projects/${pid}/schedule`);
    await expect(page.getByRole("heading", { name: "공사 끝 확인", level: 1 })).toBeVisible();
    await expect(page.getByText(`${MARU}이 공사를 끝냈대요`)).toBeVisible();
    if (t.deal.work_done_on) await expect(page.getByText(dLong(t.deal.work_done_on)).first()).toBeVisible();
    await expect(page.getByText("남은 벽지 1롤은 다용도실에 두었어요")).toBeVisible();
    // 9판 C38 '공사 금액 · 추가 5만 5,000원 포함 · 332만 2,000원'(승인한 추가 금액이 든 공사 금액 = API grand_total)
    await expect(page.getByText(`추가 ${won(t.extras.ok.total)} 포함`).first()).toBeVisible();
    await expect(page.getByText(won(t.extras.grand_total ?? t.deal.quote.total + t.extras.ok.total)).first()).toBeVisible();
    await expect(page.getByText(`${dShort(t.deal.auto_done_at!)}까지 확인하지 않으면 자동으로 끝나요 · ${dShort(t.deal.done_remind_at!)}에 한 번 알려 드려요`)).toBeVisible();
    await expectNoSideScroll(page, "C38 공사 끝 확인");
    await shot(page, "06-C38-done-check");
    const res = page.waitForResponse((r) => r.url().endsWith(`/deals/${dealId}/check`) && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: "공사 끝 확인" })).first().click();
    expect((await res).ok(), "POST 공사 끝 확인").toBeTruthy();
    await page.waitForURL(new RegExp(`/projects/${pid}/review`));
  });

  await test.step("C39 리뷰 쓰기 → 업체 상세로", async () => {
    await expect(page.getByRole("heading", { name: "리뷰 쓰기", level: 1 })).toBeVisible();
    await page.getByRole("radiogroup", { name: "별점" }).getByRole("radio", { name: "5점 만점에 5점" }).click();
    await choose(page, "좋았던 점", "뒷정리가 깔끔해요");
    const body = `e2e 공사 한 건 리뷰 ${Date.now().toString(36)}`;
    await page.getByRole("textbox", { name: /리뷰 글/ }).fill(body);
    await expectNoSideScroll(page, "C39 리뷰 쓰기");
    await shot(page, "07-C39-review");
    const res = page.waitForResponse((r) => r.url().endsWith(`/deals/${dealId}/review`) && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: "리뷰 올리기" })).first().click();
    expect((await res).status(), "POST 리뷰").toBe(201);
    await page.waitForURL(/\/vendors\/[^/]+$/);
    const t = await dobaeOf(ctx, pid);
    expect(t.deal.status).toBe("done");
    expect(t.deal.review_id, "리뷰를 썼어요(API review_id)").toBeTruthy();
    expect(t.deal.review_open, "공사마다 리뷰는 한 번").toBe(false);
  });
});

test("J22 ② 자동 끝(D24, 임끝남): 기한 당기기(지금 + 8일) → 공사 끝 · 리뷰 쓰기 열림 · 알림", async ({ page }) => {
  const ctx = page.context();
  const pid = await customer(page, DEMO.c10);
  const t0 = await dobaeOf(ctx, pid);
  expect(t0.deal.status, "임끝남: 공사 끝 확인 기다림(시연 데이터)").toBe("checking");
  expect(t0.deal.auto_done_at, "자동 끝 시각(API)").toBeTruthy();

  await test.step("기한 전: C38에 자동 끝 날짜", async () => {
    await page.goto(`/projects/${pid}/schedule`);
    await expect(page.getByText(`${dShort(t0.deal.auto_done_at!)}까지 확인하지 않으면 자동으로 끝나요 · ${dShort(t0.deal.done_remind_at!)}에 한 번 알려 드려요`)).toBeVisible();
  });

  await test.step("기한 당기기: 지금 + 8일", async () => {
    const out = runDue(new Date(Date.now() + 8 * 24 * 3600 * 1000));
    test.info().annotations.push({ type: "기한 당기기", description: out.trim().split("\n").join(" / ") });
    expect.soft(out, "deal_auto_done 처리").toMatch(/deal_auto_done: done 1\b/);
    const t = await dobaeOf(ctx, pid);
    expect(t.deal.status, "확인이 없어 7일 뒤 저절로 끝나요(API)").toBe("done");
    expect(t.deal.review_open, "자동으로 끝나도 리뷰 쓰기가 열려요(API)").toBe(true);
  });

  await test.step("C38 끝남 · 리뷰 쓰기 · C44 알림", async () => {
    await page.goto(`/projects/${pid}/schedule`);
    await expect(page.getByRole("heading", { name: "공사 끝 확인", level: 1 })).toBeVisible();
    await expect(page.getByText("공사가 끝났어요", { exact: true })).toBeVisible();
    if (t0.deal.work_done_on) await expect(page.getByText(`${dLong(t0.deal.work_done_on)} 공사 끝`)).toBeVisible();
    await expectNoSideScroll(page, "C38 자동 끝");
    await shot(page, "08-C38-auto-done");
    await shown(page.getByRole("link", { name: "리뷰 쓰기" })).first().click();
    await page.waitForURL(new RegExp(`/projects/${pid}/review`));
    await expect(page.getByRole("heading", { name: "리뷰 쓰기", level: 1 })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "별점" })).toBeVisible();
    await expect(shown(page.getByRole("button", { name: "리뷰 올리기" }))).toHaveCount(1);
    await page.goto("/notifications");
    await expect(page.getByText(`공사가 끝났어요 · ${MARU} 리뷰를 남겨 주세요`).first()).toBeVisible();
    await expectNoSideScroll(page, "C44 알림");
  });
});
