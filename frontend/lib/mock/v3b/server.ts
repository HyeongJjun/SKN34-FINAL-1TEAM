// 서버(Server Component)에서 지금 예시 단계 · 예시에 쓸 진짜 공사 id를 읽어요. lib/api/<영역>.ts만 불러요.
import { cache } from "react";
import { cookies } from "next/headers";
import { serverGet } from "@/lib/backend/server";
import { getSession } from "@/lib/session";
import { MOCK_PROJECT, MOCK_V3A } from "@/lib/mock/v3a/mode";
import { DEFAULT_STEP, isStep, STEP_COOKIE, type StepKey } from "./mode";

export async function mockStep(): Promise<StepKey> {
  const v = (await cookies()).get(STEP_COOKIE)?.value;
  return isStep(v) ? v : DEFAULT_STEP;
}

/** 예시 이야기를 붙일 공사 id(최근 순). 공사 레이아웃이 진짜 공사를 확인해서 진짜 내 공사 id를 먼저 써요.
 *  진짜 공사가 없고 B2a 예시(MJ_V3A_MOCK=1)가 켜져 있으면 B2a 예시 공사(상계동 · 수유동)를 써요(레이아웃이 예시로 열어 줘요) */
export const mockProjectIds = cache(async (): Promise<string[]> => {
  const list = await serverGet<{ id: string; created_at?: string }[]>("/projects").catch(() => null);
  const ids = (list ?? []).map((p) => p.id);
  if (!ids.length && MOCK_V3A) return [MOCK_PROJECT.full, MOCK_PROJECT.zero];
  return ids;
});

/** 예시 채팅 · 알림을 볼 쪽(고객 · 업체) */
export async function mockRole(): Promise<"customer" | "vendor"> {
  const real = await getSession();
  if (real) return real.role === "vendor" ? "vendor" : "customer";
  return (await cookies()).get("mj_v3b_role")?.value === "vendor" ? "vendor" : "customer";
}
