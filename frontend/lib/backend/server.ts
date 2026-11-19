// 서버(Server Component)에서 FastAPI를 부른다. 읽기만 한다(쓰기는 브라우저가 /api로, client.ts).
// 브라우저가 보낸 로그인 쿠키만 넘겨서 그 사람 권한으로 읽는다(다른 쿠키는 API에 보내지 않는다).
import { cookies } from "next/headers";
import { isSafeApiPath } from "./client";
import type { components } from "./schema";

export type Schemas = components["schemas"];

const BASE = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const isSession = (name: string) => name.endsWith("mj_sid");

/** 로그인 쿠키(개발 mj_sid, 운영 __Host-mj_sid)가 있는지 */
export async function hasSessionCookie() {
  return (await cookies()).getAll().some((c) => isSession(c.name));
}

/** GET. 없거나(404) 권한이 없으면(401 · 403) null, 그 밖의 실패는 예외로 올린다.
 * 경로에 '..' · 인코딩한 빗금이 섞이면(주소를 꾸민 요청) 부르지 않고 없는 것으로 본다. */
export async function serverGet<T>(path: string): Promise<T | null> {
  if (!isSafeApiPath(path)) return null;
  const sid = (await cookies()).getAll().filter((c) => isSession(c.name));
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json", cookie: sid.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ") },
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${path} 응답 ${res.status}`);
  return (await res.json()) as T;
}
