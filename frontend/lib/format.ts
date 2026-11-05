// 표시 형식만 바꾼다. 금액·날짜를 새로 계산하지 않는다 (AGENTS.md 7장 frontend).

/** 5168000 → "516만 8,000원", 3000000 → "300만 원" */
export function won(n: number): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  const man = Math.floor(a / 10000);
  const rest = a % 10000;
  if (man === 0) return `${sign}${rest.toLocaleString("ko-KR")}원`;
  if (rest === 0) return `${sign}${man.toLocaleString("ko-KR")}만 원`;
  return `${sign}${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원`;
}

/** 5168000 → "5,168,000원" (견적서 줄) */
export function wonFull(n: number): string {
  return `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ko-KR")}원`;
}

/** 증감 표시: 180000 → "+18만 원" */
export function wonDelta(n: number): string {
  return n > 0 ? `+${won(n)}` : n < 0 ? won(n) : "변동 없음";
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026-11-16" → "11.16(월)" */
export function md(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${m}.${d}(${WEEK[w]})`;
}
/** "2026-11-16" → "2026년 11월 16일" */
export function ymd(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** 받침에 맞춰 을/를을 붙인다: "결도배" → "결도배를" */
export function eulReul(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}을(를)`;
  return `${word}${(c - 0xac00) % 28 === 0 ? "를" : "을"}`;
}

/** 받침에 맞춰 로/으로를 붙인다: "결도배" → "결도배로", "마루와벽" → "마루와벽으로" (ㄹ 받침은 "로") */
export function euro(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}(으)로`;
  const j = (c - 0xac00) % 28;
  return `${word}${j === 0 || j === 8 ? "로" : "으로"}`;
}

export function sqm(n: number): string {
  return `${n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}㎡`;
}

const SEOUL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
/** API가 준 시각(UTC) → 서울 날짜 "2026-10-29" */
export function dateSeoul(isoTime: string): string {
  return SEOUL_DAY.format(new Date(isoTime));
}
/** 오늘 서울 날짜 "2026-10-29". 달력에서 지난 날을 막는 데만 쓴다. */
export function todaySeoul(): string {
  return SEOUL_DAY.format(new Date());
}

/** 공정표 칸: 일하는 날 목록의 첫날부터 끝날까지 모든 날짜. 일정을 새로 만들지 않고 칸만 늘어놓는다. */
export function calendarSpan(days: string[]): string[] {
  if (!days.length) return [];
  const sorted = [...days].sort();
  const last = sorted[sorted.length - 1];
  const [y, m, d] = sorted[0].split("-").map(Number);
  const out: string[] = [];
  for (const t = new Date(Date.UTC(y, m - 1, d)); out.length < 400; t.setUTCDate(t.getUTCDate() + 1)) {
    const iso = t.toISOString().slice(0, 10);
    out.push(iso);
    if (iso >= last) break;
  }
  return out;
}

/** "2026-11-02" · "2026-11-02T…" → "2026.11.02" (서류의 날짜) */
export function dotDate(iso: string): string {
  return iso.slice(0, 10).replaceAll("-", ".");
}

/** 1189011 → "1,189,011" (단위를 표 머리에 둔 칸) */
export function numText(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** API가 준 소수 문자열의 끝 0만 뺀다: "7.5" → "7.5", "32.0" → "32", "198.40" → "198.4" */
export function decText(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** 파일 크기: 3250000 → "3.1MB", 820000 → "801KB" */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** "2026-11-16" → { m: 11, d: 16, w: "월" } (공정표 날짜 머리 칸) */
export function dayParts(iso: string): { m: number; d: number; w: string } {
  const [y, m, d] = iso.split("-").map(Number);
  return { m, d, w: WEEK[new Date(y, m - 1, d).getDay()] };
}

const SEOUL_STAMP = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** 받은 시각 → 서울 "11.02(월) 14:20" (임시 저장 안내) */
export function stampSeoul(t: Date): string {
  const p = Object.fromEntries(SEOUL_STAMP.formatToParts(t).map((x) => [x.type, x.value]));
  return `${md(`${p.year}-${p.month}-${p.day}`)} ${p.hour}:${p.minute}`;
}
