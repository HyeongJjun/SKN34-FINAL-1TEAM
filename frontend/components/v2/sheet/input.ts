// 표준견적서 쉽게 보기 페이지(/v2/standard)로 넘기는 견적 입력. 상담 화면이 고른 값을 이 탭에만 잠깐 둔다.
import type { QuoteIn } from "../doc/api";

const KEY = "mj-v2-sheet-in";

export function saveSheetInput(body: QuoteIn) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(body));
  } catch {}
}

export function readSheetInput(): QuoteIn | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? (JSON.parse(v) as QuoteIn) : null;
  } catch {
    return null;
  }
}
