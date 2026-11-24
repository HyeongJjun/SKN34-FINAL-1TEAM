// 재재 사진 · 문서 버튼(#181 1단계): 재재 AI는 아직 그림을 보지 않아서, 이미 사진을 받는 곳(업체와 채팅)으로 이어 줘요.
// 서버를 부르지 않고 고르기만 해요(시험: attach.test.mts).

export type AttachTarget = { label: string; href: string };
// thread_id를 꼭 받아요(없는 칸을 넘기면 타입 검사에서 걸리게: 실측 요청 목록 visits에는 없고 board 줄에 있어요)
type Thread = { vendor_name: string; thread_id: string | null };

/** 업체와 연 채팅마다 한 줄. 확정 업체 채팅이 먼저, 같은 채팅은 한 번만 */
export function attachTargets(deal: Thread | null, visits: readonly Thread[]): AttachTarget[] {
  const out: AttachTarget[] = [];
  const seen = new Set<string>();
  for (const t of [deal, ...visits]) {
    if (!t?.thread_id || seen.has(t.thread_id)) continue;
    seen.add(t.thread_id);
    out.push({ label: `${t.vendor_name} 채팅에서 사진 보내기`, href: `/chat/${encodeURIComponent(t.thread_id)}` });
  }
  return out;
}
