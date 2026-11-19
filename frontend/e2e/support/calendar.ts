// 달력 돕기 (B8): components/ui/Calendar(DayPicker)의 날 단추는 '12월 15일 화요일, 업체 가능 …'처럼 읽혀요.
import { expect, type Locator } from "@playwright/test";

const WEEK = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/** '2026-12-15' → '12월 15일 화요일'(Calendar 날 단추 이름 앞부분) */
export function spoken(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일 ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/** 서울 날짜 'YYYY-MM-DD' + n일 */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 오늘(서울) */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const SHORT_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const seoulParts = (isoTime: string) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(isoTime)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour, mm: p.minute };
};

/** copy-01 짧은 꼴 날짜 '12.15(화)'(서울) */
export function dateShort(isoTime: string): string {
  const { y, m, d } = seoulParts(isoTime.length === 10 ? `${isoTime}T12:00:00+09:00` : isoTime);
  return `${m}.${d}(${SHORT_WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** copy-01 기한 꼴 '11.25(수) 09:05까지'(서울) */
export function dueShort(isoTime: string): string {
  const { hh, mm } = seoulParts(isoTime);
  return `${dateShort(isoTime)} ${hh}:${mm}까지`;
}

/** 그 날 단추(달을 넘겨 가며 찾아요). 달력 묶음(role=group) 안에서 찾아요 */
export async function dayButton(cal: Locator, iso: string): Promise<Locator> {
  const name = new RegExp(`^${spoken(iso)}`);
  for (let i = 0; i < 16; i++) {
    const btn = cal.getByRole("button", { name });
    if (await btn.count()) return btn.first();
    const caption = (await cal.getByRole("status").first().textContent().catch(() => "")) ?? "";
    const m = caption.match(/(\d{4})년 (\d{1,2})월/);
    const [ty, tm] = iso.split("-").map(Number);
    const back = m ? Number(m[1]) * 12 + Number(m[2]) > ty * 12 + tm : false;
    await cal.getByRole("button", { name: back ? "이전 달" : "다음 달" }).click();
  }
  throw new Error(`달력에서 ${spoken(iso)}를 찾지 못했어요`);
}

export async function pickDay(cal: Locator, iso: string): Promise<void> {
  const b = await dayButton(cal, iso);
  await expect(b).toBeEnabled();
  await b.click();
}
