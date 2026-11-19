// 옆 AI 칸(N2 A). B2b 화면(실측 일정 · 요청서 · 날짜 고르기 · 실측 견적서)은 모두 이 한 곳으로 AI 칸을 넣어요.
// 내용은 B5 AiPanel이에요: 대화 · 믿집 계산 상자 · AI 초안 카드(D08 · D03). props는 POST /ai/turns의 context 모양
// (screen · project_id · ids, api.md 16장). ids는 보던 실측 id라 날짜 고르기 화면에서 업체 기간 · 추천 반나절을 읽어요.
import { AiPanel } from "@/components/ai/AiPanel";
import type { AiScreen as Screen } from "@/lib/api/chat";

export type AiScreen = Extract<Screen, "visits" | "visit_request" | "pick" | "quotes" | "plan">;

export function AiSlot({ screen, projectId, ids }: { screen: AiScreen; projectId: string; ids?: string[] }) {
  return <AiPanel screen={screen} projectId={projectId} ids={ids} />;
}
