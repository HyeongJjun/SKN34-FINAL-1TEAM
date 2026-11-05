// 가입 · 로그인 뒤 가는 곳. 서버(page)와 브라우저(폼) 양쪽에서 쓰므로 서버 전용 코드를 넣지 않는다.
import type { Role } from "@/lib/types";

// 권한별 첫 화면 (lib/session.ts HOME과 같게. session.ts는 서버 전용이라 브라우저에서 못 불러온다)
export const HOME: Record<Role, string> = { customer: "/my", admin: "/admin/members", vendor: "/vendor" };

/** 돌아갈 곳은 이 사이트 안 경로만 받는다(//, 역슬래시, 공백 · 제어 문자가 섞이면 버린다). 아니면 null */
export function safeNext(next?: string | null): string | null {
  if (!next || !/^\/(?![/\\])/.test(next) || /[\s\\]/.test(next)) return null;
  return Array.from(next).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ? null : next;
}

/** 가입 · 로그인 화면끼리 오갈 때 돌아갈 곳을 그대로 넘긴다. */
export function withNext(path: string, next?: string | null): string {
  const n = safeNext(next);
  return n ? `${path}?next=${encodeURIComponent(n)}` : path;
}
