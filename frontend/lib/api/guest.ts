// 서버 쪽 읽기: 손님(로그인 없음). 홈 '표준견적서 · 견본'(C01 · C40 · D10)은 견본 입력을 서버 계산 엔진에 한 번 물어 1시간 둬요(routes.md C01).
// 손님 계산은 쿠키를 보지 않는 길이라 로그인 쿠키를 넘기지 않아요(security-02). 값을 못 받으면 견본 칸을 숨겨요(지어낸 숫자를 보이지 않게).
import type { Schemas } from "@/lib/backend/server";
import { MOCK_V3A } from "@/lib/mock/v3a/mode";
import { SAMPLE_INFO, SAMPLE_STANDARD } from "@/lib/mock/v3a/standard";

export type GuestStandard = Schemas["GuestStandardOut"];
export const SAMPLE = SAMPLE_INFO;

const BASE = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

/** 견본 표준견적서(상계동 공급 69.4㎡ · 실크 · 빈 집). 계산 엔진 값이 없으면 null */
export async function getSampleStandard(): Promise<GuestStandard | null> {
  if (MOCK_V3A) return SAMPLE_STANDARD;
  try {
    const res = await fetch(`${BASE}/guest/standard`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(SAMPLE_INFO),
      next: { revalidate: 3600 },
    });
    return res.ok ? ((await res.json()) as GuestStandard) : null;
  } catch {
    return null;
  }
}
