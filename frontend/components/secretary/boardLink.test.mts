// 재재 대화 → 보드 연동 시험(#197): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { boardTarget, type BoardAnswer } from "./boardLink.ts";

const A = (over: Partial<BoardAnswer> = {}): BoardAnswer => ({ notice: "", sections: [], cards: [], ...over });
const V = [
  { vendor_id: "d1", name: "마루와벽", trade: "dobae" as const, quoted: true },
  { vendor_id: "d2", name: "결 도배", trade: "dobae" as const },
  { vendor_id: "m1", name: "나무손", trade: "mokgong" as const },
  // 도배 · 목공을 둘 다 하는 업체(도배 견적서는 안 보냄)
  { vendor_id: "b1", name: "솜씨공방", trade: "dobae" as const },
  { vendor_id: "b1", name: "솜씨공방", trade: "mokgong" as const },
];
const st = { quoted: false, deal: false };

test("답 글 · 표에 나온 업체를 강조하고 업체 칸으로", () => {
  const a = A({ sections: [{ title: "", sentences: ["마루와벽은 후기가 많아요."], caution: "", tip: "" }], cards: [{ title: "비교", text: "", table: { cols: ["업체"], rows: [{ cells: ["결도배"] }] } }] });
  assert.deepEqual(boardTarget("어디가 나아요?", a, V, st), { tab: 2, hi: ["d1", "d2"], trade: "dobae" }); // 띄어쓰기는 달라도 같은 이름
});

test("목공 업체만 나오면 목공 탭", () => {
  const a = A({ cards: [{ title: "", text: "", draft: { vendors: ["나무손"] } }] });
  assert.deepEqual(boardTarget("초안", a, V, st)?.trade, "mokgong");
});

test("견적서가 왔으면 업체 이름은 비교 칸으로", () => {
  const a = A({ lead: "마루와벽 견적서가 표준견적서보다 높아요" });
  assert.equal(boardTarget("왜 비싸요?", a, V, { quoted: true, deal: false })?.tab, 4);
});

test("물은 말에 업체 이름이 있으면 답에 없어도 강조(견적서가 왔으면 비교 칸)", () => {
  assert.deepEqual(boardTarget("결도배 견적서 어때요?", A({ notice: "도배 부자재 줄은 합계에 들어가요." }), V, { quoted: true, deal: false }), { tab: 4, hi: ["d2"], trade: "dobae" });
});

test("도배 견적서가 와도 목공 업체를 물으면 업체 칸 목공 탭", () => {
  const quoted = { quoted: true, deal: false };
  assert.deepEqual(boardTarget("나무손은 어때요?", A(), V, quoted), { tab: 2, hi: ["m1"], trade: "mokgong" });
  // 답이 도배 업체를 같이 말해도 물은 목공 업체로
  assert.deepEqual(boardTarget("나무손 가견적 봐 줘", A({ lead: "마루와벽 견적서도 왔어요" }), V, quoted), { tab: 2, hi: ["m1"], trade: "mokgong" });
});

test("도배 · 목공을 둘 다 하는 업체: 도배 견적서가 왔으면 목공 탭, 아니면 도배", () => {
  assert.deepEqual(boardTarget("솜씨공방은 어때요?", A(), V, { quoted: true, deal: false }), { tab: 2, hi: ["b1"], trade: "mokgong" });
  assert.deepEqual(boardTarget("솜씨공방은 어때요?", A(), V, st), { tab: 2, hi: ["b1"], trade: "dobae" });
  assert.deepEqual(boardTarget("솜씨공방 목공 가견적은요?", A(), V, st), { tab: 2, hi: ["b1"], trade: "mokgong" });
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
