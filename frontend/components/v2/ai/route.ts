// 답 글 표시 도우미 (v10 cleanMarks · NEXT_STEPS · nextStepOf). 입구 관문은 서버(팀 의도 분류)가 한다.

/* 반셀프 안내 표시. [K12] 같은 근거 표시는 글에서 숨기고(근거는 아래 '근거 n개'에 그대로),
   '다음에 할 일:' 줄에 화면 단계 이름이 있으면 그 단계를 여는 버튼을 붙인다 */
export const NEXT_STEPS: [string, string, string][] = [
  ["계산기", "calc", "계산기"], ["체크리스트", "check", "체크리스트"],
  ["공정표", "sched", "공정표"], ["표준견적서", "quote", "견적서"], ["견적서", "quote", "견적서"], ["집 정보", "info", "집 정보"],
  ["범위", "scope", "범위"], ["예산", "budget", "예산"], ["도면", "photo", "사진 · 도면"], ["사진", "photo", "사진 · 도면"], ["자재", "materials", "자재"],
];
export function cleanMarks(t: string) {
  return String(t || "").replace(/\s*\[K\d{1,5}\](?:\s*\[K\d{1,5}\])*/g, "").replace(/[ \t]+\n/g, "\n");
}
export function nextStepOf(t: string) {
  const line = String(t || "").split("\n").reverse().find((l) => l.trim().startsWith("다음에 할 일"));
  if (!line) return null;
  const hit = NEXT_STEPS.find(([ko]) => line.includes(ko));
  return hit ? { step: hit[1], ko: hit[2] } : null;
}
