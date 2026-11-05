// 한 공사 화면 아이콘 (모두 글자와 함께 쓴다. 아이콘만으로 뜻을 알리지 않는다)
import type { Tone } from "./text";

/** 상태 모양: 끝남 체크 · 지금 점 · 기다림 시계 · 기한 지남 경고 · 아직 빈 원 */
export function StateIcon({ tone, size = 14 }: { tone: Tone; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 14 14", fill: "none", "aria-hidden": true } as const;
  if (tone === "ok") return <svg {...p} stroke="currentColor" strokeWidth="2"><path d="M2.5 7.5l3 3 6-7" /></svg>;
  if (tone === "now") return <svg {...p}><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="7" cy="7" r="2.6" fill="currentColor" /></svg>;
  if (tone === "wait") return <svg {...p} stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" /></svg>;
  if (tone === "bad") return <svg {...p} stroke="currentColor" strokeWidth="1.6"><path d="M7 1.8l5.8 10H1.2z" strokeLinejoin="round" /><path d="M7 5.6v2.8M7 10.1v.1" strokeLinecap="round" /></svg>;
  return <svg {...p} stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="5.5" /></svg>;
}

export function State({ tone, text, size }: { tone: Tone; text: string; size?: number }) {
  return <span className={`mj-st mj-st-${tone}`}><StateIcon tone={tone} size={size} />{text}</span>;
}

/** 아래 화살표 (펼치기) · 오른쪽 화살표 (다른 화면) */
export const Chev = ({ down }: { down?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d={down ? "M3.5 5.5L7 9l3.5-3.5" : "M5.5 3L9.5 7l-4 4"} />
  </svg>
);

export const Phone = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.6 2.2h2.4l1.1 2.9-1.5 1a7.6 7.6 0 0 0 3.6 3.6l1-1.5 2.9 1.1v2.4a1.1 1.1 0 0 1-1.2 1.1A11 11 0 0 1 2.5 3.4a1.1 1.1 0 0 1 1.1-1.2z" />
  </svg>
);
