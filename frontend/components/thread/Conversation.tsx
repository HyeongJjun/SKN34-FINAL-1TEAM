"use client";
// 대화 한 개(C25 · C26 · C28 · C62 · D05 오른쪽 · V09 · V20): 위 띠(실측 · 단추) + 글 목록 + 입력(또는 읽기만 줄).
// - 실시간(dev-02): 줄기에서 내 대화 msg가 오면 GET …/messages?after_seq=로 빠진 글만 채우고, 다시 이은 뒤(ready · resync)에도 마지막 seq 뒤를 읽어요.
//   실측 · 대화 상태(state)가 바뀌면 화면을 서버에서 다시 읽어요(띠 · 바꾸기 카드).
// - 보내기: POST …/messages {client_key, kind, body | file_id}. 키는 글마다 한 번 만들어 다시 보내기에도 같은 키(같은 요청 두 번 안전).
// - 읽음: 화면이 보이고 상대 · 시스템 새 글이 있으면 마지막 seq로 POST …/read(줄지 않음). 같은 seq는 두 번 보내지 않아요.
// - 웹(≥1024)은 글 목록만 칸 안에서 스크롤하고, 폰 · 태블릿은 페이지가 스크롤해요(띠는 위 · 입력은 아래에 붙음).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Message, Thread, ThreadVisit } from "@/lib/api/thread";
import { call, errorText } from "@/lib/backend/client";
import { useStream } from "@/lib/backend/stream";
import { MOCK_V3B } from "@/lib/mock/v3b/mode";
import { send, upload } from "@/lib/mock/v3b/client";
import { Button } from "@/components/ui/Button";
import { gwaWa, slotText } from "@/components/visit/text";
import { ChangeSheet } from "./ChangeSheet";
import { Composer } from "./Composer";
import { MessageList, type Pending } from "./MessageList";
import { inner, MoreMenu } from "./MoreMenu";
import { readOnlyText } from "./text";
import s from "./thread.module.css";

const AFTER_VISIT = new Set(["visited", "quoted", "chosen", "closed", "no_show"]);

function merge(cur: Message[], more: Message[]): Message[] {
  if (!more.length) return cur;
  const map = new Map(cur.map((m) => [m.seq, m]));
  for (const m of more) map.set(m.seq, m);
  return [...map.values()].sort((a, b) => a.seq - b.seq);
}

export function Conversation({ role, thread, visit, visitLabel, initial, today }: {
  role: "customer" | "vendor";
  thread: Thread;
  visit: ThreadVisit | null;
  /** 띠에 쓸 실측 줄(목록 값, 실측 정보를 못 읽었을 때) */
  visitLabel: string | null;
  initial: Message[];
  today: string;
}) {
  const router = useRouter();
  const tid = thread.thread_id;
  const enc = encodeURIComponent;
  const [msgs, setMsgs] = useState<Message[]>(initial);
  const [pending, setPending] = useState<(Pending & { fileId?: string })[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [changeOpen, setChangeOpen] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [unblockErr, setUnblockErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const near = useRef(true);
  const lastSeq = useRef(0);
  const sentRead = useRef(thread.read_seq);
  lastSeq.current = msgs.length ? msgs[msgs.length - 1].seq : 0;

  // 서버가 다시 그린 글(router.refresh)을 합쳐요
  useEffect(() => { setMsgs((cur) => merge(cur, initial)); }, [initial]);

  const catchUp = useCallback(async () => {
    if (MOCK_V3B) return;
    try {
      const more = await call<Message[]>("GET", `/threads/${enc(tid)}/messages?after_seq=${lastSeq.current}&limit=100`);
      if (more?.length) setMsgs((cur) => merge(cur, more));
    } catch { /* 다음 이벤트 때 다시 읽어요 */ }
  }, [tid, enc]);

  useStream(["msg", "ready", "resync", "state"], (e) => {
    if (e.type === "msg") { if (e.data.thread_id === tid) void catchUp(); return; }
    if (e.type === "state") {
      if ((e.data.kind === "visit" && e.data.id === thread.visit_id) || e.data.id === tid) router.refresh();
      return;
    }
    void catchUp();
  });

  // 스크롤: 처음엔 맨 아래, 새 글이 오면 아래에 있을 때만 따라가요
  const inner_ = () => { const el = listRef.current; return el ? ["auto", "scroll"].includes(getComputedStyle(el).overflowY) : false; };
  const toBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (inner_()) el.scrollTop = el.scrollHeight;
    else window.scrollTo({ top: document.documentElement.scrollHeight });
  }, []);
  useEffect(() => {
    const el = listRef.current;
    const onScroll = () => {
      if (!el) return;
      near.current = inner_() ? el.scrollHeight - el.scrollTop - el.clientHeight < 120 : document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 160;
    };
    el?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { el?.removeEventListener("scroll", onScroll); window.removeEventListener("scroll", onScroll); };
  }, []);
  useLayoutEffect(() => { toBottom(); }, [toBottom]);
  useEffect(() => { if (near.current) toBottom(); }, [msgs.length, pending.length, toBottom]);

  // 읽음
  useEffect(() => {
    const top = lastSeq.current;
    if (!msgs.some((m) => m.seq > sentRead.current && m.from !== "me")) return;
    const post = () => {
      if (document.visibilityState !== "visible") return;
      const prev = sentRead.current;
      if (top <= prev) return;
      sentRead.current = top;
      send("POST", `/threads/${enc(tid)}/read`, { seq: top }, { result: undefined })
        .then(() => { if (!MOCK_V3B) router.refresh(); })
        .catch(() => { sentRead.current = prev; });
    };
    post();
    document.addEventListener("visibilitychange", post);
    return () => document.removeEventListener("visibilitychange", post);
  }, [msgs, tid, enc, router]);

  async function deliver(p: Pending & { fileId?: string }) {
    setPending((list) => [...list.filter((x) => x.key !== p.key), { ...p, status: "sending", error: undefined }]);
    const body = p.kind === "text" ? { client_key: p.key, kind: "text", body: p.body } : { client_key: p.key, kind: "photo", file_id: p.fileId };
    const mock: Message = { seq: lastSeq.current + 1, id: p.key, from: "me", kind: p.kind, body: p.kind === "text" ? p.body ?? null : null, file_id: p.fileId ?? null, system_code: null, ref_id: null, warn: null, at: new Date().toISOString() };
    try {
      const m = await send<Message>("POST", `/threads/${enc(tid)}/messages`, body, { result: mock });
      setPending((list) => list.filter((x) => x.key !== p.key));
      setMsgs((cur) => merge(cur, [m]));
      near.current = true;
    } catch (e) {
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, status: "failed", error: `보내지 못했어요 · ${errorText(e)}` } : x)));
    }
  }

  function sendText(text: string) {
    near.current = true;
    void deliver({ key: crypto.randomUUID(), kind: "text", body: text, status: "sending" });
  }

  async function sendPhoto(file: File) {
    const key = crypto.randomUUID();
    const src = URL.createObjectURL(file);
    near.current = true;
    setPending((list) => [...list, { key, kind: "photo", src, status: "sending" }]);
    try {
      const f = await upload(file, "chat_photo");
      setPhotos((m) => ({ ...m, [f.id]: src }));
      await deliver({ key, kind: "photo", src, fileId: f.id, status: "sending" });
    } catch (e) {
      setPending((list) => list.map((x) => (x.key === key ? { ...x, status: "failed", error: `보내지 못했어요 · ${errorText(e)}` } : x)));
    }
  }

  function retry(key: string) {
    const p = pending.find((x) => x.key === key);
    if (!p) return;
    if (p.kind === "photo" && !p.fileId) { setPending((list) => list.filter((x) => x.key !== key)); return; }
    void deliver(p);
  }

  async function loadOlder() {
    const first = msgs[0]?.seq;
    if (!first || first <= 1) return;
    setMoreBusy(true);
    try {
      const older = await call<Message[]>("GET", `/threads/${enc(tid)}/messages?before_seq=${first}&limit=50`);
      if (older?.length) { near.current = false; setMsgs((cur) => merge(cur, older)); }
    } catch { /* 단추를 다시 누를 수 있어요 */ }
    setMoreBusy(false);
  }

  async function unblock() {
    setUnblockErr(null);
    try {
      await send("DELETE", `/threads/${enc(tid)}/block`);
      router.refresh();
    } catch (e) {
      setUnblockErr(errorText(e));
    }
  }

  const photoSrc = (fileId: string) => photos[fileId] ?? `/api/threads/${enc(tid)}/files/${enc(fileId)}`;
  const after = visit ? AFTER_VISIT.has(visit.status) : false;
  const visitLine = visit?.booked ? `실측 ${slotText(visit.booked)}${after ? " · 끝" : ""}` : visitLabel;
  const quote = inner(thread.links.quote);
  const project = inner(thread.links.project);
  const writable = thread.status === "open" && thread.can.write;
  const quick = role === "customer" && writable && visit?.status === "booked";
  const scheduleHref = role === "customer" ? (thread.project_id ? `/projects/${enc(thread.project_id)}/visits` : null) : "/vendor?tab=sched";
  const bandText = role === "vendor" ? [visitLine, visit?.areaLabel ?? thread.area_label].filter(Boolean).join(" · ") : visitLine;

  return (
    <section className={s.conv} aria-label={`${gwaWa(thread.title)}의 채팅`}>
      <div className={s.band}>
        <p className={`${s.bandText} mj-num`}>
          <span className={s.bandWho}>{thread.title}{bandText ? " · " : ""}</span>
          {bandText}
        </p>
        <div className={s.bandActs}>
          {role === "customer" && thread.can.change_request && visit?.booked && thread.project_id ? (
            <Button variant="text" onClick={() => setChangeOpen(true)}>일정 바꾸기 요청</Button>
          ) : null}
          {role === "customer" && quote ? <Button variant="text" arrow href={quote}>견적서 보기</Button> : null}
          {/* 폰은 견적서 보기가 있으면 그것 하나만(C62), 웹은 둘 다(D05). 공사 보기는 ⋯ 메뉴에도 있어요 */}
          {role === "customer" && project && after ? <Button variant="text" arrow href={project} className={quote ? s.webAct : undefined}>공사 보기</Button> : null}
          {role === "vendor" && thread.visit_id ? <Button variant="text" arrow href={`/vendor/requests/${enc(thread.visit_id)}`}>요청 보기</Button> : null}
          {role === "vendor" && project ? <Button variant="text" arrow href={project}>공사 보기</Button> : null}
          <div className={s.bandMenu}><MoreMenu thread={thread} visit={visit} role={role} /></div>
        </div>
      </div>

      <div ref={listRef} className={s.msgs} role="log" aria-label="대화 글">
        <MessageList
          messages={msgs}
          pending={pending}
          role={role}
          title={thread.title}
          projectId={thread.project_id}
          visit={visit}
          photoSrc={photoSrc}
          onRetry={retry}
          onDrop={(k) => setPending((list) => list.filter((x) => x.key !== k))}
          onMore={msgs[0] && msgs[0].seq > 1 ? loadOlder : undefined}
          moreBusy={moreBusy}
        />
      </div>

      {writable ? (
        <Composer onSend={sendText} onPhoto={sendPhoto} scheduleHref={scheduleHref} quick={quick} />
      ) : (
        <div className={s.ro}>
          <p>{readOnlyText(role, thread.ro_reason, thread.blocked)}</p>
          {role === "customer" && (thread.blocked || thread.ro_reason === "blocked") ? (
            <div>
              <Button variant="text" onClick={unblock}>차단 풀기</Button>
              {unblockErr ? <p className={s.inputErr} role="alert">{unblockErr}</p> : null}
            </div>
          ) : null}
        </div>
      )}

      {role === "customer" && visit && thread.project_id ? (
        <ChangeSheet open={changeOpen} onClose={() => setChangeOpen(false)} projectId={thread.project_id} visit={visit} vendorName={thread.title} today={today} />
      ) : null}
    </section>
  );
}
