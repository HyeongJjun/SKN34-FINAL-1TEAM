// 업체 도우미 말 해석 시험: pnpm test:unit (node --test). 애매하면 칸을 채우지 않는지까지 봐요.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePeriod, parseQuote } from "./parse.ts";

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
  // QA: '아닙니다'도 부정, 부정만 있고 남은 방식이 없으면 비워요
  assert.equal(parseQuote("부가세 포함 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("면세는 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 별도 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("부가세 포함된 금액이 아닙니다", T).vat, undefined);
  assert.equal(parseQuote("면세는 아닙니다, 부가세 별도예요", T).vat, "excluded");
});

test("정정: 고친 뒤 값을 쓰고 앞의 틀린 값은 넣지 않아요", () => {
  assert.equal(parseQuote("견적 455만 원이 아니라 555만 원입니다", T).amount, 5_550_000);
  assert.equal(parseQuote("공사 3일 아니고 5일 걸려요", T).days, 5);
  assert.equal(parseQuote("유효기간 12/17까지 아니고 12/20까지", T).valid, "2026-12-20");
  // 고친 값 없이 부정만 하면 비워요
  assert.equal(parseQuote("견적 455만 원은 아니에요", T).amount, undefined);
  assert.equal(parseQuote("공사 3일은 아닙니다", T).days, undefined);
  assert.equal(parseQuote("12/17까지 유효는 아니에요", T).valid, "2026-12-17"); // 부정이 날짜 바로 뒤가 아니면 그대로
});

test("실측 기간: 범위 표시가 있을 때만 기간", () => {
  assert.equal(parsePeriod("12월 2일과 12월 5일만 가능", T), null);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 돼요, 12/4는 안 돼요", T), { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] });
  assert.deepEqual(parsePeriod("12/3 돼요", T), { start: "2026-12-03", end: "2026-12-03", excluded: [], outside: [] });
});

test("실측 기간: '안 됩니다 · 불가 · 어렵습니다'도 빼는 날", () => {
  const want = { start: "2026-12-02", end: "2026-12-05", excluded: ["2026-12-04"], outside: [] };
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 안 됩니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 가능합니다, 12/4는 불가합니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 어렵습니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 힘들어요", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 못 갑니다", T), want);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 쉽니다", T), want);
});

test("실측 기간: 이중 부정('어렵지 않아요')은 빼지 않아요", () => {
  const all = { start: "2026-12-02", end: "2026-12-05", excluded: [], outside: [] };
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4도 어렵지 않아요", T), all);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 안 되지는 않아요", T), all);
  assert.deepEqual(parsePeriod("12/2부터 12/5까지 됩니다, 12/4는 힘들지 않습니다", T), all);
});
