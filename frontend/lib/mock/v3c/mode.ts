// B3 예시 데이터 모드. 개발 서버에서만 켜져요(NEXT_PUBLIC_MJ_MOCK=1, B2a · B2b와 같은 이름). 운영 빌드(NODE_ENV=production)에서는 늘 꺼져요.
// - 읽기: lib/api/vendor.ts · lib/api/admin.ts가 API 대신 lib/mock/v3c 예시 데이터를 돌려줘요.
// - 쓰기: components/pro/send.ts가 API를 부르지 않고 잠깐 기다린 뒤 성공으로 돌려줘요(화면 흐름 확인용).
// 끄면(기본) 모든 읽기 · 쓰기가 실제 API예요. 화면 코드는 바꾸지 않아요.
export const MOCK = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_MJ_MOCK === "1";
