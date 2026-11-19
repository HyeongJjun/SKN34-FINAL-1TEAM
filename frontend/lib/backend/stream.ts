// 실시간 한 줄기(dev-02 · api.md 8장 · security-04). 탭마다 EventSource('/api/stream') 하나만 열고,
// 듣는 곳(LiveProvider의 머리 알림 수 · 채팅 · 실측 일정 · 공사 화면)에 이벤트를 나눠 줘요. 브라우저에서만 불러요.
// - 쓰기는 늘 REST POST예요. 줄기에는 id만 와요(msg · read {thread_id, seq} · notif {unread} · state {kind, project_id, id} · resync).
//   화면은 받은 id로 REST를 다시 읽어 맞춰요(원본은 DB).
// - 다시 잇기: 연결이 끊기면 브라우저가 Last-Event-ID를 붙여 스스로 다시 이어요(서버 retry: 5000) → 놓친 것은 서버가 그 뒤부터 보내요.
//   서버가 200이 아니게 답하면(401 로그인 없음 · 429 연결 5개 넘음 · 5xx) 브라우저는 멈춰요. 그때는 여기서 5 · 10 · 30 · 60초 뒤 새로 열고,
//   새 연결은 Last-Event-ID를 보낼 수 없어서 첫 ready 뒤 resync를 흘려 화면이 다시 읽게 해요.
// - 한 번도 열리지 않은 채 세 번 실패하면(로그인 안 한 손님 등) 멈추고, 탭이 다시 보이거나 인터넷이 돌아오면 다시 해 봐요.
// - 인증은 같은 주소 쿠키만 써요(주소에 토큰을 넣지 않아요). 예시 데이터(MOCK_V3B)일 때는 열지 않아요.
import { useEffect, useRef } from "react";
import type { LiveEvent, LiveSource, LiveType } from "@/components/site/LiveProvider";
import { MOCK_V3B } from "@/lib/mock/v3b/mode";

const PATH = "/api/stream";
const TYPES: LiveType[] = ["ready", "msg", "read", "notif", "state", "resync"];
const DELAYS = [5_000, 10_000, 30_000, 60_000];

type Emit = (e: LiveEvent) => void;
const emits = new Set<Emit>();
let es: EventSource | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let fails = 0;
let wasReady = false;
let needResync = false;
let watching = false;

function dispatch(e: LiveEvent) {
  // 듣는 중에 그만 듣는 곳이 생겨도 이번 이벤트는 모두에게 가게, 지금 목록을 떠 둬요
  Array.from(emits).forEach((fn) => {
    try { fn(e); } catch { /* 듣는 곳의 오류가 줄기를 멈추지 않게 해요 */ }
  });
}

function parse(raw: string): Record<string, unknown> | null {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function connect() {
  if (es || !emits.size || typeof window === "undefined" || typeof EventSource === "undefined") return;
  if (timer) { clearTimeout(timer); timer = null; }
  const src = new EventSource(PATH);
  es = src;
  for (const type of TYPES) {
    src.addEventListener(type, (ev) => {
      const m = ev as MessageEvent<string>;
      const data = parse(m.data);
      if (!data) return; // 모양이 다른 글은 버려요
      if (type === "ready") {
        fails = 0;
        wasReady = true;
      }
      dispatch({ type, id: m.lastEventId || undefined, data } as LiveEvent);
      if (type === "ready" && needResync) {
        needResync = false;
        dispatch({ type: "resync", data: {} });
      }
    });
  }
  src.onerror = () => {
    // CONNECTING이면 브라우저가 Last-Event-ID로 다시 이어요. CLOSED일 때만 여기서 새로 열어요
    if (src.readyState !== EventSource.CLOSED) return;
    if (es === src) es = null;
    fails += 1;
    if (!wasReady && fails >= 3) return; // 로그인 안 한 사람 · 계속 거절: 탭이 다시 보일 때 해 봐요
    needResync = true;
    timer = setTimeout(connect, DELAYS[Math.min(fails - 1, DELAYS.length - 1)]);
  };
}

function wake() {
  if (es || !emits.size) return;
  if (document.visibilityState === "hidden") return;
  fails = 0;
  needResync = true;
  connect();
}

function watch(on: boolean) {
  if (typeof window === "undefined" || watching === on) return;
  watching = on;
  if (on) {
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
  } else {
    window.removeEventListener("online", wake);
    document.removeEventListener("visibilitychange", wake);
  }
}

function close() {
  if (timer) { clearTimeout(timer); timer = null; }
  es?.close();
  es = null;
  fails = 0;
  needResync = false;
  watch(false);
}

/** 줄기 열기(LiveProvider SOURCE 모양). 여러 곳이 불러도 탭에는 연결 하나예요. 돌려준 함수로 그만 들어요 */
export const openStream: LiveSource = (emit) => {
  if (MOCK_V3B) return () => {};
  emits.add(emit);
  watch(true);
  connect();
  return () => {
    emits.delete(emit);
    if (!emits.size) close();
  };
};

/** 화면에서 이벤트 듣기: useStream(["msg", "resync"], (e) => …). "*"는 모든 이벤트 */
export function useStream(types: LiveType | LiveType[] | "*", fn: (e: LiveEvent) => void) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  const key = Array.isArray(types) ? [...types].sort().join(",") : types;
  useEffect(() => {
    const want = key === "*" ? null : new Set(key.split(","));
    return openStream((e) => { if (!want || want.has(e.type)) ref.current(e); });
  }, [key]);
}
