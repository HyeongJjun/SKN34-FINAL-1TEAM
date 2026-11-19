"use client";
// 실시간 한 줄기 자리(routes.md 3장 · api.md 8장 GET /stream). 탭 하나에 줄기 하나만 열고, 머리 알림 수 · 채팅 · 실측 일정 · 작업함이 같이 들어요.
// 줄기를 여는 코드(EventSource · Last-Event-ID · 다시 잇기)는 B2b의 lib/backend/stream.ts예요. 맞춘 이름(verification/b4.md):
//   export const openStream: LiveSource  — (emit) => 닫기 함수. 이벤트마다 emit({ type, data, id })를 불러요(탭에 연결 하나).
// 줄기가 열리기 전 · 못 열면 서버가 그린 수 · 화면에서 바꾼 수로만 보여요(useLiveUnread).
// 화면 쪽(B2 · B3): 알림을 읽음 처리한 뒤 useLive().setUnread(n) · 실시간으로 다시 그릴 곳은 useLiveEvent("state", …).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { openStream } from "@/lib/backend/stream";

/** api.md 8장 이벤트(모두 JSON, 개인정보 없음) */
export type LiveEvent =
  | { type: "ready"; id?: string; data: Record<string, never> }
  | { type: "msg" | "read"; id?: string; data: { thread_id: string; seq: number } }
  | { type: "notif"; id?: string; data: { unread: number } }
  | { type: "state"; id?: string; data: { kind: "visit" | "deal" | "quote" | "extra" | "review" | "vendor_app"; project_id: string | null; id: string } }
  | { type: "resync"; id?: string; data: Record<string, never> };
export type LiveType = LiveEvent["type"];
/** 줄기를 열고 닫는 함수(B2b lib/backend/stream.ts의 openStream) */
export type LiveSource = (emit: (e: LiveEvent) => void) => () => void;

const SOURCE: LiveSource | null = openStream;

type Handler = (e: LiveEvent) => void;
type Live = {
  /** 줄기가 알려 준 안 읽은 알림 수(아직 모르면 null) */
  unread: number | null;
  setUnread: (n: number) => void;
  /** 이벤트 듣기. 돌려준 함수로 그만 들어요. "*"는 모든 이벤트 */
  subscribe: (type: LiveType | "*", fn: Handler) => () => void;
  /** 줄기 밖에서 같은 이벤트를 흘려요(예: 화면에서 읽음 처리한 뒤 수 맞추기 · 시험) */
  publish: (e: LiveEvent) => void;
  connected: boolean;
};

const Ctx = createContext<Live>({ unread: null, setUnread: () => {}, subscribe: () => () => {}, publish: () => {}, connected: false });
export const useLive = () => useContext(Ctx);

/** 머리 · 탭 바의 안 읽은 수. 마지막에 알게 된 값이 이겨요: 서버가 새로 그린 값 · 줄기의 notif · 화면의 setUnread(모두 읽음 등) */
export function useLiveUnread(initial: number): number {
  const { unread, setUnread, subscribe } = useLive();
  useEffect(() => { setUnread(initial); }, [initial, setUnread]);
  useEffect(() => subscribe("notif", () => undefined), [subscribe]); // 듣는 곳이 생겨야 줄기를 열어요
  return unread ?? initial;
}

/** 이벤트 하나를 듣는 훅(예: useLiveEvent("state", (e) => router.refresh())) */
export function useLiveEvent(type: LiveType | "*", fn: Handler) {
  const { subscribe } = useLive();
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => subscribe(type, (e) => ref.current(e)), [subscribe, type]);
}

/** source: 기본은 위 SOURCE(탭 하나에 줄기 하나). 조각 모음의 보기용 머리처럼 따로 떼어 둘 곳만 null을 넘겨요.
 *  줄기는 듣는 곳(머리 알림 · 탭 바 · useLiveEvent)이 처음 생길 때 열어요 → 손님 화면(로그인 전)은 열지 않아요 */
export function LiveProvider({ children, source = SOURCE }: { children: ReactNode; source?: LiveSource | null }) {
  const [unread, setUnread] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [wanted, setWanted] = useState(false);
  const subs = useRef(new Map<string, Set<Handler>>());

  const publish = useCallback((e: LiveEvent) => {
    if (e.type === "notif" && typeof e.data?.unread === "number") setUnread(Math.max(0, e.data.unread));
    if (e.type === "ready") setConnected(true);
    for (const key of [e.type, "*"]) subs.current.get(key)?.forEach((fn) => fn(e));
  }, []);

  const subscribe = useCallback((type: LiveType | "*", fn: Handler) => {
    const set = subs.current.get(type) ?? new Set<Handler>();
    set.add(fn);
    subs.current.set(type, set);
    setWanted(true);
    return () => { set.delete(fn); };
  }, []);

  useEffect(() => {
    if (!source || !wanted) return;
    const close = source(publish);
    return () => { close(); setConnected(false); };
  }, [source, wanted, publish]);

  const value = useMemo(() => ({ unread, setUnread, subscribe, publish, connected }), [unread, subscribe, publish, connected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
