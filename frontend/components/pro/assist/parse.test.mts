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
  for (const t of ["공사 3일, 아니 4일", "공사 3일 아니고 4일", "공사 3일에서 4일", "3일 정도 걸리는데 주말 끼면 5일", "공사 3일 걸리고 건조 2일"]) {
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
});
