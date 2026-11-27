// 재재 입력칸 위 질문 버튼(#180). 서버 · AI를 부르지 않고 고르기만 해요(시험: chips.test.mts).
// - 고객 공사 재재: 지금 플랜 칸(2 업체 ~ 8 완료)에 맞는 시작 질문. 이미 물은 건 빼요. 금액 · 기간 숫자를 바로 묻는 질문은 넣지 않아요(계산 엔진 몫)
// - 손님 재재: 아직 빈 칸을 채우는 답 말. 누르면 재재 한 줄 읽기(readLine)를 그대로 거쳐요
import type { InfoDraft } from "@/lib/guest/info";

/** 플랜 칸 → 시작 질문. 칸 번호는 ProjectFlow stepOf와 같아요.
 *  지금 AI 칸(무료 모드)이 자료로 답하고, 답이 질문과 맞는 것만 골랐어요(2026-11-24 시드 고객 단계별 전수 확인).
 *  "업체 고르기 · 살면서 도배 · 실크와 합지 차이"처럼 '확인하지 못했어요'로 답한 질문은 넣지 않아요 */
const STARTERS: Record<number, string[]> = {
  2: ["표준견적서는 뭐예요?", "가견적은 뭐예요?", "초배는 뭐예요?"],
  3: ["초배는 뭐예요?", "몰딩은 뭐예요?", "도배 뒤 장판은 언제 깔아요?"],
  4: ["표준견적서와 업체 견적서는 왜 달라요?", "견적서에서 철거는 왜 따로 붙어요?", "초배는 뭐예요?"],
  5: ["도배 뒤 장판은 언제 깔아요?", "걸레받이는 언제 달아요?", "벽지가 들뜨면 어떻게 해요?"],
  6: ["벽지가 들뜨면 어떻게 해요?", "이음매가 벌어지면 하자예요?", "걸레받이는 언제 달아요?"],
  7: ["이음매가 벌어지면 하자예요?", "벽지가 들뜨면 어떻게 해요?", "하자담보책임기간은 뭐예요?"],
  8: ["하자담보책임기간은 뭐예요?", "벽지가 들뜨면 어떻게 해요?", "이음매가 벌어지면 하자예요?"],
};

/** 목공 탭 시작 질문(공정 탭, 2026-11-27). 도배 목록에서 AI 칸이 자료로 답한다고 확인된 질문 중 목공 · 공통 것만 골랐어요 */
const MOK_STARTERS: Record<number, string[]> = {
  2: ["몰딩은 뭐예요?", "표준견적서는 뭐예요?", "가견적은 뭐예요?"],
  3: ["몰딩은 뭐예요?", "걸레받이는 언제 달아요?", "가견적은 뭐예요?"],
  4: ["표준견적서와 업체 견적서는 왜 달라요?", "몰딩은 뭐예요?", "걸레받이는 언제 달아요?"],
  5: ["걸레받이는 언제 달아요?", "몰딩은 뭐예요?", "하자담보책임기간은 뭐예요?"],
  6: ["걸레받이는 언제 달아요?", "하자담보책임기간은 뭐예요?", "몰딩은 뭐예요?"],
  7: ["하자담보책임기간은 뭐예요?", "걸레받이는 언제 달아요?", "몰딩은 뭐예요?"],
  8: ["하자담보책임기간은 뭐예요?", "걸레받이는 언제 달아요?", "몰딩은 뭐예요?"],
};

/** 고객 공사 재재 질문 버튼: 지금 칸의 시작 질문 중 아직 안 물은 것(최대 3개). trade가 목공이면 목공 질문 */
export function starterChips(step: number, asked: readonly string[], trade: string = "dobae"): string[] {
  const done = new Set(asked.map((q) => q.trim()));
  const list = trade === "mokgong" ? MOK_STARTERS : STARTERS;
  return (list[Math.min(Math.max(step, 2), 8)] ?? []).filter((q) => !done.has(q)).slice(0, 3);
}

/** 고객 공사 재재 질문 버튼: 마지막으로 받은 답의 추천 질문(suggest)이 있으면 그것, 없으면 지금 칸의 시작 질문.
 *  물은 질문은 빼고 3개까지 */
export function quickChips(step: number, asked: readonly string[], lastSuggest: readonly string[] | null, trade: string = "dobae"): string[] {
  const done = new Set(asked.map((q) => q.trim()));
  const next = (lastSuggest ?? []).filter((q) => !done.has(q.trim())).slice(0, 3);
  return next.length ? next : starterChips(step, asked, trade);
}

/** 손님 재재 답 버튼: 아직 빈 칸만. 지역 · 면적은 단추가 말풍선에 있어서 넣지 않아요 */
export function guestChips(d: Pick<InfoDraft, "scope" | "occupied" | "grade">): string[] {
  const out: string[] = [];
  if (d.occupied == null) out.push("지금 살고 있어요", "빈 집이에요");
  if (!d.grade) out.push("실크로 할래요", "합지로 할래요");
  if (d.scope !== "partial") out.push("부분 도배만 할래요");
  return out.slice(0, 4);
}
