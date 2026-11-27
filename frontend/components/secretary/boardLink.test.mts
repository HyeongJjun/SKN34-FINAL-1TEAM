// 재재 대화 → 보드 연동 시험(#197): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { boardTarget, pickRule, requestSaid, type BoardAnswer } from "./boardLink.ts";

const A = (over: Partial<BoardAnswer> = {}): BoardAnswer => ({ notice: "", sections: [], cards: [], ...over });
const V = [
  { vendor_id: "d1", name: "마루와벽", trade: "dobae" as const },
  { vendor_id: "d2", name: "결 도배", trade: "dobae" as const },
  { vendor_id: "m1", name: "나무손", trade: "mokgong" as const },
  // 도배 · 목공을 둘 다 하는 업체
  { vendor_id: "b1", name: "솜씨공방", trade: "dobae" as const },
  { vendor_id: "b1", name: "솜씨공방", trade: "mokgong" as const },
];
const st = { quoted: false, deal: false };
// 도배 견적서가 온 공사: 마루와벽은 견적서를 보냈고, 결도배는 실측 진행 중, 솜씨공방(도배)은 아직 없음
const Q = V.map((v) => (v.vendor_id === "d1" ? { ...v, stage: "quoted" as const } : v.vendor_id === "d2" ? { ...v, stage: "visit" as const } : v));
const sq = { quoted: true, deal: false, chosen: true };

test("답 글 · 표에 나온 업체를 강조하고 업체 칸으로", () => {
  const a = A({ sections: [{ title: "", sentences: ["마루와벽은 후기가 많아요."], caution: "", tip: "" }], cards: [{ title: "비교", text: "", table: { cols: ["업체"], rows: [{ cells: ["결도배"] }] } }] });
  assert.deepEqual(boardTarget("어디가 나아요?", a, V, st), { tab: 2, hi: ["d1", "d2"], trade: "dobae" }); // 띄어쓰기는 달라도 같은 이름
});

test("목공 업체만 나오면 목공 탭", () => {
  const a = A({ cards: [{ title: "", text: "", draft: { vendors: ["나무손"] } }] });
  assert.deepEqual(boardTarget("초안", a, V, st)?.trade, "mokgong");
});

test("도배 업체는 그 업체 상태대로: 견적서 보냄 → 비교 칸, 실측 진행 중 → 실측 칸", () => {
  assert.deepEqual(boardTarget("왜 비싸요?", A({ lead: "마루와벽 견적서가 표준견적서보다 높아요" }), Q, sq), { tab: 4, hi: ["d1"], trade: "dobae" });
  // 리뷰(#220): 견적서를 안 보낸 업체를 비교 칸으로 보내 안 보이던 것
  assert.deepEqual(boardTarget("결도배 견적서 어때요?", A({ notice: "도배 부자재 줄은 합계에 들어가요." }), Q, sq), { tab: 3, hi: ["d2"], trade: "dobae" });
});

test("도배 견적서가 와도 목공 업체를 물으면 업체 칸 목공 탭", () => {
  assert.deepEqual(boardTarget("나무손은 어때요?", A(), Q, sq), { tab: 2, hi: ["m1"], trade: "mokgong" });
  // 답이 도배 업체를 같이 말해도 물은 목공 업체로
  assert.deepEqual(boardTarget("나무손 가견적 봐 줘", A({ lead: "마루와벽 견적서도 왔어요" }), Q, sq), { tab: 2, hi: ["m1"], trade: "mokgong" });
});

test("도배 · 목공을 둘 다 하는 업체: 물은 공종이 먼저", () => {
  // 리뷰(#220): '도배'라고 물었는데 목공 탭으로 가던 것 → 도배 업체 칸(아직 실측 · 견적서 없음)
  assert.deepEqual(boardTarget("솜씨공방 도배 가견적은요?", A(), Q, sq), { tab: 2, hi: ["b1"], trade: "dobae" });
  assert.deepEqual(boardTarget("솜씨공방 목공 가견적은요?", A(), V, st), { tab: 2, hi: ["b1"], trade: "mokgong" });
  // 공종을 안 말하면: 도배 업체를 이미 골랐으면 목공, 아니면 도배
  assert.deepEqual(boardTarget("솜씨공방은 어때요?", A(), Q, sq), { tab: 2, hi: ["b1"], trade: "mokgong" });
  assert.deepEqual(boardTarget("솜씨공방은 어때요?", A(), V, st), { tab: 2, hi: ["b1"], trade: "dobae" });
  // 둘 다 하는 업체가 도배 견적서를 보냈으면 공종을 안 말해도 비교 칸
  const sent = V.map((v) => (v.vendor_id === "b1" && v.trade === "dobae" ? { ...v, stage: "quoted" as const } : v));
  assert.deepEqual(boardTarget("솜씨공방은 어때요?", A(), sent, sq), { tab: 4, hi: ["b1"], trade: "dobae" });
});

test("업체 이름 속 공종 낱말은 묻는 공종으로 보지 않아요", () => {
  const both = [...V, { vendor_id: "x1", name: "한빛도배", trade: "mokgong" as const }, { vendor_id: "x1", name: "한빛도배", trade: "dobae" as const }];
  assert.equal(boardTarget("한빛도배는 어때요?", A(), both, sq)?.trade, "mokgong");
});

test("이름이 없으면 물은 말로: 일정은 실측(확정 뒤면 일정) 칸, 업체 말은 업체 칸", () => {
  assert.equal(boardTarget("실측 날짜는 언제 정해요?", A(), V, st)?.tab, 3);
  assert.equal(boardTarget("공사 날짜 언제 잡혀요?", A(), V, { quoted: false, deal: true })?.tab, 5);
  assert.equal(boardTarget("이 동네 도배 업체 추천해 줘", A({ lead: "특정 업체는 추천하지 않아요." }), V, st)?.tab, 2);
  assert.equal(boardTarget("초배가 뭐예요?", A(), V, st), null);
});

test("한 글자 이름은 맞추지 않아요(아무 글에나 걸리지 않게)", () => {
  assert.equal(boardTarget("뭐예요?", A({ lead: "벽은 이렇게 해요" }), [{ vendor_id: "x", name: "벽", trade: "dobae" }], st), null);
});

// 담기 · 빼기 단추(#220 리뷰): 업체 표시 · 강조와 따로, 서버가 받는 상태에서만 열어요
const R = (shortlisted = false) => ({ vendor_id: "d1", shortlisted });
const open = { locked: false, left: 2, live: new Set<string>() };

test("담기: 칸이 남으면 열고, 서버 남은 칸이 0이면 막아요", () => {
  assert.deepEqual(pickRule(R(), open), { add: true, remove: false });
  assert.deepEqual(pickRule(R(), { ...open, left: 0 }), { add: false, remove: false });
  assert.deepEqual(pickRule(R(true), open), { add: false, remove: true });
});

test("도배 업체를 확정하면 다른 업체 담기 · 빼기를 막아요", () => {
  const locked = { ...open, locked: true, left: 2 };
  assert.deepEqual(pickRule(R(), locked), { add: false, remove: false });
  assert.deepEqual(pickRule(R(true), locked), { add: false, remove: false });
});

test("실측을 요청한 업체는 담기 · 빼기를 막아요(요청 취소부터)", () => {
  const live = { ...open, live: new Set(["d1"]) };
  assert.deepEqual(pickRule(R(true), live), { add: false, remove: false });
  assert.deepEqual(pickRule(R(false), live), { add: false, remove: false });
});

test("실측 요청 안내: 실제로 보낸 업체만(일부 실패면 실패한 업체는 빼요)", () => {
  const picked = [{ vendor_id: "d1", text: "마루와벽 12.1(월) 오전" }, { vendor_id: "d2", text: "정담도배 12.2(화) 오후" }];
  assert.equal(requestSaid(picked, [{ vendor_id: "d1" }, { vendor_id: "d2" }]), "실측을 요청했어요 · 마루와벽 12.1(월) 오전 · 정담도배 12.2(화) 오후");
  assert.equal(requestSaid(picked, [{ vendor_id: "d2" }]), "실측을 요청했어요 · 정담도배 12.2(화) 오후");
  assert.equal(requestSaid(picked, []), null);
  assert.equal(requestSaid(picked, [{ vendor_id: null }]), null);
});
