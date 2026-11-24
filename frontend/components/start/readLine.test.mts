// 재재 첫 한 줄 읽기 시험: pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { readLine } from "./readLine.ts";

const T = "2026-11-23";
// 실제 자료처럼 서울이 먼저이고, 중구 · 강서구 · 서구는 여러 시 · 도에 있어요
const REGIONS = [
  { id: "seoul", name: "서울", full: "서울특별시", groups: [{ label: "", prefix: "서울", items: ["강남구", "강서구", "노원구", "서대문구", "중구"] }] },
  { id: "busan", name: "부산", full: "부산광역시", groups: [{ label: "", prefix: "부산", items: ["강서구", "부산진구", "서구", "중구"] }] },
  { id: "daegu", name: "대구", full: "대구광역시", groups: [{ label: "", prefix: "대구", items: ["동구", "서구", "중구"] }] },
] as never;
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

test("리뷰 회귀: 달력에 없는 시작일은 넣지 않고, 범위 밖 면적은 읽어 두어 다시 물어요", () => {
  assert.equal(read("2월 31일부터 시작").start, undefined);
  assert.equal(read("11월 31일부터 시작").start, undefined);
  assert.equal(read("2월 28일부터 시작").start, "2027-02-28");
  assert.equal(read("노원구 450㎡ 전체 도배").area, "450");
  assert.equal(read("노원구 400m^2 전체 도배").area, "400");
});

test("리뷰 회귀: 안 산다는 말은 빈 집이에요", () => {
  assert.equal(read("지금 살고 있지 않아요").occupied, false);
  assert.equal(read("거기 안 살아요").occupied, false);
  assert.equal(read("거주하지 않아요").occupied, false);
  assert.equal(read("지금 살고 있어요").occupied, true);
  assert.equal(read("이사 전이라 비어 있어요").occupied, false);
});

test("리뷰 회귀: 여러 시 · 도에 있는 구 이름", () => {
  assert.deepEqual([read("대구 중구 24평").sido, read("대구 중구 24평").sgg], ["daegu", "중구"]);
  assert.deepEqual([read("부산 강서구 아파트").sido, read("부산 강서구 아파트").sgg], ["busan", "강서구"]);
  assert.deepEqual([read("노원구 24평").sido, read("노원구 24평").sgg], ["seoul", "노원구"]);
  assert.equal(read("중구 24평").sgg, undefined); // 어느 시인지 몰라요
});

test("리뷰 회귀: 면적 소수 · 공급 전용 둘 다", () => {
  const a = read("84.97㎡ 전용");
  assert.equal(a.area, "84.97");
  assert.equal(a.basis, "exclusive");
  assert.equal(read("33.06평").area, toM2("33.06"));
  assert.equal(read("공급 112㎡ 전용 84㎡").area, undefined);
  assert.equal(read("전용 아니고 84㎡").basis, "supply");
});

test("리뷰 회귀: 벽지 둘 다 말하면 비워요", () => {
  assert.equal(read("실크 말고 합지로").grade, undefined);
  assert.equal(read("실크는 비싸서 합지로 할게요").grade, undefined);
  assert.equal(read("합지로 해 주세요").grade, "economy");
});

test("리뷰 회귀: 시작일은 '부터 · 에 · 쯤'이 붙을 때만", () => {
  assert.equal(read("12월 20일까지 끝내야 해요").start, undefined);
  assert.equal(read("12/20 이사라 그 전에").start, undefined);
  assert.equal(read("2/3만 부분 도배").start, undefined);
  assert.equal(read("12월 5일부터 시작").start, "2026-12-05");
  assert.equal(read("12/10쯤 하고 싶어요").start, "2026-12-10");
});

test("리뷰 회귀: 앞으로 살 거라는 말은 비워요", () => {
  assert.equal(read("거주 예정이에요").occupied, undefined);
  assert.equal(read("빨리 들어가 살고 싶어요").occupied, undefined);
});
