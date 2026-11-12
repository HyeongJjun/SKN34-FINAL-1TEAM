// v2 백엔드 호출. 계산(금액 · 수량 · 날짜)과 AI는 모두 백엔드가 한다 (/api/v2/*).
import { call } from "@/lib/backend/client";

export const v2Post = <T,>(path: string, body: unknown) => call<T>("POST", `/v2/${path}`, body);
export const v2Get = <T,>(path: string) => call<T>("GET", `/v2/${path}`);
