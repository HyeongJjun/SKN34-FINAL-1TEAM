// 업체 도우미: 업체가 말로 적은 글에서 폼 칸에 넣을 값만 뽑아요(규칙만 쓰고 LLM은 부르지 않아요).
// 금액은 적은 숫자 그대로 옮기고 더하거나 곱하지 않아요. 저장 · 보내기는 하지 않아요.
// 애매하면 칸을 채우지 않아요(틀린 값을 넣는 것보다 비워 두고 업체가 적는 편이 안전해요).

/** outside: 안 된다고 했지만 기간 밖이라 넣지 않은 날 */
export type PeriodFill = { start: string; end: string; excluded: string[]; outside: string[] };
export type QuoteFill = { amount?: number; vat?: "included" | "excluded" | "exempt"; days?: number; valid?: string };

// 안 되는 날: "안 돼요 · 안 됩니다 · 못 가요 · 불가 · 어렵습니다 · 힘들어요 · 쉬어요" 같은 말
const NO = /안\s*(?:돼|됨|되|됩|됐)|못\s*(?:가|갑|와|오|옵|해|하|합|함)|불가|빼고|빼\s*주|빼요|어려|어렵|힘들|곤란|제외|휴무|쉬어|쉽니다|쉬는/;
/** 이중 부정: "어렵지 않아요 · 안 되지는 않아요"는 되는 날이에요 */
const NO_NOT = /(?:어렵|힘들|곤란|안\s*되|불가하)지\s*(?:는|도|만)?\s*않/;
/** 값을 부정하는 말("455만 원이 아니라", "3일 아니고", "포함 아닙니다") */
const NEG = String.raw`(?:아니|아닙|아냐|아녜|아님|말고)`;
/** 값 바로 뒤에 부정이 붙었는지 */
const NEG_AFTER = new RegExp(String.raw`^\s*원?\s*(?:은|는|이|가)?\s*${NEG}`);
/** 값 바로 뒤에 붙어 "뒤 값으로 고친다"는 말 */
const FIX = String.raw`\s*원?\s*(?:은|는|이|가)?\s*(?:아니라|아니고|아니구|아닌|말고)[\s,]*`;
// 토막 나누기: 쉼표 · 줄바꿈 · 이음말, 마침표는 숫자 사이(12.2)가 아닐 때만
const PARTS = /,|\n|(?<!\d)\.|\.(?!\d)|그리고|하고|인데|지만/;
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
    (NO.test(part) && !NO_NOT.test(part) ? no : ok).push(...daysIn(part, today, month));
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
  hits.sort((a, b) => a.at - b.at);
  // 정정: "견적 455만 원이 아니라 555만 원"은 앞 자리(견적)에 뒤 값을 써요. 뒤 값 없이 부정만 하면 그 값을 버려요
  for (let i = hits.length - 1; i >= 0; i--) {
    const next = hits[i + 1];
    if (next && new RegExp(`^${FIX}$`).test(text.slice(hits[i].end, next.at))) {
      hits[i].won = next.won;
      hits.splice(i + 1, 1);
    } else if (NEG_AFTER.test(text.slice(hits[i].end))) hits.splice(i, 1);
  }
  if (hits.length <= 1) return hits[0]?.won;
  const total = hits.filter((h) => TOTAL.test(text.slice(Math.max(0, h.at - 12), h.at)));
  return total.length === 1 ? total[0].won : undefined;
}

/** 뒤에 붙으면 그 말을 버리는 부정("면세는 아니고", "부가세 포함 아닙니다", "포함된 금액이 아닙니다").
 *  쉼표 · 마침표나 다음 부가세 말을 넘어가서는 보지 않아요 */
const NOT = new RegExp(String.raw`^(?:(?!면세|부가|VAT)[^,.\n]){0,8}?(?:${NEG}|없|않|안\s*(?:돼|됨|되|됩|해|하|함|합|했))`, "i");

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
  // "12/17까지 아니고 12/20까지"처럼 부정한 날은 버려요
  const hits = [...text.matchAll(new RegExp(`(${DATE})\\s*까지`, "g"))].filter((h) => !NEG_AFTER.test(text.slice((h.index ?? 0) + h[0].length)));
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

/** 공사 기간: "공사 3일" · "3일 걸려요" · "3일간"처럼 기간이라는 말이 붙을 때만 읽어요("9일부터"는 날짜예요).
 *  "공사 3일 아니고 5일"은 고친 5일, 뒤 값 없이 "공사 3일은 아니에요"면 비워요 */
function daysOf(text: string): number | undefined {
  const m = text.match(/(?:공사|작업|시공)\s*(?:기간)?\s*(?:은|는|이|가)?\s*(\d{1,3})\s*일(?!\s*까지)/) ?? text.match(/(\d{1,3})\s*일\s*(?:간|동안|걸|소요|작업|정도)/);
  if (!m) return undefined;
  const rest = text.slice((m.index ?? 0) + m[0].length);
  const fixed = rest.match(new RegExp(String.raw`^${FIX}(\d{1,3})\s*일(?!\s*까지)`));
  if (fixed) return Number(fixed[1]);
  return NEG_AFTER.test(rest) ? undefined : Number(m[1]);
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
