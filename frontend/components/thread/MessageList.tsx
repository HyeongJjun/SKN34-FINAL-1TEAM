"use client";
// 대화 글 목록(C25 · C28 · C62 · D05 · V09 · V20). 날짜가 바뀌면 날짜 줄(긴 꼴 '11월 18일(수)'), 시스템 글은 가운데 알약,
// 말풍선 시각은 말풍선 밖 시:분이고 같은 사람 · 같은 분이면 마지막 말에만(U7). 내 글은 오른쪽(시각 왼쪽), 상대 글은 왼쪽(시각 오른쪽).
// 업체 글에 주의 표시(warn)가 있으면 그 아래에 주의 줄 한 줄(고객 화면만 · 서버가 고객 응답에만 넣어요).
import type { Message, ThreadVisit } from "@/lib/api/thread";
import { timeSeoul } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { iGa, slotText } from "@/components/visit/text";
import { ChangeCard } from "./ChangeCard";
import { systemText, toItems } from "./text";
import { WarnLine } from "./WarnLine";
import s from "./thread.module.css";

export type Pending = { key: string; kind: "text" | "photo"; body?: string; src?: string; status: "sending" | "failed"; error?: string };

export function MessageList({ messages, pending, role, title, projectId, visit, photoSrc, onRetry, onDrop, onMore, moreBusy }: {
  messages: Message[];
  pending: Pending[];
  role: "customer" | "vendor";
  /** 상대 이름표(고객: 업체 상호 · 업체: '상계동 고객') */
  title: string;
  projectId: string | null;
  visit: ThreadVisit | null;
  /** 사진 주소(예시 데이터면 방금 고른 사진을 그대로) */
  photoSrc: (fileId: string) => string;
  onRetry: (key: string) => void;
  onDrop: (key: string) => void;
  /** 앞 글 더 보기(처음 글이 1번이 아닐 때) */
  onMore?: () => void;
  moreBusy?: boolean;
}) {
  const items = toItems(messages, (m) => `m-${m.seq}`);
  return (
    <>
      {onMore ? <div className={s.more}><Button variant="text" onClick={onMore} busy={moreBusy}>{moreBusy ? "불러오는 중" : "앞 글 더 보기"}</Button></div> : null}
      {items.map((it) => {
        if (it.type === "day") return <p key={it.key} className={s.day}><time dateTime={it.iso}>{it.label}</time></p>;
        const m = it.msg;
        if (it.type === "sys") {
          const change = m.system_code === "change_requested" && visit?.change && visit.change.id === m.ref_id ? visit.change : null;
          if (change && visit) {
            const mine = role === "customer";
            return (
              <div key={it.key} className={s.cardWrap}>
                <div className={`${s.row} ${s.cardRow} ${mine ? s.me : ""} ${s.gap}`}>
                  {mine ? <time dateTime={m.at} className={`${s.time} mj-num`}>{timeSeoul(m.at)}</time> : null}
                  <ChangeCard change={change} role={role} projectId={projectId} visitId={visit.visitId} vendorName={title} />
                  {mine ? null : <time dateTime={m.at} className={`${s.time} mj-num`}>{timeSeoul(m.at)}</time>}
                </div>
                {mine && change.status === "open" ? <p className={s.sys}>수락하기 전까지는 {slotText({ day: change.from_day, half: change.from_half })} 그대로예요</p> : null}
              </div>
            );
          }
          return <p key={it.key} className={s.sys}>{systemText(m.system_code, m.body)}</p>;
        }
        const me = m.from === "me";
        const who = me ? "나" : title;
        return (
          <div key={it.key} className={s.rowWrap}>
            <div className={[s.row, me ? s.me : null, it.gap ? s.gap : null].filter(Boolean).join(" ")}>
              {me && it.time ? <time dateTime={m.at} className={`${s.time} mj-num`}>{it.time}</time> : null}
              {m.kind === "photo" && m.file_id ? (
                <img className={s.photo} src={photoSrc(m.file_id)} alt={me ? "내가 보낸 사진" : `${iGa(title)} 보낸 사진`} loading="lazy" />
              ) : (
                <p className={s.bub}>{it.first ? <span className="mj-sr">{who}: </span> : null}{m.body}</p>
              )}
              {!me && it.time ? <time dateTime={m.at} className={`${s.time} mj-num`}>{it.time}</time> : null}
            </div>
            {m.warn === "offsite" && role === "customer" ? <WarnLine /> : null}
          </div>
        );
      })}
      {pending.map((p) => (
        <div key={p.key} className={s.rowWrap}>
          <div className={`${s.row} ${s.me} ${s.pending}`}>
            {p.kind === "photo" && p.src ? <img className={s.photo} src={p.src} alt="보내는 사진" /> : <p className={s.bub}>{p.body}</p>}
          </div>
          {p.status === "sending" ? <p className="mj-sr" role="status">보내는 중</p> : (
            <p className={s.failed} role="alert">
              <span>{p.error ?? "보내지 못했어요"}</span>
              <Button variant="text" onClick={() => onRetry(p.key)}>다시 보내기</Button>
              <Button variant="text" gray onClick={() => onDrop(p.key)}>지우기</Button>
            </p>
          )}
        </div>
      ))}
    </>
  );
}
