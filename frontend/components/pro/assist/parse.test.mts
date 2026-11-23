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
