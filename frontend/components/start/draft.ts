// 옛 '쓰던 요청서' 입구(호환). v3에서 로그인 전 답은 lib/guest/store.ts(mj_guest_v3) 한 곳에 있고, 여기 함수는 그 위에서 돌아요.
// 쓰는 곳: 탈퇴 · 계정(writeDraft(null)로 이 기기의 답 지우기) · 휴대폰 번호 화면(readDraft로 '쓰던 답이 있나'만 봐요).
// 사진은 v3 기본 정보에 없어요(9판 C02). PHOTO_MEMO는 옛 화면이 부르는 이름만 남긴 빈 칸이에요.
import { clearGuest, GUEST_EVENT, readGuest } from "@/lib/guest/store";
import { regionLabel } from "@/lib/mock/regions";

export const DRAFT_EVENT = GUEST_EVENT;

export const PHOTO_MEMO: { bySpace: Record<string, unknown[]>; plan: unknown[]; uploaded: Record<string, string> } = { bySpace: {}, plan: [], uploaded: {} };
export function clearPhotoMemo() {
  PHOTO_MEMO.bySpace = {};
  PHOTO_MEMO.plan = [];
  PHOTO_MEMO.uploaded = {};
}

export type DraftLite = { sido?: string; sgg?: string; size?: string; manualBasis?: string; manualM2?: string; trades?: { dobae: boolean; mokgong: boolean } };

/** 이 기기에 남은 로그인 전 답(없거나 30일이 지났으면 null) */
export function readDraft(): { a: DraftLite; step: string; go?: boolean } | null {
  const g = readGuest();
  if (!g) return null;
  const i = g.info;
  return {
    a: { sido: i.sido || undefined, sgg: i.sgg || undefined, size: i.area_m2 ? "manual" : undefined, manualBasis: i.area_basis === "exclusive" ? "jeon" : "supply", manualM2: i.area_m2 || undefined, trades: { dobae: true, mokgong: false } },
    step: "info",
  };
}

/** null이면 이 기기의 답을 지워요(탈퇴 · 로그아웃). 답을 쓰는 일은 기본 정보 화면(/start)만 해요 */
export function writeDraft(value: unknown | null) {
  if (value === null) clearGuest();
}

/** 카드에 보일 줄: 공사 · 지역 · 면적 */
export function draftLine(a: DraftLite): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const trades = [a.trades?.dobae && "도배", a.trades?.mokgong && "목공"].filter(Boolean).join(" · ");
  if (trades) rows.push({ label: "공사", value: trades });
  if (a.sido) rows.push({ label: "지역", value: regionLabel(a.sido, a.sgg) });
  if (a.size === "manual" && a.manualM2) rows.push({ label: "면적", value: `${a.manualBasis === "jeon" ? "전용" : "공급"} ${a.manualM2}㎡` });
  return rows;
}
