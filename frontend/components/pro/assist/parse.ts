// 업체 도우미: 업체가 말로 적은 글에서 폼 칸에 넣을 값만 뽑아요(규칙만 쓰고 LLM은 부르지 않아요).
// 금액은 적은 숫자 그대로 옮기고 더하거나 곱하지 않아요. 저장 · 보내기는 하지 않아요.
// 애매하면 칸을 채우지 않아요(틀린 값을 넣는 것보다 비워 두고 업체가 적는 편이 안전해요).

/** outside: 안 된다고 했지만 기간 밖이라 넣지 않은 날 */
export type PeriodFill = { start: string; end: string; excluded: string[]; outside: string[] };
export type QuoteFill = { amount?: number; vat?: "included" | "excluded" | "exempt"; days?: number; valid?: string };

const NO = /안\s*(?:돼|됨|되|됩|될)|못\s*\S|불가|빼고|빼\s*주|빼요|어려|어렵|제외|않/;
// 정정: "12/2부터 → 12/3부터로 정정" · "아니 12/3부터요"면 날짜를 비워요
const FIX = /→|->|정정|(?:^|[\s.,!?])아니(?:\s|,|$)|말고|다시/;
// 토막 나누기: 쉼표 · 줄바꿈 · 이음말, 마침표는 숫자 사이(12.2)가 아닐 때만
const PARTS = /,|\n|(?<!\d)\.|\.(?!\d)|그리고|하고|인데|는데|지만/;
const DATE = String.raw`(?:\d{1,2}\s*(?:\/|\.|월)\s*)?\d{1,2}\s*일?`;
const pad = (n: number) => String(n).padStart(2, "0");

/** 토막 나누기. 괄호 안은 한 토막으로 둬요("(12/3, 12/4 불가)"는 둘 다 안 되는 날) */
function partsOf(text: string): string[] {
  const inner: string[] = [];
  const outer = text.replace(/\(([^)]*)\)/g, (_, x: string) => { inner.push(x); return ","; });
  return [...outer.split(PARTS), ...inner].filter((p) => p.trim());
}

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

type Month = { m: number; prev?: string; bad?: boolean };

/** 글 한 토막의 날짜들. "12/2", "12.2", "12월 2일", "3일", "12/2~5"를 읽고, 달이 없으면 앞에서 본 달을 써요.
 *  "3일간 · 3일 정도"는 기간이라 날짜가 아니에요. ok면 달 없는 날이 앞 날보다 이를 때 애매하다고 표시해요("12/8부터 3일") */
function daysIn(part: string, today: string, month: Month, ok = false): string[] {
  const text = part.replace(/[~\-–]\s*(\d{1,2})(?!\s*[/.월\d])/g, "~$1일");
  const out: string[] = [];
  for (const x of text.matchAll(/(?:(\d{1,2})\s*(?:\/|\.|월)\s*(\d{1,2})\s*일?)|(?:(?<!\d)(\d{1,2})\s*일(?!\s*(?:간|동안|정도|째|걸|소요)))/g)) {
    if (x[1]) month.m = Number(x[1]);
    const day = iso(month.m, Number(x[2] ?? x[3]), today);
    if (!day) continue;
    if (ok) {
      if (x[3] && month.prev && day < month.prev) month.bad = true;
      month.prev = day;
    }
    out.push(day);
  }
  return out;
}

/** 기간 표시: '부터 · 까지 · ~ · -'가 있어야 처음 ~ 끝을 기간으로 봐요 */
const RANGE = /부터|까지|~|∼|(?<=\d\s*일?\s*)[-–](?=\s*\d)/;

/** "12/2부터 12/5까지 돼요, 12/4는 안 돼요" → 기간과 빼는 날. 못 읽으면 null.
 *  "12월 2일과 12월 5일만 가능"처럼 날짜만 늘어놓으면 기간이 아니라서 비워요(하루만 말하면 그 하루) */
export function parsePeriod(text: string, today: string, baseMonth?: string | null): PeriodFill | null {
  if (FIX.test(text)) return null;
  const month: Month = { m: Number((baseMonth ?? today).slice(5, 7)) };
  const ok: string[] = [];
  const no: string[] = [];
  for (const part of partsOf(text)) {
    if (!NO.test(part)) { ok.push(...daysIn(part, today, month, true)); continue; }
    const got = daysIn(part, today, month);
    // "수요일은 안 돼요" · "12/3 빼고 12/5까지"는 날을 정할 수 없어요
    if (!got.length && /요일|주말/.test(part)) return null;
    if (got.length && RANGE.test(part)) return null;
    no.push(...got);
  }
  if (month.bad || !ok.length) return null;
  // 범위 표시 없이 늘어놓거나, "12/2부터"처럼 끝이 없으면 비워요
  if (new Set(ok).size > 1 !== RANGE.test(text)) return null;
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
  if (/억/.test(text)) return undefined; // 억 단위는 읽지 않아요
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
const NOT = /^\s*(?:은|는|이|가)?\s*(?:아니|아닙|아님|아녜|아냐|없|안\s*\S|않|못|\(\s*[Xx×]\s*\)|[Xx×](?![A-Za-z]))/;
/** 바로 뒤에 붙으면 조건이라 고를 수 없는 말("부가세 별도 시 415만 원") */
const IF = /^\s*(?:시|면|하면|이면|라면|일\s*(?:때|경우))(?![가-힣])/;
/** "부가세 포함 안 돼요, 별도예요"처럼 포함을 부정한 뒤 이어지는 토막 */
const THEN_EX = /^[^,.\n]*[,.\n]\s*(?:별도|따로|미포함)/;

/** 부가세: '부가세 · VAT' 바로 뒤 말만 봐요("부가세 포함, 철거는 별도"는 포함이에요).
 *  "면세는 아니고 부가세 포함"처럼 부정한 말은 버리고, 남은 방식이 하나일 때만 채워요 */
function vatIn(text: string): QuoteFill["vat"] {
  const said = new Set<NonNullable<QuoteFill["vat"]>>();
  for (const m of text.matchAll(/면세/g)) {
    if (!NOT.test(text.slice(m.index + m[0].length))) said.add("exempt");
  }
  for (const m of text.matchAll(/(?:부가세|부가가치세|VAT)\s*(?:는|은)?\s*(별도|빼고|미포함|따로|포함)/gi)) {
    const rest = text.slice(m.index + m[0].length);
    if (IF.test(rest)) return undefined;
    if (!NOT.test(rest)) said.add(m[1] === "포함" ? "included" : "excluded");
    else if (m[1] === "포함" && THEN_EX.test(rest)) said.add("excluded");
  }
  return said.size === 1 ? [...said][0] : undefined;
}

/** 유효기간: '유효'에 바로 붙은 날짜만 써요("12/17까지 유효" · "유효기간은 12/17까지"). "12/11까지 공사, 유효기간은 일주일"은 비워요 */
function validIn(text: string, today: string): string | undefined {
  const D = String.raw`(?<![\d/.])(${DATE})`;
  const re = new RegExp(String.raw`${D}\s*까지\s*(?:만\s*)?유효|유효\s*기간\s*(?:은|는|이)?\s*${D}\s*까지`, "g");
  const hits = new Set([...text.matchAll(re)].map((m) => (m[1] ?? m[2]).trim()));
  if (hits.size !== 1) return undefined;
  const said = [...hits][0];
  const bare = !/[/.월]/.test(said);
  const tm = Number(today.slice(5, 7));
  let d: string | undefined = daysIn(bare ? `${said.replace(/일/, "")}일` : said, today, { m: tm })[0];
  // 달 없이 "17일까지"라고 했는데 이미 지난 날이면 다음 달로 봐요
  if (d && bare && d < today) d = iso((tm % 12) + 1, Number(d.slice(8, 10)), today) ?? undefined;
  return d;
}

/** 달 없이 쓴 "N일"(날짜 "12월 17일" · "17일까지"는 빼요). 둘 이상이면 공사 기간을 고를 수 없어요 */
const BARE_DAYS = /(?<![\d/.]|월\s*)(\d{1,3})\s*일(?!\s*(?:까지|부터|요일))/g;

/** 공사 기간: "공사 3일" · "3일 걸려요" · "3일간"처럼 기간이라는 말이 붙을 때만 읽어요("9일부터"는 날짜예요).
 *  "공사 3일, 아니 4일" · "3일 걸리고 건조 2일"처럼 후보가 여럿이거나 정정하면 비워요 */
function daysOf(text: string): number | undefined {
  const m = text.match(/(?:공사|작업|시공)\s*(?:기간)?\s*(?:은|는|이|가)?\s*(\d{1,3})\s*일(?!\s*까지)/) ?? text.match(/(\d{1,3})\s*일\s*(?:간|동안|걸|소요|작업|정도)/);
  if (!m) return undefined;
  if ([...text.matchAll(BARE_DAYS)].length !== 1) return undefined;
  if (/아니|정정|→|->|말고|다시/.test(text.slice((m.index ?? 0) + m[0].length).slice(0, 12))) return undefined;
  return Number(m[1]);
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
  // 인원: "2~3명"이나 서로 다른 인원이면 비워요
  const crews = new Set([...text.matchAll(/(\d)\s*명/g)].map((m) => Number(m[1])));
  const crew = !/\d\s*[~\-–∼]\s*\d\s*명/.test(text) && crews.size === 1 ? [...crews][0] : undefined;
  const said = text.replace(/\d\s*(?:[~\-–∼]\s*\d\s*)?명/g, "");
  const days: string[] = [];
  if (RANGE.test(said)) {
    const p = parsePeriod(said, today, baseMonth);
    const skip = new Set([...(p?.excluded ?? []), ...holidays]);
    for (let d = new Date(`${p?.start}T00:00:00Z`); p && d.toISOString().slice(0, 10) <= p.end; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      if (!skip.has(k) && !(noWeekend && (d.getUTCDay() === 0 || d.getUTCDay() === 6))) days.push(k);
    }
  } else {
    const month: Month = { m: Number((baseMonth ?? today).slice(5, 7)) };
    const skip = new Set(holidays);
    const got = FIX.test(said) ? [] : partsOf(said).filter((x) => !NO.test(x)).flatMap((x) => daysIn(x, today, month, true));
    if (!month.bad) days.push(...[...new Set(got)].filter((d) => !skip.has(d)).sort());
  }
  if (!days.length && !crew) return null;
  return { days, crew };
}

export type ExtraFill = QuoteFill & { title?: string; reason?: string };
const WHY = /(?<!견적|계약|문|청구|확인)서\s*요?\s*$|때문/;
/** 항목 이름에서 지울 금액: 만 · 원이 붙은 숫자만("2평 · 3장"은 둬요) */
const AMOUNT_WORD = /\d[\d,]*(?:\.\d+)?\s*만\s*(?:\d\s*천)?\s*(?:[\d,]*\s*원)?(?:이|가|은|는)?|\d[\d,]*\s*원(?:이|가|은|는)?/g;

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
      // 정정한 뒤 말은 항목 이름이 아니에요("곰팡이 방지 12만 원이 아니라 15만 원")
      const head = part.split(/아니라|아니고|말고/)[0];
      const t = head.replace(AMOUNT_WORD, "").replace(/\s*(?:추가요|추가돼요|더\s*들어요)\s*$/, "").replace(/\s+/g, " ").trim();
      if (t && !/^\d/.test(t)) out.title = t.slice(0, 60);
    }
  }
  return out;
}
