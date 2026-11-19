// 관리자 화면 말(B3). 신고 이유 코드는 backend/app/report/models.py CHAT_REASONS · LINK_REASONS와 같아요(9판 C31 · A02 글).
import type { BadgeTone } from "@/components/ui/Badge";

export const REPORT_KIND: Record<string, string> = { chat: "채팅", vendor: "업체", link: "링크" };
export const REPORT_REASON: Record<string, string> = {
  offsite: "믿집 밖 거래를 권해요",
  abuse: "막말 · 불쾌한 말",
  promise: "약속을 안 지켜요",
  wrong_place: "엉뚱한 곳으로 가요",
  not_vendor: "이 업체 리뷰가 아니에요",
  other: "그 밖",
};
export const RESOLVE_LABEL: Record<string, string> = {
  warn: "경고 보내기",
  mute_chat: "채팅 쓰기 막기",
  suspend_new: "업체 기능 멈추기 · 새 요청만",
  suspend_all: "업체 기능 멈추기 · 진행 중인 건도",
  hide_link: "링크 숨기기",
  none: "문제없음으로 닫기",
};
export const VENDOR_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  pending: { tone: "wait", label: "심사 기다림" },
  needs_info: { tone: "mute", label: "보완 요청" },
  approved: { tone: "ok", label: "승인" },
  rejected: { tone: "bad", label: "거절" },
};
export const vendorBadge = (s: string) => VENDOR_BADGE[s] ?? { tone: "mute" as const, label: "확인 중" };
/** 지역 줄: '노원구 · 도봉구 외 2곳' */
export function areasText(areas: { sgg: string }[], show = 2): string {
  if (!areas.length) return "—";
  const head = areas.slice(0, show).map((a) => a.sgg).join(" · ");
  return areas.length > show ? `${head} 외 ${areas.length - show}곳` : head;
}
