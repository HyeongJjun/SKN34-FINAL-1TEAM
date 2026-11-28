// 재재 대화 → 보드 연동 시험(#197): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { autoDone, boardStateFor, myVendorRows, boardTarget, clampTarget, stdSource, tradeQuery, withTrade, isWaiting, pickRule, pickStateOf, requestSaid, tabVendors, threadOf, type BoardAnswer } from "./boardLink.ts";

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

test("담기 상태: 공정별로 확정 · 진행 중 실측 · 남은 칸을 봐요(보드 · 업체 창 · 전체 상세 화면 같이)", () => {
  const visits = [
    { trade: "mokgong", status: "requested", vendor_id: "m1" },
    { trade: "mokgong", status: "declined", vendor_id: "m2" },
    { trade: "dobae", status: "chosen", vendor_id: "d1" },
  ];
  const mok = pickStateOf("mokgong", [], visits, 1);
  assert.equal(mok.locked, false);
  assert.deepEqual([...mok.live], ["m1"]); // 거절된 실측 업체는 다시 담기 · 빼기 가능
  assert.deepEqual(pickRule({ vendor_id: "m1", shortlisted: true }, mok), { add: false, remove: false });
  assert.deepEqual(pickRule({ vendor_id: "m2", shortlisted: true }, mok), { add: false, remove: true });
  assert.deepEqual(pickRule({ vendor_id: "m3", shortlisted: false }, pickStateOf("mokgong", [], visits, 0)), { add: false, remove: false });
  assert.equal(pickStateOf("dobae", [], visits, 2).locked, true); // 실측에서 고른 공정
  assert.equal(pickStateOf("mokgong", ["mokgong"], [], 2).locked, true); // 공사 일정에 계약
});

test("업체 채팅 창: 상호명이 아니라 실측 · 채팅 ID로 대화를 골라요(이름이 같은 다른 업체 대화를 열지 않아요)", () => {
  const heads = [
    { thread_id: "t1", project_id: "p1", visit_id: "v1", title: "정담도배" },
    { thread_id: "t2", project_id: "p1", visit_id: "v2", title: "정담도배 상계점" },
    { thread_id: "t3", project_id: "p2", visit_id: "v9", title: "정담도배" },
  ];
  assert.equal(threadOf(heads, "p1", { visitId: "v2", threadId: null })?.thread_id, "t2");
  assert.equal(threadOf(heads, "p1", { visitId: null, threadId: "t1" })?.thread_id, "t1");
  assert.equal(threadOf(heads, "p1", { visitId: "v9", threadId: null }), null); // 다른 공사 실측
  assert.equal(threadOf(heads, "p1", { visitId: null, threadId: "t3" }), null); // 다른 공사 대화
  assert.equal(threadOf(heads, "p1", { visitId: null, threadId: null }), null);
});

// 공정 탭(#234 리뷰): 보드 업체 칸은 늘 고른 탭 공정이에요
test("공정이 둘이면 재재 답 업체도 고른 탭 공정 업체만 맞춰 봐요", () => {
  const mok = tabVendors(V, true, "mokgong");
  assert.deepEqual(mok.map((v) => v.vendor_id), ["m1", "b1"]);
  assert.ok(mok.every((v) => v.trade === "mokgong"));
  // 목공 탭에서 도배 업체 이름을 물어도 보드를 도배로 바꾸지 않아요
  assert.equal(boardTarget("마루와벽 어때요?", A(), mok, st), null);
  // 둘 다 하는 업체는 그 탭 공정으로
  assert.equal(boardTarget("솜씨공방 도배는요?", A(), mok, st)?.trade, "mokgong");
  // 공정이 하나면 그대로
  assert.equal(tabVendors(V, false, "dobae").length, V.length);
});

// 기다림 카드(#234 리뷰): 다른 공정의 견적서 · 확정으로 사라지지 않아요
test("기다림 카드는 그 공정의 확정 · 견적서 · 고를 날만 봐요", () => {
  const req = [{ status: "requested" }];
  assert.equal(isWaiting(req, { deal: false, quoted: 0, toPick: 0 }), true);
  assert.equal(isWaiting(req, { deal: true, quoted: 0, toPick: 0 }), false);
  assert.equal(isWaiting(req, { deal: false, quoted: 1, toPick: 0 }), false);
  assert.equal(isWaiting(req, { deal: false, quoted: 0, toPick: 1 }), false);
  assert.equal(isWaiting([{ status: "offered" }], { deal: false, quoted: 0, toPick: 0 }), false);
  assert.equal(isWaiting([], { deal: false, quoted: 0, toPick: 0 }), false);
});

test("보드 이동은 고른 공정 탭 상태로(#234 리뷰): 목공 탭은 도배 견적서 · 확정을 보지 않고 실측 칸까지만", () => {
  const dobae = { quoted: true, deal: true, chosen: true };
  const mok = { deal: false, chosen: false };
  const mokSt = boardStateFor(true, dobae, mok);
  // 도배가 견적서를 받고 확정했어도 목공 탭 질문은 목공 기준
  assert.equal(clampTarget(boardTarget("업체 추천해 줘", A(), [], mokSt), mokSt.maxTab)?.tab, 2);
  assert.equal(clampTarget(boardTarget("실측 날짜는 언제 잡아요?", A(), [], mokSt), mokSt.maxTab)?.tab, 3);
  // 목공을 확정했어도 목공 보드는 실측 칸(3)까지
  const mokDeal = boardStateFor(true, dobae, { deal: true, chosen: true });
  assert.equal(clampTarget(boardTarget("공사 일정 알려 줘", A(), [], mokDeal), mokDeal.maxTab)?.tab, 3);
  // 도배 탭은 그대로 도배 기준(견적서 받으면 비교 칸, 확정이면 공정표)
  const dob = boardStateFor(false, { quoted: true, deal: false, chosen: true }, mok);
  assert.equal(clampTarget(boardTarget("업체 추천해 줘", A(), [], dob), dob.maxTab)?.tab, 4);
  const dobDeal = boardStateFor(false, dobae, mok);
  assert.equal(clampTarget(boardTarget("공사 일정 알려 줘", A(), [], dobDeal), dobDeal.maxTab)?.tab, 5);
  assert.equal(clampTarget(null, 3), null);
});

test("공정이 주소에서 재재 화면까지 이어져요(#234 리뷰: 목공 할 일 링크가 도배 보드로 가지 않게)", () => {
  assert.equal(tradeQuery("mokgong"), "&trade=mokgong");
  assert.equal(tradeQuery(["dobae", "mokgong"]), "&trade=dobae");
  assert.equal(tradeQuery("floor"), "&trade=floor"); // 새 공정(바닥)도 목록을 고치지 않고 넘겨요
  for (const bad of ["", "Dobae", "a&b=1", "../x", "dobae mokgong"]) assert.equal(tradeQuery(bad), ""); // 공정 키 모양이 아니면 버려요
  assert.equal(tradeQuery(undefined), "");
  assert.equal(withTrade("/projects/p1/visits/v1", "mokgong"), "/projects/p1/visits/v1?trade=mokgong");
  assert.equal(withTrade("/projects/p1/vendors?trade=mokgong", "dobae"), "/projects/p1/vendors?trade=mokgong"); // 서버가 붙인 공정은 그대로
  assert.equal(withTrade("/projects/p1/schedule?view=dates", "mokgong"), "/projects/p1/schedule?view=dates&trade=mokgong");
  assert.equal(withTrade("/projects/p1/plan", null), "/projects/p1/plan");
});

test("표준견적서 금액 출처(#234 리뷰): 공정별 금액 · 전체 금액이 늘 같은 기준", () => {
  const pub = { total: 1_200_000, sum: { total: 2_000_000 }, parts: [{ trade: "mokgong", total: 800_000 }] }; // 공공 기준: 도배 본문 + 목공 줄
  const mq = { total: 6_754_000 }; // 전체 시장 단가
  const pq = { total: 6_633_000, parts: [{ trade: "dobae", quote: { total: 4_928_000 } }, { trade: "mokgong", quote: { total: 1_705_000 } }] }; // 공정별 시장 단가
  // 공정 둘 · 공정별 시장 단가 다 옴 → 시장 단가(전체 시장 단가가 실패해도 같음)
  for (const market of [mq, null]) {
    const x = stdSource({ view: pub, market, parts: pq });
    assert.deepEqual([x.src, x.total, x.per], ["parts", 6_633_000, { dobae: 4_928_000, mokgong: 1_705_000 }]);
  }
  // 공정 둘 · 공정별 시장 단가 실패(전체 시장 단가만 옴) → 공정별 · 전체 모두 공공 기준(섞지 않아요)
  const y = stdSource({ view: pub, market: mq, parts: null });
  assert.deepEqual([y.src, y.total, y.per], ["public", 2_000_000, { dobae: 1_200_000, mokgong: 800_000 }]);
  // 공정별 시장 단가가 한 공정만 옴 → 공공 기준
  const z = stdSource({ view: pub, market: mq, parts: { total: 4_928_000, parts: [pq.parts[0]] } });
  assert.equal(z.src, "public");
  assert.equal(z.total, 2_000_000);
  // 부분 도배 + 목공(시장 단가 없음) → 공공 기준 공정별
  assert.deepEqual(stdSource({ view: pub, market: null, parts: null }).per, { dobae: 1_200_000, mokgong: 800_000 });
  // 공정 하나: 시장 단가가 있으면 그 값, 없으면 공공 기준. 공정별 금액은 없어요
  assert.deepEqual(stdSource({ view: { total: 1_000_000 }, market: { total: 1_100_000 } }), { src: "market", total: 1_100_000, per: null });
  assert.deepEqual(stdSource({ view: { total: 1_000_000 }, market: null }), { src: "public", total: 1_000_000, per: null });
  // 각 공정 금액의 합 = 전체 금액(공공 기준)
  const per = stdSource({ view: pub, market: null }).per!;
  assert.equal(per.dobae + per.mokgong, 2_000_000);
});

test("재재가 챙긴 일(#234 리뷰): 고른 공정 상태로만, 그 공정 보드에 없는 칸은 비워요", () => {
  // 목공 탭: 도배 실측 · 견적서 · 확정이 있어도 목공 실측을 안 했으면 업체 칸에 완료 없음
  const mok = autoDone({ asked: false, quoted: false, deal: false, maxTab: 3 });
  assert.deepEqual(mok[2], []);
  assert.equal(mok[4], undefined);
  assert.equal(mok[5], undefined);
  // 목공을 확정해도 목공 보드는 실측 칸까지라 공정표 칸 완료는 없어요
  assert.equal(autoDone({ asked: true, quoted: false, deal: true, maxTab: 3 })[5], undefined);
  assert.deepEqual(autoDone({ asked: true, quoted: false, deal: false, maxTab: 3 })[2], ["업체에 실측 날짜 물어보기"]);
  // 도배 탭은 예전 그대로
  const dob = autoDone({ asked: true, quoted: true, deal: true, maxTab: 7 });
  assert.deepEqual([dob[2], dob[4], dob[5]], [["업체에 실측 날짜 물어보기"], ["견적서를 표준견적서와 비교"], ["확정 공정표 만들기"]]);
});

// 내 공사 목록 업체 줄(#234 리뷰): 도배 + 목공 공사에서 두 업체가 다 나오고, 링크는 그 업체 공정 탭으로
const MV = [
  { visit_id: "vm", vendor_name: "한뼘목공", trade: "mokgong" },
  { visit_id: "vd", vendor_name: "마루와벽", trade: "dobae" },
];
const B = "/projects/p1";
test("내 공사 목록: 상태판 줄이 다 오면 두 업체 · 각 공정 탭 링크", () => {
  const rows = [{ visit_id: "vd", status: "offered" }, { visit_id: "vm", status: "requested" }];
  assert.deepEqual(myVendorRows(B, MV, rows).map((x) => [x.vendor.vendor_name, x.row?.status ?? null, x.href]), [
    ["한뼘목공", "requested", "/projects/p1/visits?trade=mokgong"],
    ["마루와벽", "offered", "/projects/p1/visits/vd?trade=dobae"],
  ]);
});
test("내 공사 목록: 상태판에 한 공정만 와도 다른 공정 업체를 빼지 않아요", () => {
  const got = myVendorRows(B, MV, [{ visit_id: "vm", status: "proposed" }]);
  assert.deepEqual(got.map((x) => [x.vendor.vendor_name, x.row?.status ?? null, x.href]), [
    ["한뼘목공", "proposed", "/projects/p1/visits/vm?trade=mokgong"],
    ["마루와벽", null, "/projects/p1/visits?trade=dobae"],
  ]);
});
test("내 공사 목록: 상태판이 없으면 담은 업체 그대로 · 이 공사 밖 줄은 안 그려요", () => {
  assert.deepEqual(myVendorRows(B, MV, null).map((x) => [x.vendor.visit_id, x.row, x.href]), [
    ["vm", null, "/projects/p1/visits?trade=mokgong"],
    ["vd", null, "/projects/p1/visits?trade=dobae"],
  ]);
  assert.equal(myVendorRows(B, MV, [{ visit_id: "other", status: "booked" }]).some((x) => x.row), false);
});
