// 로그아웃: 서버 세션을 지우고 쿠키도 API가 지운다. 연결이 안 돼도 화면은 넘긴다.
import { call } from "@/lib/backend/client";

type Router = { push: (href: string) => void; refresh: () => void };

export async function logout(router: Router, to = "/") {
  await call("POST", "/auth/logout").catch(() => undefined);
  router.push(to);
  router.refresh();
}
