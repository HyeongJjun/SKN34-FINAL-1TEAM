// 시연 계정. 시연 데이터는 backend app/demo.py가 만든다.
import type { Session } from "./types";

export const DEMO_EMAIL = "demo@mitjip.test";

/** 시연 고객으로 로그인했는지 (예시 값 채우기 같은 시연 도구를 보일 때) */
export const isDemo = (s: Session | null) => s?.role === "customer" && s.email === DEMO_EMAIL;
