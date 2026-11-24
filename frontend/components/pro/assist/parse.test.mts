// 업체 도우미 말 해석 시험: pnpm test:unit (node --test). 애매하면 칸을 채우지 않는지까지 봐요.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDates, parseExtra, parsePeriod, parseQuote } from "./parse.ts";

const T = "2026-11-23";

test("금액: 소수 만 단위 · 금액 여럿이면 전체 금액 하나만", () => {
  assert.equal(parseQuote("455.5만 원", T).amount, 4_555_000);
  assert.equal(parseQuote("철거 20만 원 별도 전체 견적 455만 원", T).amount, 4_550_000);
  assert.equal(parseQuote("철거 20만 원, 폐기물 10만 원", T).amount, undefined); // 고를 수 없음
  assert.equal(parseQuote("견적 455만 5천 원, 공사 3일", T).amount, 4_555_000);
  assert.equal(parseQuote("4,550,000원", T).amount, 4_550_000);
});

test("부가세: 부정한 말은 버리고 하나일 때만", () => {
  assert.equal(parseQuote("면세는 아니고 부가세 포함", T).vat, "included");
  assert.equal(parseQuote("면세 업체예요", T).vat, "exempt");
  assert.equal(parseQuote("부가세 포함, 철거는 별도", T).vat, "included");
  assert.equal(parseQuote("부가세 포함인데 부가세 별도일 수도", T).vat, undefined); // 서로 다름
});

test("실측 기간: 범위 표시가 있을 때만 기간", () => {
  assert.equal(parsePeriod("12월 2일과 12월 5일만 가능", T), null);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 돼요, 12/4는 안 돼요", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] });
  assert.deepEqual(parsePeriod("12/3 돼요", T), { start: "2026-12-03", end: "2026-12-03", excluded: [], outside: [] });
});

test("공사 날짜 · 추가 금액", () => {
  assert.deepEqual(parseDates("12/8부터 12/11까지 되는데 12/9는 안 돼요, 3명", T, null, ["2026-12-10"]), { days: ["2026-12-08", "2026-12-11"], crew: 3 });
  assert.deepEqual(parseDates("12월 2일과 12월 5일만 가능", T), { days: ["2026-12-02", "2026-12-05"], crew: undefined });
  // 주말에 공사하지 않는 집: 12/4(금) ~ 12/8(화)에서 토 · 일을 뺀다
  assert.deepEqual(parseDates("12/4부터 12/8까지, 2명", T, null, [], true), { days: ["2026-12-04", "2026-12-07", "2026-12-08"], crew: 2 });
  const x = parseExtra("곰팡이 방지 처리 12만 원, 부가세 포함, 벽 안쪽까지 곰팡이가 퍼져서", T);
  assert.deepEqual(x, { amount: 120_000, vat: "included", title: "곰팡이 방지 처리", reason: "벽 안쪽까지 곰팡이가 퍼져서" });
});

test("리뷰 회귀: 부정 · 정정 표현", () => {
  assert.equal(parseQuote("부가세 포함 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 포함 아닙니다, 부가세 별도예요", T).vat, "excluded");
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 안 됩니다", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] });
  assert.equal(parseQuote("견적 455만 원이 아니라 555만 원", T).amount, 5_550_000);
  assert.equal(parseQuote("455만 말고 555만 원이요", T).amount, 5_550_000);
  assert.equal(parseQuote("455만 원이 아니에요", T).amount, undefined); // 고친 값이 없으면 비워요
});

test("리뷰 회귀: 기간 'N일간'은 날짜가 아니에요", () => {
  assert.deepEqual(parseDates("12/8부터 3일간 2명", T), { days: [], crew: 2 }); // 끝 날을 계산하지 않아요
  assert.equal(parsePeriod("12/2부터 5일간", T), null);
  assert.deepEqual(parseDates("12/8부터 3일, 2명", T), { days: [], crew: 2 }); // 3일이 12/3은 아니에요
  assert.deepEqual(parseDates("12/8부터 12/10까지, 2~3명", T), { days: ["2026-12-08", "2026-12-09", "2026-12-10"], crew: undefined });
});

test("리뷰 회귀: 억 · 조건부 부가세", () => {
  assert.equal(parseQuote("견적 1억 500만 원", T).amount, undefined);
  assert.equal(parseQuote("1억 2000만 원", T).amount, undefined);
  const c = parseQuote("455만 원 (부가세 별도 시 415만 원)", T);
  assert.equal(c.vat, undefined);
  assert.equal(c.amount, undefined);
});

test("리뷰 회귀: 부가세 포함을 부정하는 말", () => {
  for (const t of ["부가세 포함 안 됩니다", "부가세 포함 안 해요", "부가세 포함 안 했어요", "부가세 포함 않습니다", "부가세 포함 X", "부가세 포함(X)"]) {
    assert.equal(parseQuote(t, T).vat, undefined, t);
  }
  assert.equal(parseQuote("부가세 포함 안 돼요, 별도예요", T).vat, "excluded");
});

test("리뷰 회귀: 유효기간은 '유효'에 붙은 날짜만", () => {
  assert.equal(parseQuote("12/11까지 공사하고 유효기간은 일주일", T).valid, undefined);
  assert.equal(parseQuote("12/11까지 공사, 견적은 유효기간 없이", T).valid, undefined);
  assert.equal(parseQuote("12/11까지 공사, 12/17까지 유효", T).valid, "2026-12-17");
  assert.deepEqual(parseQuote("견적 455만 원, 부가세 포함, 공사 3일, 12/17까지 유효", T), { amount: 4_550_000, vat: "included", days: 3, valid: "2026-12-17" });
  assert.equal(parseQuote("유효기간은 12/17까지", T).valid, "2026-12-17");
});

test("리뷰 회귀: 안 되는 날 · 괄호 · 요일", () => {
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 돼요, 12/4는 못 갑니다", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] });
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 돼요, 12/4는 안 될 수도", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] });
  const both = { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-03", "2026-12-04"], outside: [] };
  assert.deepEqual(parsePeriod("12/2 ~ 12/5 (12/3, 12/4 불가)", T), both);
  assert.deepEqual(parsePeriod("12/2 ~ 12/5 (12/3, 12/4 안 돼요)", T), both);
  assert.equal(parsePeriod("12/2, 12/3 빼고 12/5까지", T), null);
  assert.equal(parsePeriod("12/2부터 12/5까지 돼요, 수요일은 안 돼요", T), null);
});

test("리뷰 회귀: 정정하면 비워요", () => {
  assert.equal(parsePeriod("12/2부터 12/5까지 → 12/3부터 12/6까지로 정정", T), null);
  assert.equal(parsePeriod("12/2부터 12/5까지 돼요. 아니 12/3부터요", T), null);
  assert.equal(parseDates("12/2부터 12/5까지 → 12/3부터 12/6까지로 정정", T), null);
  // 공사 기간은 고친 뒤 값을 써요(#174와 같은 규칙). 어느 값인지 모르면 비워요
  assert.equal(parseQuote("공사 3일, 아니 4일", T).days, 4);
  assert.equal(parseQuote("공사 3일 아니고 4일", T).days, 4);
  for (const t of ["공사 3일에서 4일", "3일 정도 걸리는데 주말 끼면 5일", "공사 3일 걸리고 건조 2일"]) {
    assert.equal(parseQuote(t, T).days, undefined, t);
  }
  assert.equal(parseQuote("공사 3일, 12월 17일까지 유효", T).days, 3);
});

test("리뷰 회귀: 추가 금액 항목 이름", () => {
  assert.equal(parseExtra("작은방 천장 2평 추가", T).title, "작은방 천장 2평 추가");
  assert.equal(parseExtra("석고보드 3장 교체, 5만 원", T).title, "석고보드 3장 교체");
  const x = parseExtra("곰팡이 방지 12만 원이 아니라 15만 원", T);
  assert.equal(x.title, "곰팡이 방지");
  assert.equal(x.amount, 150_000);
  // 리뷰(PR #176): 천 단위 쉼표를 문장 구분으로 보지 않아요
  const mold = parseExtra("곰팡이 처리 1,000,000원, 부가세 포함, 벽면 곰팡이 발견해서", T);
  assert.equal(mold.title, "곰팡이 처리");
  assert.equal(mold.amount, 1_000_000);
  assert.equal(mold.vat, "included");
  assert.equal(mold.reason, "벽면 곰팡이 발견해서");
  // QA: 천 단위 쉼표에서 토막을 나누지 않고, 억 금액은 항목 이름에 남기지 않아요
  const big = parseExtra("걸레받이 교체 1,000,000,000원 부가세 별도, 기존 것이 썩어서", T);
  assert.equal(big.title, "걸레받이 교체");
  assert.equal(big.amount, 1_000_000_000);
  assert.equal(big.reason, "기존 것이 썩어서");
  const eok = parseExtra("합판 보강 2억 원, 부가세 포함", T);
  assert.equal(eok.title, "합판 보강");
  assert.equal(eok.amount, undefined); // 억은 읽지 않아요(화면이 '금액을 읽지 못했어요'로 알려요)
});

// #174(dev)에서 온 시험 문장
test("#174 금액: 소수 만 단위 · 금액 여럿이면 전체 금액 하나만", () => {
  assert.equal(parseQuote("455.5만 원", T).amount, 4_555_000);
  assert.equal(parseQuote("철거 20만 원 별도 전체 견적 455만 원", T).amount, 4_550_000);
  assert.equal(parseQuote("철거 20만 원, 폐기물 10만 원", T).amount, undefined); // 고를 수 없음
  assert.equal(parseQuote("견적 455만 5천 원, 공사 3일", T).amount, 4_555_000);
  assert.equal(parseQuote("4,550,000원", T).amount, 4_550_000);
});

test("#174 부가세: 부정한 말은 버리고 하나일 때만", () => {
  assert.equal(parseQuote("면세는 아니고 부가세 포함", T).vat, "included");
  assert.equal(parseQuote("면세 업체예요", T).vat, "exempt");
  assert.equal(parseQuote("부가세 포함, 철거는 별도", T).vat, "included");
  assert.equal(parseQuote("부가세 포함인데 부가세 별도일 수도", T).vat, undefined); // 서로 다름
  // QA: '아닙니다'도 부정, 부정만 있고 남은 방식이 없으면 비워요
  assert.equal(parseQuote("부가세 포함 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("면세는 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 별도 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 포함된 금액이 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("면세는 아닙니다, 부가세 별도예요", T).vat, "excluded");
  // 리뷰: '안 합니다 · 하지 않아요'도 부정
  assert.equal(parseQuote("부가세 포함 안 합니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 별도 안 합니다", T).vat, undefined);
  assert.equal(parseQuote("면세 안 합니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 포함 안 해요", T).vat, undefined);
  assert.equal(parseQuote("부가세 포함하지 않아요", T).vat, undefined);
  assert.equal(parseQuote("면세 안 합니다, 부가세 포함이에요", T).vat, "included");
});

test("#174 정정: 고친 뒤 값을 쓰고 앞의 틀린 값은 넣지 않아요", () => {
  assert.equal(parseQuote("견적 455만 원이 아니라 555만 원입니다", T).amount, 5_550_000);
  assert.equal(parseQuote("공사 3일 아니고 5일 걸려요", T).days, 5);
  assert.equal(parseQuote("유효기간 12/17까지 아니고 12/20까지", T).valid, "2026-12-20");
  // 고친 값 없이 부정만 하면 비워요
  assert.equal(parseQuote("견적 455만 원은 아니에요", T).amount, undefined);
  assert.equal(parseQuote("공사 3일은 아닙니다", T).days, undefined);
  assert.equal(parseQuote("12/17까지 유효는 아니에요", T).valid, "2026-12-17"); // 부정이 날짜 바로 뒤가 아니면 그대로
});

test("#174 변경 표현: 바꾼 값을 쓰고, 못 고르면 비워요", () => {
  assert.equal(parseQuote("견적 455만 원에서 555만 원으로 변경", T).amount, 5_550_000);
  assert.equal(parseQuote("견적은 455만 원, 아니 555만 원", T).amount, 5_550_000);
  assert.equal(parseQuote("견적 455만 원 → 555만 원", T).amount, 5_550_000);
  assert.equal(parseQuote("공사 3일에서 5일로 변경했어요", T).days, 5);
  assert.equal(parseQuote("공사 3일, 아니 5일 걸려요", T).days, 5);
  // 바꾸는 말은 있는데 어느 값인지 모르면 앞 값을 넣지 않아요
  assert.equal(parseQuote("견적 455만 원에서 555만 원 사이로 변경될 수 있어요", T).amount, undefined);
  assert.equal(parseQuote("견적 455만 원 변경해서 555만 원", T).amount, undefined);
  assert.equal(parseQuote("공사 3일인데 변경되면 5일", T).days, undefined);
});

test("#174 실측 기간: 범위 표시가 있을 때만 기간", () => {
  assert.equal(parsePeriod("12월 2일과 12월 5일만 가능", T), null);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 돼요, 12/4는 안 돼요", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] });
  assert.deepEqual(parsePeriod("12/3 돼요", T), { start: "2026-12-03", end: "2026-12-03", excluded: [], outside: [] });
});

test("#174 실측 기간: '안 됩니다 · 불가 · 어렵습니다'도 빼는 날", () => {
  const want = { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] };
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 안 됩니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 가능합니다, 12/4는 불가합니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 어렵습니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 힘들어요", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 못 갑니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 쉽니다", T), want);
});

test("#174 실측 기간: 안 된다고 한 날은 첫날 · 끝날 · 늘어놓은 날이어도 빼요", () => {
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 가능합니다, 12/2는 안 돼요", T), { start: "2026-12-03", end: "2026-12-05", excluded: [], outside: [] });
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 가능합니다, 12/5는 안 돼요", T), { start: "2026-12-02", end: "2026-12-04", excluded: [], outside: [] });
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 가능합니다, 12/4, 12/3은 안 돼요", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-03", "2026-12-04"], outside: [] });
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 가능합니다, 12/2, 12/3은 안 돼요", T), { start: "2026-12-04", end: "2026-12-05", excluded: [], outside: [] });
  assert.equal(parsePeriod("12/2부터 12/3까지 가능합니다, 12/2, 12/3은 안 돼요", T), null); // 남는 날이 없으면 비움
  assert.deepEqual(parsePeriod("12/2, 12/3 돼요", T), null); // 범위 표시 없이 늘어놓은 날은 그대로 비움
});

test("#174 실측 기간: 이중 부정('어렵지 않아요')은 빼지 않아요", () => {
  const all = { start: "2026-12-02", end: "2026-12-05", excluded: [], outside: [] };
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4도 어렵지 않아요", T), all);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 안 되지는 않아요", T), all);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 힘들지 않습니다", T), all);
});
