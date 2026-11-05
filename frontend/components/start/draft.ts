// 작성 중인 견적 받기 폼(브라우저 저장). 견적 받기 화면, 내 프로젝트의 '쓰던 요청서' 카드, 가입 · 로그인 옆 칸이 같이 쓴다.
// 사진 파일은 여기에 넣지 않는다(브라우저 저장소에 못 넣음). 서버에는 '계산하기'를 누를 때 올린다.
// go: 로그인 전에 '가입하고 계산하기'를 눌렀다는 표시. 가입 · 로그인하고 견적 받기로 돌아오면 이어서 계산한다.
import { regionLabel } from "@/lib/mock/regions";
import type { Photo } from "./PhotoDrop";

export const DRAFT_KEY = "mj_start_draft_v4"; // v4: 긴 폼 한 장(공간 하나 · 공정 둘)
export const DRAFT_EVENT = "mj-draft-change";

// 사진 파일은 브라우저 저장소에 못 넣어서, 창을 닫았다 열어도 남도록 이 화면이 떠 있는 동안만 들고 있는다.
// uploaded: 이미 서버에 올린 사진의 파일 id (만들기를 다시 눌러도 두 번 올리지 않게)
export const PHOTO_MEMO: { bySpace: Record<string, Photo[]>; plan: Photo[]; uploaded: Record<string, string> } = { bySpace: {}, plan: [], uploaded: {} };
export function clearPhotoMemo() {
  PHOTO_MEMO.bySpace = {};
  PHOTO_MEMO.plan = [];
  PHOTO_MEMO.uploaded = {};
}

export type DraftLite = { sido?: string; sgg?: string; size?: string; manualBasis?: string; manualM2?: string; trades?: { dobae: boolean; mokgong: boolean } };

export function readDraft(): { a: DraftLite; step: string; go?: boolean } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d?.a && typeof d.a === "object" ? d : null;
  } catch { return null; }
}
export function writeDraft(value: unknown | null) {
  try {
    if (value) localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* 저장소를 못 쓰면 무시 */ }
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

// 카드에 보일 한 줄: 공사 · 지역 · 평수
export function draftLine(a: DraftLite): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const trades = [a.trades?.dobae && "도배", a.trades?.mokgong && "목공"].filter(Boolean).join(" · ");
  if (trades) rows.push({ label: "공사", value: trades });
  if (a.sido) rows.push({ label: "지역", value: regionLabel(a.sido, a.sgg) });
  if (a.size && (a.size !== "manual" || a.manualM2)) rows.push({ label: "평수", value: a.size === "manual" ? `${a.manualBasis === "jeon" ? "전용" : "공급"} ${a.manualM2}㎡` : a.size === "50" ? "50평 이상" : `${a.size}평대` });
  return rows;
}
