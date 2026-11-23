// 재재 첫 한 줄 읽기 시험: pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { readLine } from "./readLine.ts";

const T = "2026-11-23";
const REGIONS = [{ id: "seoul", name: "서울", groups: [{ name: "", items: ["노원구", "강남구"] }] }] as never;
const toM2 = (p: string) => (Number(p) > 0 ? (Math.round(Number(p) * 3.3058 * 10) / 10).toFixed(1) : null);
const read = (t: string) => readLine(t, REGIONS, T, toM2);

test("리뷰 회귀: '5일부터'의 '일부'는 부분 공사가 아니에요", () => {
  const got = read("노원구 24평 전체 도배, 12월 5일부터 시작");
  assert.equal(got.scope, "full");
  assert.equal(got.start, "2026-12-05");
  assert.equal(got.sgg, "노원구");
  assert.equal(read("12월 5일부터 하고 싶어요").scope, undefined);
  assert.equal(read("방 하나만 부분 도배").scope, "partial");
  assert.equal(read("전체 말고 일부만").scope, undefined); // 둘 다 말하면 애매해서 비워요
});

test("리뷰 회귀: 안 산다는 말은 빈 집이에요", () => {
  assert.equal(read("지금 살고 있지 않아요").occupied, false);
  assert.equal(read("거기 안 살아요").occupied, false);
  assert.equal(read("거주하지 않아요").occupied, false);
  assert.equal(read("지금 살고 있어요").occupied, true);
  assert.equal(read("이사 전이라 비어 있어요").occupied, false);
});
