// 재재 질문 버튼 고르기 시험(#180): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { guestChips, starterChips } from "./chips.ts";
import { readLine } from "../start/readLine.ts";

test("고객 공사: 칸마다 시작 질문, 물은 건 빼고 3개까지", () => {
  assert.equal(starterChips(2, []).length, 3);
  assert.ok(starterChips(5, []).includes("도배 전에 뭘 준비해요?"));
  assert.equal(starterChips(5, ["도배 전에 뭘 준비해요?"]).includes("도배 전에 뭘 준비해요?"), false);
  assert.equal(starterChips(0, []).join(), starterChips(2, []).join()); // 범위 밖 칸은 가장 가까운 칸
  assert.equal(starterChips(9, []).join(), starterChips(8, []).join());
  const all = [2, 3, 4, 5, 6, 7, 8].flatMap((s) => starterChips(s, []));
  for (const q of all) assert.ok(!/얼마|몇\s*일|며칠|평당|단가/.test(q), q); // 숫자를 바로 묻지 않아요(계산 엔진 몫)
});

test("손님: 빈 칸만 답 버튼, 누른 말은 readLine이 그 칸으로 읽어요", () => {
  assert.deepEqual(guestChips({ scope: "full", occupied: true, grade: "basic" }), ["부분 도배만 할래요"]);
  assert.deepEqual(guestChips({ scope: "partial", occupied: false, grade: "economy" }), []);
  assert.ok(guestChips({ scope: "full", occupied: null, grade: null }).length <= 4);
  const toM2 = () => null;
  const read = (t: string) => readLine(t, [] as never, "2026-11-24", toM2);
  assert.equal(read("지금 살고 있어요").occupied, true);
  assert.equal(read("빈 집이에요").occupied, false);
  assert.equal(read("실크로 할래요").grade, "basic");
  assert.equal(read("합지로 할래요").grade, "economy");
  assert.equal(read("부분 도배만 할래요").scope, "partial");
});
