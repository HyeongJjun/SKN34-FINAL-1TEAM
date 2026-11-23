// 업체 도우미: 업체가 말로 적은 글에서 폼 칸에 넣을 값만 뽑아요(규칙만 쓰고 LLM은 부르지 않아요).
// 금액은 적은 숫자 그대로 옮기고 더하거나 곱하지 않아요. 저장 · 보내기는 하지 않아요.
// 애매하면 칸을 채우지 않아요(틀린 값을 넣는 것보다 비워 두고 업체가 적는 편이 안전해요).

/** outside: 안 된다고 했지만 기간 밖이라 넣지 않은 날 */
export type PeriodFill = { start: string; end: string; excluded: string[]; outside: string[] };
export type QuoteFill = { amount?: number; vat?: "included" | "excluded" | "exempt"; days?: number; valid?: string };

const NO = /안\s*(?:돼|됨|되|됩)|못\s*(?:가|해|하)|불가|빼고|빼\s*주|빼요|어려|어렵|제외/;
// 토막 나누기: 쉼표 · 줄바꿈 · 이음말, 마침표는 숫자 사이(12.2)가 아닐 때만
const PARTS = /,|\n|(?<!\d)\.|\.(?!\d)|그리고|하고|인데|는데|지만/;
const DATE = String.raw`(?:\d{1,2}\s*(?:\/|\.|월)\s*)?\d{1,2}\s*일?`;
const pad = (n: number) => String(n).padStart(2, "0");

/** 월 · 일 → "2026-12-02". 오늘보다 여섯 달 넘게 앞선 달이면 내년으로 봐요(12월에 적은 1월) */
function iso(month: number, day: number, today: string): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  const y = month < tm - 6 ? ty + 1 : ty;
  const d = new Date(Date.UTC(y, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

/** 글 한 토막의 날짜들. "12/2", "12.2", "12월 2일", "3일", "12/2~5"를 읽고, 달이 없으면 앞에서 본 달을 써요 */
function daysIn(part: string, today: string, month: { m: number }): string[] {
  const text = part.replace(/[~\-–]\s*(\d{1,2})(?!\s*[/.월\d])/g, "~$1일");
  const out: string[] = [];
  for (const x of text.matchAll(/(?:(\d{1,2})\s*(?:\/|\.|월)\s*(\d{1,2})\s*일?)|(?:(\d{1,2})\s*일)/g)) {
    if (x[1]) month.m = Number(x[1]);
    const day = iso(month.m, Number(x[2] ?? x[3]), today);
    if (day) out.push(day);
  }
  return out;
}

/** 기간 표시: '부터 · 까지 · ~ · -'가 있어야 처음 ~ 끝을 기간으로 봐요 */
const RANGE = /부터|까지|~|∼|(?<=\d\s*일?\s*)[-–](?=\s*\d)/;

/** "12/2부터 12/5까지 돼요, 12/4는 안 돼요" → 기간과 빼는 날. 못 읽으면 null.
 *  "12월 2일과 12월 5일만 가능"처럼 날짜만 늘어놓으면 기간이 아니라서 비워요(하루만 말하면 그 하루) */
export function parsePeriod(text: string, today: string, baseMonth?: string | null): PeriodFill | null {
  const month = { m: Number((baseMonth ?? today).slice(5, 7)) };
  const ok: string[] = [];
  const no: string[] = [];
  for (const part of text.split(PARTS)) {
    if (!part.trim()) continue;
    (NO.test(part) ? no : ok).push(...daysIn(part, today, month));
  }
  if (!ok.length) return null;
  if (new Set(ok).size > 1 && !RANGE.test(text)) return null;
  ok.sort();
  const start = ok[0];
  const end = ok[ok.length - 1];
  const nos = [...new Set(no)].sort();
  return { start, end, excluded: nos.filter((d) => d > start && d < end), outside: nos.filter((d) => d < start || d > end) };
}

const num = (s: string) => Number(s.replace(/,/g, ""));
/** 금액 앞에 붙으면 '전체 금액'으로 보는 말 */
const CORRECTED = /^\s*원?\s*(?:이|가|은|는)?\s*(?:아니라|아니고|아닌|아니에요|아닙니다|아녜요|말고)/;
const TOTAL = /(?:전체|총|합계|견적)\s*(?:금액|견적|은|는|이|가)?\s*$/;

/** 금액: "455만 원" · "455.5만 원" · "455만 5천 원" · "455만 5,000원" · "4,550,000원". 만 뒤 숫자는 바로 '원'이 붙을 때만 더해요("455만 3일"의 3은 금액이 아니에요).
 *  금액이 둘 이상이면 '전체 · 총 · 합계 · 견적'이 붙은 하나만 쓰고, 고를 수 없으면 비워요("철거 20만 원 별도 전체 견적 455만 원"은 455만) */
function amountIn(text: string): number | undefined {
  const hits: { at: number; end: number; won: number }[] = [];
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*만\s*(?:(\d)\s*천)?\s*(?:(\d[\d,]*)\s*원)?/g)) {
    const won = Math.round(num(m[1]) * 10000) + (m[2] ? Number(m[2]) * 1000 : 0) + (m[3] ? num(m[3]) : 0);
    hits.push({ at: m.index, end: m.index + m[0].length, won });
  }
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d{6,})\s*원?/g)) {
    if (!hits.some((h) => m.index >= h.at && m.index < h.end)) hits.push({ at: m.index, end: m.index + m[0].length, won: num(m[1]) });
  }
  // 정정한 금액은 버려요: "455만 원이 아니라 555만 원" · "455만 말고 555만"
  const kept = hits.filter((h) => !CORRECTED.test(text.slice(h.end)));
  if (kept.length !== hits.length) return kept.length === 1 ? kept[0].won : undefined;
  if (hits.length <= 1) return hits[0]?.won;
  const total = hits.filter((h) => TOTAL.test(text.slice(Math.max(0, h.at - 12), h.at)));
  return total.length === 1 ? total[0].won : undefined;
}

/** 바로 뒤에 붙으면 그 말을 버리는 부정("면세는 아니고") */
const NOT = /^\s*(?:은|는|이|가)?\s*(?:아니|아닙|아님|아녜|아냐|없)/;

/** 부가세: '부가세 · VAT' 바로 뒤 말만 봐요("부가세 포함, 철거는 별도"는 포함이에요).
 *  "면세는 아니고 부가세 포함"처럼 부정한 말은 버리고, 남은 방식이 하나일 때만 채워요 */
function vatIn(text: string): QuoteFill["vat"] {
  const said = new Set<NonNullable<QuoteFill["vat"]>>();
  for (const m of text.matchAll(/면세/g)) {
    if (!NOT.test(text.slice(m.index + m[0].length))) said.add("exempt");
  }
  for (const m of text.matchAll(/(?:부가세|부가가치세|VAT)\s*(?:는|은)?\s*(별도|빼고|미포함|따로|포함)/gi)) {
    if (!NOT.test(text.slice(m.index + m[0].length))) said.add(m[1] === "포함" ? "included" : "excluded");
  }
  return said.size === 1 ? [...said][0] : undefined;
}

/** 유효기간: '유효'라는 말이 있을 때만, 그 말에 가장 가까운 "…까지"를 써요("12/11까지 공사, 12/17까지 유효"는 12/17) */
function validIn(text: string, today: string): string | undefined {
  const at = text.search(/유효/);
  if (at < 0) return undefined;
  const hits = [...text.matchAll(new RegExp(`(${DATE})\\s*까지`, "g"))];
  if (!hits.length) return undefined;
  const near = hits.reduce((a, b) => (Math.abs((b.index ?? 0) - at) < Math.abs((a.index ?? 0) - at) ? b : a));
  const said = near[1];
  const bare = !/[/.월]/.test(said);
  const tm = Number(today.slice(5, 7));
  let d: string | undefined = daysIn(bare ? `${said.replace(/일/, "")}일` : said, today, { m: tm })[0];
  // 달 없이 "17일까지"라고 했는데 이미 지난 날이면 다음 달로 봐요
  if (d && bare && d < today) d = iso((tm % 12) + 1, Number(d.slice(8, 10)), today) ?? undefined;
  return d;
}

/** 공사 기간: "공사 3일" · "3일 걸려요" · "3일간"처럼 기간이라는 말이 붙을 때만 읽어요("9일부터"는 날짜예요) */
function daysOf(text: string): number | undefined {
  const m = text.match(/(?:공사|작업|시공)\s*(?:기간)?\s*(?:은|는|이|가)?\s*(\d{1,3})\s*일(?!\s*까지)/) ?? text.match(/(\d{1,3})\s*일\s*(?:간|동안|걸|소요|작업|정도)/);
  return m ? Number(m[1]) : undefined;
}

/** "견적 455만 원, 부가세 포함, 공사 3일, 12/17까지 유효" → 견적서 칸 값. 읽은 칸만 돌려줘요 */
export function parseQuote(text: string, today: string): QuoteFill {
  const out: QuoteFill = {};
  const amount = amountIn(text);
  if (amount) out.amount = amount;
  const vat = vatIn(text);
  if (vat) out.vat = vat;
  const days = daysOf(text);
  if (days) out.days = days;
  const valid = validIn(text, today);
  if (valid) out.valid = valid;
  return out;
}

export type DatesFill = { days: string[]; crew?: number };

/** 공사 날짜: "12/8부터 12/10까지, 2명" → 그 사이 날 모두(안 된다고 한 날 · 공휴일 빼고, noWeekend면 토 · 일도 빼고).
 *  "12/8, 12/9, 12/11"처럼 늘어놓으면 그 날만(말한 날은 주말이어도 그대로 두고 서버가 다시 봐요) */
export function parseDates(text: string, today: string, baseMonth?: string | null, holidays: string[] = [], noWeekend = false): DatesFill | null {
  const crewM = text.match(/(\d)\s*명/);
  const crew = crewM ? Number(crewM[1]) : undefined;
  const said = text.replace(/\d\s*명/g, "");
  const days: string[] = [];
  if (RANGE.test(said)) {
    const p = parsePeriod(said, today, baseMonth);
    const skip = new Set([...(p?.excluded ?? []), ...holidays]);
    for (let d = new Date(`${p?.start}T00:00:00Z`); p && d.toISOString().slice(0, 10) <= p.end; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      if (!skip.has(k) && !(noWeekend && (d.getUTCDay() === 0 || d.getUTCDay() === 6))) days.push(k);
    }
  } else {
    const month = { m: Number((baseMonth ?? today).slice(5, 7)) };
    const skip = new Set(holidays);
    days.push(...[...new Set(said.split(PARTS).filter((x) => !NO.test(x)).flatMap((x) => daysIn(x, today, month)))].filter((d) => !skip.has(d)).sort());
  }
  if (!days.length && !crew) return null;
  return { days, crew };
}

export type ExtraFill = QuoteFill & { title?: string; reason?: string };
const WHY = /(?<!견적|계약|문|청구|확인)서\s*요?\s*$|때문/;

/** 추가 금액: "곰팡이 방지 처리 12만 원, 부가세 포함, 벽 안쪽까지 곰팡이가 퍼져서" → 항목 · 금액 · 부가세 · 이유 */
export function parseExtra(text: string, today: string): ExtraFill {
  const out: ExtraFill = parseQuote(text, today);
  delete out.days;
  delete out.valid;
  for (const raw of text.split(/,|\n/)) {
    const part = raw.trim();
    if (!part) continue;
    if (!out.reason && WHY.test(part)) { out.reason = part.replace(/[.。]\s*$/, ""); continue; }
    if (!out.title && !/부가세|부가가치세|VAT|면세/i.test(part)) {
      const t = part.replace(/\d[\d,]*\s*만?\s*(?:\d\s*천)?\s*(?:[\d,]*\s*원)?/g, "").replace(/\s*(?:추가요|추가돼요|더\s*들어요)\s*$/, "").trim();
      if (t && !/^\d/.test(t)) out.title = t.slice(0, 60);
    }
  }
  return out;
}
