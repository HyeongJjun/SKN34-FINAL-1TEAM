// 로그아웃: 서버 세션을 지우고 쿠키도 API가 지운다. 연결이 안 돼도 화면은 넘긴다.
// 이 기기에 둔 손님 답(로그인 전 기본 정보, B2a lib/guest/store.ts)도 같이 지운다(security-02 #6: 같은 기기의 다음 사람이 보지 않게).
import { call } from "@/lib/backend/client";
import { clearGuest } from "@/lib/guest/store";

type Router = { push: (href: string) => void; refresh: () => void };

export async function logout(router: Router, to = "/") {
  await call("POST", "/auth/logout").catch(() => undefined);
  clearGuest();
  router.push(to);
  router.refresh();
}
