// 업체 도우미: 업체가 말로 적은 글에서 폼 칸에 넣을 값만 뽑아요(규칙만 쓰고 LLM은 부르지 않아요).
// 금액은 적은 숫자 그대로 옮기고 더하거나 곱하지 않아요. 저장 · 보내기는 하지 않아요.
// 애매하면 칸을 채우지 않아요(틀린 값을 넣는 것보다 비워 두고 업체가 적는 편이 안전해요).

/** outside: 안 된다고 했지만 기간 밖이라 넣지 않은 날 */
export type PeriodFill = { start: string; end: string; excluded: string[]; outside: string[] };
export type QuoteFill = { amount?: number; vat?: "included" | "excluded" | "exempt"; days?: number; valid?: string };

const NO = /안\s*돼|안\s*됨|안\s*되|못\s*가|불가|빼고|빼\s*주|빼요|어려|제외/;
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

/** "12/2부터 12/5까지 돼요, 12/4는 안 돼요" → 기간과 빼는 날. 못 읽으면 null */
export function parsePeriod(text: string, today: string, baseMonth?: string | null): PeriodFill | null {
  const month = { m: Number((baseMonth ?? today).slice(5, 7)) };
  const ok: string[] = [];
  const no: string[] = [];
  for (const part of text.split(PARTS)) {
    if (!part.trim()) continue;
    (NO.test(part) ? no : ok).push(...daysIn(part, today, month));
  }
  if (!ok.length) return null;
  ok.sort();
  const start = ok[0];
  const end = ok[ok.length - 1];
  const nos = [...new Set(no)].sort();
  return { start, end, excluded: nos.filter((d) => d > start && d < end), outside: nos.filter((d) => d < start || d > end) };
}

/** 금액: "455만 원" · "455만 5천 원" · "455만 5,000원" · "4,550,000원". 만 뒤 숫자는 바로 '원'이 붙을 때만 더해요("455만 3일"의 3은 금액이 아니에요) */
function amountIn(text: string): number | undefined {
  const man = text.match(/(\d[\d,]*)\s*만\s*(?:(\d)\s*천)?\s*(?:(\d[\d,]*)\s*원)?/);
  if (man) return Number(man[1].replace(/,/g, "")) * 10000 + (man[2] ? Number(man[2]) * 1000 : 0) + (man[3] ? Number(man[3].replace(/,/g, "")) : 0);
  const raw = text.match(/(\d{1,3}(?:,\d{3})+|\d{6,})\s*원?/);
  return raw ? Number(raw[1].replace(/,/g, "")) : undefined;
}

/** 부가세: '부가세 · VAT' 바로 뒤 말만 봐요("부가세 포함, 철거는 별도"는 포함이에요) */
function vatIn(text: string): QuoteFill["vat"] {
  if (/면세/.test(text)) return "exempt";
  const m = text.match(/(?:부가세|부가가치세|VAT)\s*(?:는|은)?\s*(별도|빼고|미포함|따로|포함)/i);
  if (!m) return undefined;
  return m[1] === "포함" ? "included" : "excluded";
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
