// 예시 데이터 켜기(개발에서만, API 없이 9판 값으로 화면을 볼 때). 실제 API가 기본이고 예시는 덧칠이에요.
// - 켜는 법: 개발 서버를 NEXT_PUBLIC_MJ_MOCK=1로 띄워요(B2b · B3와 같은 이름). next build(운영)에서는 NODE_ENV가 production이라 늘 꺼져요.
// - 켜져도 예시 공사 id(MOCK_PROJECT)로 들어온 화면만 예시를 써요. 다른 공사 · 로그인은 실제 API 그대로예요.
// - lib/api/<영역>.ts 안에서만 예시 ↔ 실제를 바꿔요. 화면 코드는 이 값을 직접 보지 않아요(브라우저 조각은 mock prop으로 받아요).
export const MOCK_V3A = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_MJ_MOCK === "1";

/** 예시 공사(9판 상계동 · 강북구 · 하계동 부분 · 확정 공정표). 모두 UUID 꼴이라 화면의 id 검사를 그대로 지나요 */
export const MOCK_PROJECT = {
  full: "a3a00000-0000-4000-8000-000000000001",
  zero: "a3a00000-0000-4000-8000-000000000002",
  part: "a3a00000-0000-4000-8000-000000000003",
  final: "a3a00000-0000-4000-8000-000000000004",
} as const;
export type MockKey = keyof typeof MOCK_PROJECT;

/** 예시 업체 */
export const MOCK_VENDOR = {
  gyeol: "a3a10000-0000-4000-8000-000000000001",
  maru: "a3a10000-0000-4000-8000-000000000002",
  hangyeol: "a3a10000-0000-4000-8000-000000000003",
} as const;

/** 예시가 켜져 있고 예시 공사 id면 그 이름(full · zero · part · final) */
export function mockKeyOf(projectId: string): MockKey | null {
  if (!MOCK_V3A) return null;
  const hit = (Object.keys(MOCK_PROJECT) as MockKey[]).find((k) => MOCK_PROJECT[k] === projectId);
  return hit ?? null;
}
