// J7 실측 뒤: 견적서 올리기 → 비교 → 확정 → 공사 날짜 → 확정 공정표 → 추가 금액 → 공사 끝 확인 → 리뷰
// 화면: V10 · C33 · C34 · V11 · C35 · C36 · V12 · C37 · C38 · C39 (+ V24 · C48 리뷰가 보이는 곳). 웹은 같은 경로의 D18 · D19 배치예요.
// 시연 단계가 하나씩이라 시험 셋으로 나눠요(시험마다 시험 DB가 시연 데이터로 돌아가요):
//   ① 강실측(c06, 마루와벽 실측 끝) — 업체가 견적서를 올리고 고객 비교에 그 금액이 와요
//   ② 조견적(c07, 견적서 2곳) — 비교 → 확정 → 공사 날짜 → 수락 → 확정 공정표 → 추가 금액 승인
//   ③ 임끝남(c10, 공사 끝 확인 기다림) — 공사 끝 확인 → 리뷰 → 업체 리뷰 · 고객 리뷰 전체에 보여요
// C32(실측 받으셨어요?)는 다루지 않아요: 시연 데이터에 실측 시각이 지난 '실측 확정(booked)' 요청이 없어요.
//   지난 실측은 시연이 모두 '실측 받음(visited)'으로 넣었고(강실측 마루와벽), 남은 확정은 앞날이에요(강실측 결도배 = 내일 오후).
//   API는 실제 시계로 '실측 시각 지남'을 셈해서(L09) 기한 당기기(run_due)로도 만들 수 없어요.
// 금액은 모두 API 값(계산 엔진)과 견줘요. 화면 글은 9판 글이 기준이고, copy-fixes로 바뀐 글은 지금 글을 써요(CF 번호를 적어 둬요).
import type { BrowserContext, Page } from "@playwright/test";
import { apiGet, boardRow, loginApi, myProject } from "./support/api";
import { addDays, pickDay, todaySeoul } from "./support/calendar";
import { DEMO } from "./support/env";
import { asset } from "./support/files";
import { expect, test } from "./support/fixtures";
import { choose, expectNoEnglishState, expectNoSideScroll, isPhone, pageText, shot, shown, won, wonFull } from "./support/ui";

const MARU = "마루와벽";
const GYEOL = "결도배";

// ---- 화면 글 모양(lib/format과 같은 꼴, 시험 쪽에서 따로 만들어 견줘요) ----
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
/** 날짜 · 시각 → 서울 날짜 'YYYY-MM-DD' */
function seoulDay(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
const ymdOf = (iso: string) => seoulDay(iso).split("-").map(Number);
const weekOf = (y: number, m: number, d: number) => WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
/** '12.7(월)' */
function dShort(iso: string): string {
  const [y, m, d] = ymdOf(iso);
  return `${m}.${d}(${weekOf(y, m, d)})`;
}
/** '12월 7일(월)' */
function dLong(iso: string): string {
  const [y, m, d] = ymdOf(iso);
  return `${m}월 ${d}일(${weekOf(y, m, d)})`;
}
/** '+5만 5,000원' */
const wonDelta = (n: number) => (n > 0 ? `+${won(n)}` : won(n));

// ---- API 모양(필요한 칸만) ----
type MoneyOut = { supply: number; vat: number; total: number };
type QuoteOut = {
  id: string;
  version: number;
  sent_at: string | null;
  entered_amount: number | null;
  vat_mode: string | null;
  supply: number | null;
  vat: number | null;
  total: number | null;
  days: number | null;
  valid_until: string | null;
  files: { file_id: string; filename: string }[];
  incl_removal?: boolean | null;
  incl_waste?: boolean | null;
  paper_spec?: string | null;
  warranty_months?: number | null;
};
type DealOut = {
  id: string;
  status: string;
  vendor_id: string | null;
  vendor_name: string;
  visit_id: string;
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
type CompareRow = { visit_id: string; vendor_id: string | null; vendor_name: string; status: string; latest: QuoteOut | null; estimate_total: number | null; diff_vs_estimate?: number | null; expired: boolean };
type Compare = { vendors: CompareRow[]; deal: DealOut | null };
type ExtraOut = { id: string; title: string; reason: string; total: number; answer: string; superseded: boolean; after_total?: number | null };
type Extras = { items: ExtraOut[]; ok: MoneyOut; pending: MoneyOut; deal_total?: number | null; grand_total?: number | null };
type TradeDates = { deal: DealOut; dates_state: string; proposal: { id: string; days: string[]; crew: number; workdays: number; status: string } | null; extras: Extras };
type Schedule = { trades: TradeDates[]; final_version: number };
type Job = {
  deal_id: string;
  status: string;
  dates_state: string;
  quote: { total: number; days: number | null };
  need: { days: number; crew: number };
  visit: { work_wish_on?: string | null };
  holidays: { day: string; name: string }[];
  work_days: string[];
  can_finish: boolean;
  grand_total?: number | null;
  extras: Extras;
};

const compareOf = (c: BrowserContext, pid: string) => apiGet<Compare>(c, `/projects/${pid}/quotes?trade=dobae`);
async function dobaeOf(c: BrowserContext, pid: string): Promise<TradeDates> {
  const s = await apiGet<Schedule>(c, `/projects/${pid}/schedule`);
  const t = s.trades.find((x) => x.deal.vendor_name === MARU) ?? s.trades[0];
  expect(t, "공사(확정) 한 줄").toBeTruthy();
  return t;
}

/** 고객 로그인(시연 계정, API) → 그 공사 id */
async function customer(page: Page, email: string): Promise<string> {
  await loginApi(page.context(), email);
  return (await myProject(page.context())).id;
}


/** 견적서 공사 기간만큼 일하는 날(주말 · 공휴일 빼고). 내일 또는 고객 희망 시작일부터 */
function pickWorkDays(job: Job): string[] {
  const need = job.quote.days ?? job.need.days;
  const tomorrow = addDays(todaySeoul(), 1);
  const wish = job.visit.work_wish_on ?? tomorrow;
  let d = wish > tomorrow ? wish : tomorrow;
  const off = new Set(job.holidays.map((h) => h.day));
  const out: string[] = [];
  while (out.length < need) {
    const w = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (w !== 0 && w !== 6 && !off.has(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** V12 업체 추가 금액 올리기(50,000원 · 부가세 빼고 · 이유 · 사진 1장) → 공사 한 건으로 돌아와요 */
async function postExtra(vpage: Page, dealId: string): Promise<void> {
  await vpage.goto(`/vendor/jobs/${dealId}`);
  await expect(vpage.getByRole("heading", { name: "공사 한 건", level: 1 })).toBeVisible();
  await shown(vpage.getByRole("link", { name: "추가 금액 올리기" })).first().click();
  await vpage.waitForURL(/step=extra/);
  await expect(vpage.getByRole("heading", { name: "추가 금액 올리기", level: 1 })).toBeVisible();
  // CF-65: 칸 이름 '무엇' → '항목' · CF-64: 칸 '부가세' + 포함 · 빼고 · 면세
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
  await expect(vpage.getByText("고객이 승인하기 전에는 합계에 넣지 않아요").first()).toBeVisible();
  await expectNoSideScroll(vpage, "V12 추가 금액 올리기");
  await shot(vpage, "V12-extra");
  const sent = vpage.waitForResponse((r) => r.url().endsWith(`/api/vendor/jobs/${dealId}/extras`) && r.request().method() === "POST");
  await shown(vpage.getByRole("button", { name: "고객에게 보내기" })).first().click();
  expect((await sent).ok(), "POST 추가 금액").toBeTruthy();
  await vpage.waitForURL((u) => u.pathname === `/vendor/jobs/${dealId}` && !u.search.includes("step="));
  await expect(vpage.getByText("곰팡이 방지 처리").first()).toBeVisible();
}

/** C37 고객 추가 금액: 승인 전 합계 밖 → 승인 → 승인 뒤 합계(API) */
async function approveExtra(page: Page, pid: string): Promise<void> {
  const ctx = page.context();
  const before = await dobaeOf(ctx, pid);
  const x = before.extras.items.find((i) => !i.superseded && i.answer === "pending");
  expect(x, "답을 기다리는 추가 금액").toBeTruthy();
  const base = before.extras.deal_total ?? before.deal.quote.total;
  expect(before.extras.pending.total, "기다리는 추가 금액").toBe(x!.total);
  expect(before.extras.grand_total, "승인 전에는 합계에 넣지 않아요(API grand_total)").toBe(base);
  expect(x!.after_total, "승인하면 공사 금액(API after_total)").toBe(base + x!.total);

  await page.goto(`/projects/${pid}/schedule`);
  await expect(page.getByRole("heading", { name: "추가 금액", level: 1 })).toBeVisible();
  await expect(page.getByText(`${MARU}이 추가 금액을 올렸어요`)).toBeVisible();
  await expect(page.getByText(wonDelta(x!.total)).first()).toBeVisible();
  await expect(page.getByText("곰팡이 방지 처리").first()).toBeVisible();
  await expect(page.getByText("작은방 벽 1면에 곰팡이가 있어요").first()).toBeVisible();
  await expect(page.getByText("승인하면 더해져요")).toBeVisible();
  await expect(page.getByText(won(base)).first()).toBeVisible();
  // CF-38 · CF-50: '새 버전으로' · '믿집은 결제를 다루지 않아요' → 지금 글
  await expect(page.getByText("승인하기 전에는 합계에 넣지 않아요. 업체가 금액을 고치면 다시 승인해요. 돈은 업체와 직접 주고받아요.")).toBeVisible();
  await expect(shown(page.getByRole("button", { name: "거절", exact: true }))).toHaveCount(1);
  await expect(shown(page.getByRole("button", { name: "채팅으로 묻기" }))).toHaveCount(1);
  await expectNoEnglishState(page, "C37");
  await expectNoSideScroll(page, "C37 추가 금액");
  await shot(page, "C37-extra");

  const ans = page.waitForResponse((r) => r.url().includes(`/extras/${x!.id}/answer`) && r.request().method() === "POST");
  await shown(page.getByRole("button", { name: "승인", exact: true })).first().click();
  expect((await ans).ok(), "POST 추가 금액 승인").toBeTruthy();
  await expect(page.getByRole("status").filter({ hasText: "추가 금액을 승인했어요" }).first()).toBeVisible();
  // 승인 뒤 공사 날짜 화면으로 돌아가요. 추가 금액 화면(?view=extra)에 '승인했어요 · 시각'이 남아요
  await page.goto(`/projects/${pid}/schedule?view=extra`);
  await expect(page.getByText(/^승인했어요/).first()).toBeVisible();

  const after = await dobaeOf(ctx, pid);
  expect(after.extras.ok.total, "승인한 추가 금액").toBe(x!.total);
  expect(after.extras.grand_total, "승인 뒤 공사 금액 = 확정 금액 + 승인한 추가 금액(계산 엔진)").toBe(base + x!.total);
  expect(after.deal.grand_total).toBe(base + x!.total);
}

test("J7 ① 실측 끝(강실측): V10 견적서 올리기 → 믿집 계산 → C33 비교에 그 금액", async ({ page, other }) => {
  const pid = await customer(page, DEMO.c06);
  const visit = await boardRow(page.context(), pid, MARU);
  expect(visit.status, "강실측 마루와벽 요청 상태(시연 데이터)").toBe("visited");
  const v = await other(DEMO.maru);
  const vv = await apiGet<{ estimate_total: number | null }>(v.context, `/vendor/visits/${visit.visit_id}`);

  await test.step("V10 실측 견적서 올리기", async () => {
    await v.page.goto(`/vendor/requests/${visit.visit_id}/quote`);
    await expect(v.page.getByRole("heading", { name: "실측 견적서 올리기", level: 1 })).toBeVisible();
    await expect(v.page.getByText(/실측 \+ 3일/).first()).toBeVisible();
    if (vv.estimate_total != null) await expect(v.page.getByText(`가견적 ${won(vv.estimate_total)}`).first()).toBeVisible();
    await expect(v.page.getByText("견적서 파일", { exact: true })).toBeVisible();

    const up = v.page.waitForResponse((r) => r.url().endsWith("/api/files") && r.request().method() === "POST");
    await v.page.getByLabel("견적서 파일 올리기").setInputFiles(asset("quote.pdf"));
    expect((await up).ok(), "견적서 파일 올리기").toBeTruthy();
    await expect(v.page.getByText("quote.pdf").first()).toBeVisible();

    // CF-18: 업체 칸 이름 '낼 금액' → '견적 금액'
    await v.page.getByLabel("견적 금액").fill("2970000");
    await expect(v.page.getByLabel("견적 금액")).toHaveValue("2,970,000");
    const saved = v.page.waitForResponse((r) => r.url().endsWith(`/api/vendor/visits/${visit.visit_id}/quote`) && r.request().method() === "PUT");
    await choose(v.page, "부가세", "빼고");
    const board = (await (await saved).json()) as { draft: QuoteOut | null };
    const d = board.draft!;
    expect(d.supply! + d.vat!, "공급가 + 부가세 = 합계(계산 엔진)").toBe(d.total!);
    expect(d.total, "2,970,000원 부가세 빼고 → 3,267,000원").toBe(3_267_000);
    const calc = v.page.getByText("믿집 계산").locator("..");
    await expect(calc).toContainText(`공급가 ${wonFull(d.supply!)}`);
    await expect(calc).toContainText(`부가세 ${wonFull(d.vat!)}`);
    await expect(calc).toContainText(wonFull(d.total!));

    await v.page.getByLabel("공사 기간").fill("2");
    await v.page.getByLabel("유효기간").fill(addDays(todaySeoul(), 20));
    // CF-40: '고객 비교표에 칩으로 보여요' → '고객 비교 화면에 함께 보여요'
    const inc = /포함됐나요\?/;
    for (const c of ["기존 벽지 철거", "폐기물 처리", "벽지 제조사 · 규격", "하자 보수 기간"]) await choose(v.page, inc, c);
    await v.page.getByRole("textbox", { name: "벽지 제조사 · 규격" }).fill("LX 베스띠");
    await expect(v.page.getByRole("combobox", { name: "하자 보수" })).toHaveValue("12");
    // CF-38: '다시 올리면 버전이 쌓여요' → 지금 글
    await expect(v.page.getByText("다시 올리면 고객에게 새 견적서가 보여요. 고객이 확정한 견적서는 바뀌지 않아요.")).toBeVisible();
    await expectNoEnglishState(v.page, "V10");
    await expectNoSideScroll(v.page, "V10 실측 견적서 올리기");
    await shot(v.page, "01-V10-quote");

    const sent = v.page.waitForResponse((r) => r.url().endsWith(`/api/vendor/visits/${visit.visit_id}/quote/send`) && r.request().method() === "POST");
    await shown(v.page.getByRole("button", { name: "고객에게 보내기" })).first().click();
    expect((await sent).ok(), "POST 견적서 보내기").toBeTruthy();
    await v.page.waitForURL(/\/vendor\?tab=waiting/);
  });

  await test.step("C33 · D18 고객 비교: 받은 견적서 금액 = API", async () => {
    const cmp = await compareOf(page.context(), pid);
    const maru = cmp.vendors.find((r) => r.vendor_name === MARU)!;
    const q = maru.latest!;
    expect(q.entered_amount).toBe(2_970_000);
    expect(q.vat_mode).toBe("excluded");
    expect(q.total).toBe(3_267_000);
    expect(q.supply! + q.vat!).toBe(q.total!);
    expect(q.days).toBe(2);
    expect(q.paper_spec).toBe("LX 베스띠");
    expect(q.warranty_months).toBe(12);
    const quoted = cmp.vendors.filter((r) => r.latest?.total != null).length;

    await page.goto(`/projects/${pid}/quotes`);
    await expect(page.getByRole("heading", { name: "실측 견적서", level: 1 })).toBeVisible();
    const desc = quoted === cmp.vendors.length ? `${quoted}곳 모두 왔어요` : `${cmp.vendors.length}곳 중 ${quoted}곳 왔어요`;
    await expect(page.getByText(`${desc} · 합계 낮은 순 · 부가세 포함`)).toBeVisible();
    await expect(shown(page.getByText(won(q.total!))).first()).toBeVisible();
    for (const chip of ["LX 베스띠", "하자 1년"]) await expect(shown(page.getByText(chip, { exact: true })).first()).toBeVisible();
    await expect(shown(page.getByText("quote.pdf")).first()).toBeVisible();
    await expect(shown(page.getByRole("link", { name: `${MARU}으로 확정` }))).toHaveCount(1);
    // 견적서를 아직 안 보낸 결도배(실측은 내일)는 기다림으로 보여요
    await expect(shown(page.getByText(isPhone(test.info()) ? "실측 견적서 기다림" : `${GYEOL} 실측 견적서는 아직 안 왔어요`)).first()).toBeVisible();
    await expect(page.getByText("견적서 파일은 업체가 만든 양식이에요. 합계 · 부가세는 믿집이 계산했어요.")).toBeVisible();
    await expectNoEnglishState(page, "C33");
    await expectNoSideScroll(page, "C33 실측 견적서 비교(1곳)");
    await shot(page, "02-C33-compare-one");
  });
});

test("J7 ② 견적서 2곳(조견적): C33 비교 → C34 확정 → V11 공사 날짜 → C35 수락 → C36 확정 공정표 → V12 → C37 승인", async ({ page, other }, info) => {
  test.setTimeout(420_000);
  const ctx = page.context();
  const pid = await customer(page, DEMO.c07);
  const cmp = await compareOf(ctx, pid);
  const quoted = cmp.vendors.filter((r) => r.latest?.total != null).sort((a, b) => a.latest!.total! - b.latest!.total!);
  expect(quoted.map((r) => r.vendor_name).sort(), "조견적: 견적서 2곳(시연 데이터)").toEqual([GYEOL, MARU].sort());
  const maru = quoted.find((r) => r.vendor_name === MARU)!;
  const mq = maru.latest!;
  const v = await other(DEMO.maru);

  await test.step("C33 · D18 비교: 합계 낮은 순 · 부가세 포함 · 칩 · 가견적과 차이 = API", async () => {
    await page.goto(`/projects/${pid}/quotes`);
    await expect(page.getByRole("heading", { name: "실측 견적서", level: 1 })).toBeVisible();
    await expect(page.getByText("2곳 모두 왔어요 · 합계 낮은 순 · 부가세 포함")).toBeVisible();
    const text = await pageText(page);
    for (const r of quoted) {
      expect(text, `${r.vendor_name} 합계`).toContain(won(r.latest!.total!));
      expect(r.latest!.supply! + r.latest!.vat!, `${r.vendor_name} 공급가 + 부가세 = 합계`).toBe(r.latest!.total!);
      if (r.diff_vs_estimate != null && r.estimate_total != null && r.diff_vs_estimate !== 0) {
        const tail = `${won(r.estimate_total)}보다 ${won(Math.abs(r.diff_vs_estimate))} ${r.diff_vs_estimate > 0 ? "많아요" : "적어요"}`;
        expect(text, `${r.vendor_name} 가견적과 차이(API diff_vs_estimate)`).toContain(tail);
      }
      if (r.latest!.warranty_months) {
        const w = r.latest!.warranty_months;
        expect(text).toContain(`하자 ${w >= 12 && w % 12 === 0 ? `${w / 12}년` : `${w}개월`}`);
      }
    }
    if (mq.paper_spec) expect(text).toContain(mq.paper_spec);
    // 합계 낮은 순: 폰은 카드 순서, 웹은 비교표 열 순서
    const names = isPhone(info)
      ? await page.getByRole("list", { name: "실측 견적서", exact: true }).locator(":scope > li").allInnerTexts()
      : await page.getByRole("table", { name: "실측 견적서 비교" }).locator("thead th").allInnerTexts();
    const order = quoted.map((r) => names.findIndex((t) => t.includes(r.vendor_name)));
    expect(order.every((x) => x >= 0), "비교에 두 업체가 다 있어요").toBeTruthy();
    expect(order, "합계 낮은 순").toEqual([...order].sort((a, b) => a - b));
    await expectNoEnglishState(page, "C33");
    await expectNoSideScroll(page, "C33 실측 견적서 비교");
    await shot(page, "03-C33-compare");
  });

  let dealId = "";
  await test.step("C34 업체 확정: 확정 금액 · 받은 날 · 공사 기간 → 확정", async () => {
    await shown(page.getByRole("link", { name: `${MARU}으로 확정` })).first().click();
    await page.waitForURL(new RegExp(`/quotes/${maru.visit_id}/confirm`));
    await expect(page.getByRole("heading", { name: `${MARU}으로 확정할까요?` })).toBeVisible();
    await expect(page.getByText("확정 금액", { exact: true })).toBeVisible();
    await expect(page.getByText(won(mq.total!)).first()).toBeVisible();
    await expect(page.getByText(`${dLong(mq.sent_at!)} 받은 것`)).toBeVisible();
    await expect(page.getByText(`${mq.days}일`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`이 견적서로 고정돼요. ${GYEOL} 실측 견적서는 닫히고, 공사 날짜는 ${MARU}이 올려요.`)).toBeVisible();
    await expectNoSideScroll(page, "C34 업체 확정");
    await shot(page, "04-C34-confirm");
    // CF-26: 확인 단추 '확정' → '마루와벽으로 확정'
    const res = page.waitForResponse((r) => r.url().endsWith(`/quotes/${maru.visit_id}/confirm`) && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: `${MARU}으로 확정` })).first().click();
    expect((await res).ok(), "POST 업체 확정").toBeTruthy();
    await page.waitForURL(new RegExp(`/projects/${pid}/schedule`));
    await expect(page.getByText(`${MARU}이 공사 날짜를 올릴 때까지 기다려요`)).toBeVisible();
    const after = await compareOf(ctx, pid);
    expect(after.deal?.visit_id, "확정한 요청").toBe(maru.visit_id);
    expect(after.deal?.quote.total, "확정 금액은 받은 견적서 합계").toBe(mq.total);
    dealId = after.deal!.id;
    const gyeol = await boardRow(ctx, pid, GYEOL);
    expect(["closed", "cancelled"], "다른 업체 요청은 닫혀요").toContain(gyeol.status);
  });

  let days: string[] = [];
  await test.step("V11 업체 공사 날짜 올리기: 견적서 공사 기간만큼 날 고르기 · 인원", async () => {
    const job = await apiGet<Job>(v.context, `/vendor/jobs/${dealId}`);
    expect(job.dates_state).toBe("waiting");
    days = pickWorkDays(job);
    await v.page.goto(`/vendor/jobs/${dealId}`);
    await expect(v.page.getByRole("heading", { name: "공사 날짜 올리기", level: 1 })).toBeVisible();
    await expect(v.page.getByText(`확정 ${won(job.quote.total)}`).first()).toBeVisible();
    await expect(v.page.getByText("공사할 날을 하나씩 눌러요. 한 번 더 누르면 빠져요.")).toBeVisible();
    const cal = v.page.getByRole("group", { name: "공사할 날 고르기" });
    for (const d of days) await pickDay(cal, d);
    await expect(v.page.getByText(`견적서 공사 기간 ${days.length}일`)).toBeVisible();
    await expect(v.page.getByText(dLong(days[0])).first()).toBeVisible();
    await v.page.getByRole("combobox", { name: "인원" }).selectOption("2");
    await expectNoSideScroll(v.page, "V11 공사 날짜 올리기");
    await shot(v.page, "05-V11-dates");
    const res = v.page.waitForResponse((r) => r.url().endsWith(`/api/vendor/jobs/${dealId}/dates`) && r.request().method() === "POST");
    await shown(v.page.getByRole("button", { name: "고객에게 보내기" })).first().click();
    expect((await res).ok(), "POST 공사 날짜").toBeTruthy();
    await expect(v.page.getByText("날짜 수락 기다림").first()).toBeVisible();
  });

  await test.step("C35 고객 공사 날짜 수락", async () => {
    const t = await dobaeOf(ctx, pid);
    expect(t.dates_state).toBe("proposed");
    expect([...t.proposal!.days].sort(), "고객이 받은 날 = 업체가 고른 날").toEqual(days);
    await page.goto(`/projects/${pid}/schedule`);
    await expect(page.getByRole("heading", { name: "공사 날짜", level: 1 })).toBeVisible();
    await expect(page.getByText(`${MARU}이 올린 공사 날짜`)).toBeVisible();
    // 9판 C35 '1월 4일(월) · 5일(화)': 주인공 날짜라 긴 꼴, 같은 달이면 뒷날은 '5일(화)'(copy-01)
    const longList = days.map((d, i) => (i > 0 && days[i - 1].slice(0, 7) === d.slice(0, 7) ? dLong(d).replace(/^\d+월 /, "") : dLong(d))).join(" · ");
    await expect(page.getByText(longList).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`^${t.proposal!.workdays}일 · ${t.proposal!.crew}명`)).first()).toBeVisible();
    await expect(page.getByText(won(t.deal.quote.total)).first()).toBeVisible();
    await expect(page.getByText("수락하면 확정 공정표가 만들어져요. 날짜가 안 맞으면 다른 날짜를 요청해요(2번까지).")).toBeVisible();
    await expect(shown(page.getByRole("button", { name: "다른 날짜 요청" }))).toHaveCount(1);
    await expectNoSideScroll(page, "C35 공사 날짜 수락");
    await shot(page, "06-C35-dates");
    const res = page.waitForResponse((r) => r.url().includes(`/deals/${dealId}/dates/`) && r.url().endsWith("/accept") && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: "수락", exact: true })).first().click();
    expect((await res).ok(), "POST 공사 날짜 수락").toBeTruthy();
    await page.waitForURL(new RegExp(`/projects/${pid}/plan`));
  });

  await test.step("C36 · D19 확정 공정표", async () => {
    await expect(page.getByRole("heading", { name: "확정 공정표", level: 1 })).toBeVisible();
    await expect(page.getByText(`${dLong(days[0])} 시작`).first()).toBeVisible();
    await expect(shown(page.getByText(/^확정 · /)).first()).toBeVisible();
    await expect(shown(page.getByText("공사 전 할 일", { exact: true })).first()).toBeVisible();
    const plan = await apiGet<{ kind: string; start: string }>(ctx, `/projects/${pid}/plan`);
    expect(plan.start, "공정표 시작 = 첫 공사 날").toBe(days[0]);
    const t = await dobaeOf(ctx, pid);
    expect(t.deal.status, "공사 날짜를 수락한 확정").toBe("scheduled");
    await expectNoEnglishState(page, "C36");
    await expectNoSideScroll(page, "C36 확정 공정표");
    await shot(page, "07-C36-final-plan");
  });

  await test.step("V12 업체 추가 금액 올리기", async () => {
    await postExtra(v.page, dealId);
  });

  await test.step("C37 고객 추가 금액: 승인 전 합계 밖 → 승인 → 승인 뒤 합계 = API", async () => {
    await approveExtra(page, pid);
    // 업체 공사 한 건에도 승인한 추가 금액이 보여요(API 값)
    const job = await apiGet<Job>(v.context, `/vendor/jobs/${dealId}`);
    await v.page.goto(`/vendor/jobs/${dealId}`);
    await expect(v.page.getByText("승인 1건").first()).toBeVisible();
    await expect(v.page.getByText(won(job.extras.ok.total)).first()).toBeVisible();
  });
});

test("J7 ③ 공사 끝 확인(임끝남): C38 자동 끝 날짜 · 공사 끝 확인 → C39 리뷰 → 업체 리뷰(V24) · 리뷰 전체(C48)", async ({ page, other }) => {
  const ctx = page.context();
  const pid = await customer(page, DEMO.c10);
  const t = await dobaeOf(ctx, pid);
  const d = t.deal;
  expect(d.status, "임끝남: 업체가 공사 끝냈다고 올림(시연 데이터)").toBe("checking");
  expect(d.vendor_id).toBeTruthy();
  const vid = d.vendor_id!;
  const before = await apiGet<{ rating?: { count: number } | null }>(ctx, `/projects/${pid}/vendors/${vid}?trade=dobae`);
  const body = `e2e 리뷰 ${Date.now().toString(36)} · 작은방 곰팡이까지 봐 주셔서 좋았어요.`;

  await test.step("C38 공사 끝 확인", async () => {
    await page.goto(`/projects/${pid}/schedule`);
    await expect(page.getByRole("heading", { name: "공사 끝 확인", level: 1 })).toBeVisible();
    await expect(page.getByText(`${MARU}이 공사를 끝냈대요`)).toBeVisible();
    if (d.work_done_on) await expect(page.getByText(dLong(d.work_done_on)).first()).toBeVisible();
    if (d.done_note) await expect(page.getByText(d.done_note)).toBeVisible();
    await expect(page.getByText("확정 금액", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(won(d.quote.total)).first()).toBeVisible();
    expect(d.auto_done_at, "자동 끝 시각(API)").toBeTruthy();
    expect(d.done_remind_at, "알림 날(API)").toBeTruthy();
    await expect(page.getByText(`${dShort(d.auto_done_at!)}까지 확인하지 않으면 자동으로 끝나요 · ${dShort(d.done_remind_at!)}에 한 번 알려 드려요`)).toBeVisible();
    await expect(page.getByText("확인하면 공사가 끝나요. 그다음 리뷰를 쓸 수 있어요. 끝난 뒤에도 하자는 채팅으로 접수해요.")).toBeVisible();
    await expect(shown(page.getByRole("button", { name: "고칠 곳 있어요" }))).toHaveCount(1);
    await expectNoEnglishState(page, "C38");
    await expectNoSideScroll(page, "C38 공사 끝 확인");
    await shot(page, "08-C38-done-check");
    const res = page.waitForResponse((r) => r.url().endsWith(`/deals/${d.id}/check`) && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: "공사 끝 확인" })).first().click();
    expect((await res).ok(), "POST 공사 끝 확인").toBeTruthy();
    await page.waitForURL(new RegExp(`/projects/${pid}/review`));
    const after = await dobaeOf(ctx, pid);
    expect(after.deal.status).toBe("done");
    expect(after.deal.review_open, "리뷰 쓰기 열림").toBe(true);
  });

  await test.step("C39 리뷰 쓰기: 별 · 칩 · 글 · 사진 → 올리기", async () => {
    await expect(page.getByRole("heading", { name: "리뷰 쓰기", level: 1 })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${MARU} · .*도배`)).first()).toBeVisible();
    if (d.work_done_on) await expect(page.getByText(`${dLong(d.work_done_on)} 공사 끝`)).toBeVisible();
    const stars = page.getByRole("radiogroup", { name: "별점" });
    await stars.getByRole("radio", { name: "5점 만점에 5점" }).click();
    await expect(stars.getByRole("radio", { name: "5점 만점에 5점" })).toHaveAttribute("aria-checked", "true");
    for (const tag of ["이음매가 깔끔해요", "약속한 날에 끝냈어요"]) await choose(page, "좋았던 점", tag);
    await page.getByRole("textbox", { name: /리뷰 글/ }).fill(body);
    const up = page.waitForResponse((r) => r.url().endsWith("/api/files") && r.request().method() === "POST");
    await page.getByLabel("리뷰 사진 올리기").setInputFiles(asset("wall-gps-2.jpg"));
    expect((await up).ok(), "리뷰 사진 올리기").toBeTruthy();
    await expect(page.getByRole("list", { name: "올린 사진" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("하자가 보이면")).toBeVisible();
    await expectNoSideScroll(page, "C39 리뷰 쓰기");
    await shot(page, "09-C39-review");
    const res = page.waitForResponse((r) => r.url().endsWith(`/deals/${d.id}/review`) && r.request().method() === "POST");
    await shown(page.getByRole("button", { name: "리뷰 올리기" })).first().click();
    expect((await res).status(), "POST 리뷰").toBe(201);
    await page.waitForURL(new RegExp(`/projects/${pid}/vendors/${vid}`));
    const after = await apiGet<{ rating?: { count: number } | null }>(ctx, `/projects/${pid}/vendors/${vid}?trade=dobae`);
    expect(after.rating?.count, "업체 리뷰 수가 하나 늘어요").toBe((before.rating?.count ?? 0) + 1);
    await expect(page.getByRole("heading", { name: new RegExp(`^리뷰 ${after.rating!.count}`) })).toBeVisible();
  });

  await test.step("C48 리뷰 전체 · V24 업체 리뷰에 보여요", async () => {
    await page.goto(`/projects/${pid}/vendors/${vid}/reviews`);
    await expect(page.getByText(body)).toBeVisible();
    await expectNoSideScroll(page, "C48 리뷰 전체");
    const v = await other(DEMO.maru);
    await v.page.goto("/vendor/reviews");
    await expect(v.page.getByRole("heading", { name: "리뷰", level: 1 })).toBeVisible();
    await expect(v.page.getByText(body)).toBeVisible();
    await expectNoSideScroll(v.page, "V24 업체 리뷰");
    await shot(v.page, "10-V24-reviews");
  });
});
