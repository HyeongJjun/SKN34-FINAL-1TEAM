// 화면 돕기 (B8): 가로 넘침 · 스크린샷 · 금액 글 · 보이는 것만 고르기.
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { OUT_DIR } from "./env";

/** 9판 금액 글: 만 단위 '197만 4,069원'(카드 · 제목) */
export function won(n: number): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  const man = Math.floor(a / 10000);
  const rest = a % 10000;
  if (man === 0) return `${sign}${rest.toLocaleString("ko-KR")}원`;
  if (rest === 0) return `${sign}${man.toLocaleString("ko-KR")}만 원`;
  return `${sign}${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원`;
}

/** 9판 금액 글: 전체 자리 '1,974,069원'(견적서 줄 · 합계 칸) */
export function wonFull(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 금액이 화면에 있는지: 만 단위 · 전체 자리 · 숫자만(표 칸) 가운데 하나 */
export async function expectAmount(scope: Page | Locator, n: number, what: string): Promise<void> {
  const text = await (("mainFrame" in scope) ? (scope as Page).locator("body") : (scope as Locator)).innerText();
  const flat = text.replace(/\s+/g, " ");
  const forms = [won(n), wonFull(n), n.toLocaleString("ko-KR")];
  expect(forms.some((f) => flat.includes(f)), `${what}: 화면에 ${forms[0]} · ${forms[1]}가 없어요`).toBeTruthy();
}

/** 보이는 것만(폰 · 웹 배치에 같은 단추가 둘씩 있는 곳) */
export const shown = (l: Locator): Locator => l.filter({ visible: true });

export const isPhone = (info: TestInfo): boolean => info.project.name === "phone";

/**
 * 가로 넘침이 없는지: 문서 너비가 창 너비보다 크지 않아요(1px 여유). 결과는 보고서 줄(annotation)로도 남겨요.
 * 넘치면 가장 넓은 요소 몇 개를 같이 적어 고칠 곳을 찾기 쉽게 해요.
 */
export async function expectNoSideScroll(page: Page, where: string): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const wide: string[] = [];
    if (sw > vw + 1) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const b = el.getBoundingClientRect();
        if (b.right > vw + 1 && b.width > 0 && getComputedStyle(el).position !== "fixed") {
          const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
          wide.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} right=${Math.round(b.right)}`);
          if (wide.length >= 5) break;
        }
      }
    }
    return { vw, sw, wide };
  });
  const info = test.info();
  info.annotations.push({ type: "가로 넘침", description: `${info.project.name} ${where}: ${r.sw <= r.vw + 1 ? "없음" : "있음"} (문서 ${r.sw}px · 창 ${r.vw}px)` });
  expect.soft(r.sw, `${where} 가로 넘침 (창 ${r.vw}px · 넘친 요소 ${r.wide.join(", ")})`).toBeLessThanOrEqual(r.vw + 1);
}

/** 이야기 단계 스크린샷: e2e/.out/shots/<프로젝트>/<이야기>-<번호 이름>.png */
export async function shot(page: Page, name: string): Promise<void> {
  const info = test.info();
  const story = path.basename(info.file).replace(/\.spec\.ts$/, "");
  const file = path.join(OUT_DIR, "shots", info.project.name, `${story}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

/**
 * 고르기 칩(ChoiceChip) · 나눔 칸(Segmented) 하나를 골라요. 투명한 진짜 input(radio · checkbox)이 칩 위를 덮고 있어서
 * 글자(span)를 누르면 input이 가로채요. 사람이 누르는 것처럼 그 input을 눌러요.
 */
export async function choose(scope: Page | Locator, group: string | RegExp, label: string): Promise<void> {
  const set = scope.getByRole("group", { name: group });
  const input = set.getByRole("radio", { name: label, exact: true }).or(set.getByRole("checkbox", { name: label, exact: true }));
  await input.first().check();
  await expect(input.first()).toBeChecked();
}

/** 화면으로 로그인(C06). 시험 비밀번호는 시드 코드 값이에요(찍지 않아요). next가 있으면 그 화면으로 이어 가요 */
export async function loginUi(page: Page, email: string, password: string, next?: string): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  const form = page.getByRole("form", { name: "이메일로 로그인" });
  await form.getByLabel("이메일").fill(email);
  await form.getByLabel("비밀번호").fill(password);
  await form.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** 화면 전체 글(띄어쓰기 한 칸으로) */
export async function pageText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/** 영어 상태값이 보이지 않는지(copy-guide: 화면에 confirmed · pending 같은 말 없음) */
export async function expectNoEnglishState(page: Page, where: string): Promise<void> {
  const text = await page.locator("main").first().innerText().catch(async () => page.locator("body").innerText());
  const words = ["requested", "offered", "picked", "proposed", "booked", "visited", "quoted", "chosen", "declined", "expired", "cancelled", "pending", "approved", "rejected", "needs_info", "checking", "undefined", "null", "NaN"];
  const hit = words.filter((w) => new RegExp(`(^|[^A-Za-z_])${w}([^A-Za-z_]|$)`).test(text));
  expect.soft(hit, `${where}: 화면에 영어 상태값 · 빈 값이 보여요`).toEqual([]);
}
