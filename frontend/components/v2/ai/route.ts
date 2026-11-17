// 답 글 표시 도우미 (v10 cleanMarks). 입구 관문은 서버(팀 의도 분류)가 한다.

/* [K12] 같은 근거 표시는 글에서 숨긴다 (근거는 아래 '근거 n개'에 그대로) */
export function cleanMarks(t: string) {
  return String(t || "").replace(/\s*\[K\d{1,5}\](?:\s*\[K\d{1,5}\])*/g, "").replace(/[ \t]+\n/g, "\n");
}
