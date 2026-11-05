// 업체 고르기 · 실측 화면 아이콘 (모두 글자와 함께 쓴다. 아이콘만으로 뜻을 알리지 않는다)
import { VISIT_LABEL, VISIT_TONE } from "./text";

type P = { size?: number };

export const Check = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>
);
export const Plus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
);
export const Picked = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
);
export const Close = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
);
export const Lock = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="6" width="9" height="6.5" rx="1" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" /></svg>
);
export const Copy = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1" /><path d="M9.5 4.5V2.5a.5.5 0 0 0-.5-.5H2.5a.5.5 0 0 0-.5.5V9a.5.5 0 0 0 .5.5h2" /></svg>
);
export const Chev = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 3l4 4-4 4" /></svg>
);
export const Warn = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 2.8L18.2 17H1.8z" strokeLinejoin="round" /><path d="M10 8v4" strokeLinecap="round" /><path d="M10 14.6v.2" strokeLinecap="round" /></svg>
);
export const Pen = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l.8-2.8L9.5 2.5l2 2-5.7 5.7z" /></svg>
);
export const Dash = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><path d="M4.5 7h5" /></svg>
);
export const Photo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="21" height="17" rx="1.5" /><circle cx="10" cy="11" r="2" /><path d="M4 20l6-5 4 3 4-4 6 5" /></svg>
);

/** 연락 방식 버튼 아이콘 */
export function WayIcon({ method }: { method: string }) {
  if (method === "phone") return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M3.6 2.2h2.4l1.1 2.9-1.5 1a7.6 7.6 0 0 0 3.6 3.6l1-1.5 2.9 1.1v2.4a1.1 1.1 0 0 1-1.2 1.1A11 11 0 0 1 2.5 3.4a1.1 1.1 0 0 1 1.1-1.2z" /></svg>;
  if (method === "sms") return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="9" rx="1.5" /><path d="M2.5 4l5.5 4.5L13.5 4" /></svg>;
  if (method === "kakao") return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.5c3.3 0 6 2.1 6 4.7s-2.7 4.7-6 4.7c-.6 0-1.2-.1-1.8-.2L3.5 13.5l.7-2.6C2.8 10 2 8.7 2 7.2 2 4.6 4.7 2.5 8 2.5z" /></svg>;
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c1.8 1.7 2.6 3.7 2.6 6S9.8 12.3 8 14C6.2 12.3 5.4 10.3 5.4 8S6.2 3.7 8 2z" /></svg>;
}

/** 실측 요청 상태: 모양 + 글자 + 색. past면 '지난 실측 닫힘' (shutKind) */
export function VisitState({ status, past }: { status: string; past?: boolean }) {
  const tone = VISIT_TONE[status] ?? "off";
  const icon = tone === "now"
    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="7" cy="7" r="2.4" fill="currentColor" /></svg>
    : tone === "ok" ? <Check />
    : tone === "bad" ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
    : null;
  return <span className={`mj-st mj-st-${tone}`}>{icon}{past ? "지난 실측 닫힘" : VISIT_LABEL[status] ?? "확인 중"}</span>;
}
