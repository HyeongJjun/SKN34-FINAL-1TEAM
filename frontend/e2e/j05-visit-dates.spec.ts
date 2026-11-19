// J5 실측 요청 → 업체 기간 답하기(업체 문맥) → 고객 날짜 고르기 · 바로 확정 → 채팅 글이 상대에게 실시간으로
// 화면: V03 · V04(웹 D04 · D14) → C14(D03) → C16 · C61 · C17(D15) → C25 · V09(웹 D05). C13(요청서)은 J3 시험이 눌러요.
// - 고객: 박요청(v3-c03, 마루와벽 · 결도배에 요청 보냄, 사진 2장). 업체: 마루와벽(바로 확정 켬) — 두 사용자를 문맥 둘로 동시에 열어요.
// - 기한: 업체 답 기한 = 보낸 때 + 48시간, 고르기 기한 = 업체 답 + 7일(API 값과 화면 글). 개인정보: 업체 화면에 고객 이름이 없고 '상계동 고객'.
import { apiGet, boardRow, loginApi, myProject } from "./support/api";
import { addDays, dayButton, dueShort } from "./support/calendar";
import { DEMO } from "./support/env";
import { expect, test } from "./support/fixtures";
import { expectNoEnglishState, expectNoSideScroll, isPhone, pageText, shot, shown, won } from "./support/ui";

type InboxRow = { id: string; status: string; area_label?: string | null; estimate_total?: number | null; state?: { label: string } | null; reply_due_at?: string | null };
type VVisit = { id: string; status: string; wish_start: string; wish_end: string; work_wish_on?: string | null; photos: string[]; reply_due_at?: string | null; area_label?: string | null; estimate_total?: number | null };
type Pick = { visit_id: string; status: string; instant: boolean; days: { day: string; am: boolean; pm: boolean }[]; next: { due_at: string | null }; thread_id: string | null; booked: { day: string; half: string } | null };

const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const dLong = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()]})`;

test("J5 업체 기간 답하기 → 고객 날짜 고르기 · 바로 확정 → 채팅 실시간", async ({ page, other }, info) => {
  test.setTimeout(420_000);
  const phone = isPhone(info);
  const ctx = page.context();
  await loginApi(ctx, DEMO.c03);
  const pid = (await myProject(ctx)).id;
  const row0 = await boardRow(ctx, pid, "마루와벽");
  expect(row0.status, "박요청의 마루와벽 요청은 답 전").toBe("requested");
  const vid = row0.visit_id;
  const v = await other(DEMO.maru);

  let vv: VVisit;
  await test.step("V03 · D04 업체 작업함: 새 실측 요청(동네까지만 · 답 기한 = 보낸 때 + 48시간)", async () => {
    vv = await apiGet<VVisit>(v.context, `/vendor/visits/${vid}`);
    const todo = await apiGet<{ items: InboxRow[] }>(v.context, "/vendor/visits?tab=todo");
    const r = todo.items.find((x) => x.id === vid);
    expect(r, "작업함 할 일에 박요청 요청").toBeTruthy();
    const head = await apiGet<{ head: { sent_at: string } }>(ctx, `/projects/${pid}/visits`);
    if (vv.reply_due_at) expect(new Date(vv.reply_due_at).getTime() - new Date(head.head.sent_at).getTime(), "업체 답 기한 = 보낸 때 + 48시간(고객 화면과 같은 값)").toBe(48 * 3600_000);
    await v.page.goto("/vendor");
    const tabs = shown(v.page.getByRole("navigation", { name: "작업함 탭" })).first();
    await expect(tabs.getByRole("link", { name: /^할 일/ })).toBeVisible();
    await expect(shown(v.page.getByText(r!.state?.label ?? "새 실측 요청", { exact: true })).first()).toBeVisible();
    if (r!.area_label) await expect(shown(v.page.getByText(r!.area_label)).first()).toBeVisible();
    if (r!.estimate_total != null) await expect(shown(v.page.getByText(new RegExp(won(r!.estimate_total)))).first()).toBeVisible();
    expect(await pageText(v.page), "업체 작업함에 고객 이름이 없어요").not.toContain("박요청");
    await expectNoEnglishState(v.page, "V03");
    await expectNoSideScroll(v.page, phone ? "V03 작업함" : "D04 작업함");
    await shot(v.page, "01-V03-inbox");
    await shown(v.page.locator(`a[href="/vendor/requests/${vid}"]`)).first().click();
    await v.page.waitForURL(new RegExp(`/vendor/requests/${vid}$`));
  });

  let answeredAt = 0;
  // 고객 희망 안에서 6일 · 하루 빼기(9판 12.13~12.18, 16일 빼고와 같은 모양)
  const start = () => addDays(vv.wish_start, 6);
  const end = () => addDays(vv.wish_start, 11);
  const off = () => addDays(vv.wish_start, 9);
  await test.step("V04 · D14 기간 답하기: 요청 내용 · 사진 2장 → 기간 · 빼는 날 · 바로 확정 → 보내기", async () => {
    await expect(v.page.getByRole("heading", { name: "기간 답하기", level: 1 })).toBeVisible();
    if (vv.work_wish_on) await expect(shown(v.page.getByText(/공사 시작 희망/)).first()).toBeVisible();
    // 웹 D14 요약 칸에 고객이 올린 사진(폰 V04는 9판대로 한 줄 요약만)
    if (!phone) await expect(v.page.getByRole("list", { name: "고객이 올린 사진" }).getByRole("img")).toHaveCount(2);
    if (phone) await expect(v.page.getByText(`고객 희망 ${md(vv.wish_start)}~${md(vv.wish_end)}`).first()).toBeVisible();
    const sw = shown(v.page.getByRole("switch", { name: /고객이 고르면 바로 확정/ })).first();
    await expect(sw).toBeChecked();
    const cal = v.page.getByRole("group", { name: "갈 수 있는 기간 고르기" });
    for (const d of [start(), end(), off()]) {
      const b = await dayButton(cal, d);
      await b.click();
    }
    await expect(cal.getByRole("button", { name: /빼는 날/ })).toHaveCount(1);
    await expectNoSideScroll(v.page, phone ? "V04 기간 답하기" : "D14 기간 답하기");
    await shot(v.page, "02-V04-period");
    const answered = v.page.waitForResponse((r) => r.url().includes(`/api/vendor/visits/${vid}/window`) && r.request().method() === "POST");
    await shown(v.page.getByRole("button", { name: `${md(start())}~${md(end())} 보내기` })).first().click();
    expect((await answered).ok(), "POST 기간 답하기").toBeTruthy();
    answeredAt = Date.now();
    await expect(v.page.getByText("기간을 보냈어요. 고객이 날짜를 고르면 알림으로 알려 드려요.")).toBeVisible();
    await v.page.waitForURL(/\/vendor\?tab=waiting/);
  });

  let pick: Pick;
  await test.step("C14 · D03 고객 실측 일정: 마루와벽 '날짜 고를 차례' · 고르기 기한 = 업체 답 + 7일", async () => {
    pick = await apiGet<Pick>(ctx, `/projects/${pid}/visits/${vid}`);
    expect(pick.status).toBe("offered");
    expect(pick.instant, "바로 확정").toBe(true);
    const r = await boardRow(ctx, pid, "마루와벽");
    expect(r.window?.start).toBe(start());
    await page.goto(`/projects/${pid}/visits`);
    await expect(page.getByRole("heading", { name: "실측 일정", level: 1 })).toBeVisible();
    await expect(shown(page.getByText("날짜 고를 차례")).first()).toBeVisible();
    // 고르기 기한 = 업체 답 + 7일(폰 카드 '11.26(목) 08:43까지' · 웹 표 기한 칸 '11.26(목) 08:43')
    expect(pick.next.due_at, "고르기 기한").toBeTruthy();
    expect(Math.abs(new Date(pick.next.due_at!).getTime() - answeredAt - 7 * 86400_000), "고르기 기한 = 업체 답 + 7일(2분 안)").toBeLessThan(120_000);
    const due = dueShort(pick.next.due_at!).replace(/까지$/, "");
    await expect(shown(page.getByText(new RegExp(due.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).first()).toBeVisible();
    await expect(shown(page.getByText("답 기다림")).first()).toBeVisible(); // 결도배는 아직 답 전
    await expectNoEnglishState(page, "C14");
    await expectNoSideScroll(page, "C14 실측 일정(업체 답이 옴)");
    await shot(page, "03-C14-board");
    await shown(page.getByRole("link", { name: "날짜 고르기" })).first().click();
    await page.waitForURL(new RegExp(`/projects/${pid}/visits/${vid}$`));
  });

  let day = "";
  await test.step("C16 · D15 날짜 고르기 → 반나절 → C61 확인 창 → 확정", async () => {
    const open = pick.days.find((d) => d.am) ?? pick.days.find((d) => d.pm);
    expect(open, "업체 기간 안에 고를 수 있는 반나절").toBeTruthy();
    day = open!.day;
    const half = open!.am ? "오전" : "오후";
    expect(pick.days.find((d) => d.day === off())?.am ?? false, "빼는 날은 못 골라요").toBe(false);
    await expect(page.getByRole("list", { name: "달력 표시" })).toContainText("업체 가능");
    const b = await dayButton(page.getByRole("main"), day);
    await expect(b).toHaveAccessibleName(/업체 가능/);
    await b.click();
    const set = shown(page.getByRole("group", { name: dLong(day) })).first();
    await set.getByRole("radio", { name: half }).check();
    await expect(shown(page.getByText("시각은 확정 뒤 채팅으로 정해요.", { exact: false })).first()).toBeVisible();
    await expectNoSideScroll(page, "C16 날짜 고르기");
    await shot(page, "04-C16-pick");
    await shown(page.getByRole("button", { name: "이 날짜로 확정" })).first().click();
    const dlg = page.getByRole("dialog", { name: /확정할까요\?$/ });
    await expect(dlg).toContainText("마루와벽");
    await expect(dlg).toContainText("확정 뒤 채팅으로 정해요");
    await expect(dlg).toContainText("'바로 확정'을 켜 둬서 누르면 바로 정해져요");
    await shot(page, "05-C61-confirm");
    const res = page.waitForResponse((r) => r.url().includes(`/api/projects/${pid}/visits/${vid}/pick`) && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "확정", exact: true }).click();
    expect((await res).ok(), "POST 날짜 고르기(바로 확정)").toBeTruthy();
  });

  let thread = "";
  await test.step("C17 실측 확정됨: 시각은 채팅 · 전날 18:00 알림 · 캘린더 파일(업체 · 날짜만)", async () => {
    await expect(page.getByRole("heading", { name: "실측 날짜가 정해졌어요" })).toBeVisible();
    await expect(page.getByText("전날 18:00에 한 번 알려 드려요")).toBeVisible();
    await expect(page.getByText("채팅에서 직접 알려 줘요 · 업체에는 동네까지만 보여요")).toBeVisible();
    const r = await boardRow(ctx, pid, "마루와벽");
    expect(r.status).toBe("booked");
    expect(r.booked?.day).toBe(day);
    thread = r.thread_id!;
    expect(thread, "확정되면 대화가 열려요").toBeTruthy();
    const ics = await ctx.request.get(`/api/projects/${pid}/visits/${vid}/ics`);
    expect(ics.ok(), ".ics 받기").toBeTruthy();
    const cal = await ics.text();
    expect(cal).toContain("BEGIN:VCALENDAR");
    expect(cal).toContain("마루와벽");
    expect(cal, ".ics에 고객 이름 · 주소가 없어요").not.toMatch(/박요청|호수|010-/);
    // 업체 쪽도 같은 반나절로 확정(작업함 일정)
    expect((await apiGet<VVisit>(v.context, `/vendor/visits/${vid}`)).status).toBe("booked");
    await expectNoSideScroll(page, "C17 실측 확정됨");
    await shot(page, "06-C17-done");
  });

  await test.step("C25 · V09(D05) 채팅: 고객 글이 업체 화면에, 업체 글이 고객 화면에 새로 고침 없이", async () => {
    await shown(page.getByRole("link", { name: "채팅 열기" })).first().click();
    await page.waitForURL(new RegExp(`/chat/${thread}$`));
    await v.page.goto(`/chat/${thread}`);
    const mine = page.getByRole("log", { name: "대화 글" });
    const theirs = v.page.getByRole("log", { name: "대화 글" });
    await expect(mine).toBeVisible();
    await expect(theirs).toBeVisible();
    // 업체는 고객을 '상계동 고객'으로 봐요(이름 · 휴대폰 없음, V09)
    await expect(v.page.getByRole("heading", { name: /상계동 고객/ })).toBeAttached();
    expect(await pageText(v.page), "업체 채팅에 고객 이름이 없어요").not.toContain("박요청");
    if (!phone) await expect(page.getByRole("link", { name: /마루와벽/ }).first()).toBeVisible(); // D05 왼쪽 목록

    const hello = `안녕하세요. 실측 날 오전에 집에 있어요 (${info.project.name} ${Date.now() % 10000})`;
    await page.getByLabel("메시지").fill(hello);
    await shown(page.getByRole("button", { name: "보내기", exact: true })).first().click();
    await expect(mine).toContainText(hello);
    await expect(theirs, "고객 글이 업체 화면에 실시간으로(새로 고침 없음)").toContainText(hello, { timeout: 20_000 });

    const reply = `네, 9시쯤 도착해요 (${info.project.name})`;
    await v.page.getByLabel("메시지").fill(reply);
    await shown(v.page.getByRole("button", { name: "보내기", exact: true })).first().click();
    await expect(theirs).toContainText(reply);
    await expect(mine, "업체 글이 고객 화면에 실시간으로(새로 고침 없음)").toContainText(reply, { timeout: 20_000 });
    await expectNoSideScroll(page, phone ? "C25 대화" : "D05 채팅 2단");
    await expectNoSideScroll(v.page, "V09 업체 채팅");
    await shot(page, "07-C25-chat");
    await shot(v.page, "08-V09-vendor-chat");
  });
});
