"use client";
// 채팅 입력(C25 · C26): + 메뉴(사진 · 실측 일정 — '주소와 번호'는 뺐어요, 7판 · 11-18 결정) · 메시지 칸 · 보내기, 위에 빠른 답(고객 · 실측 전).
// 동 · 호수 · 연락처는 고객이 이 칸에 글로 직접 써요(업체에는 동네까지만 보여요). 1,000자까지.
// Enter: 마우스 기기에서만 보내기(한글 조합 중이 아닐 때 · Shift+Enter 줄바꿈). 폰은 줄바꿈이고 '보내기' 단추로 보내요.
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { BODY_MAX, QUICK_REPLIES } from "./text";
import s from "./thread.module.css";

export function Composer({ onSend, onPhoto, scheduleHref, quick }: {
  onSend: (body: string) => void;
  onPhoto: (file: File) => void;
  /** + 메뉴 '실측 일정'이 가는 곳 */
  scheduleHref: string | null;
  /** 빠른 답 보이기(고객 · 실측 전 · 쓸 수 있을 때) */
  quick: boolean;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const id = useId();

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    if (body.length > BODY_MAX) {
      setErr(`${BODY_MAX.toLocaleString("ko-KR")}자까지 보낼 수 있어요. 나눠서 보내 주세요.`);
      area.current?.focus();
      return;
    }
    setErr(null);
    onSend(body);
    setText("");
    if (area.current) { area.current.style.height = ""; area.current.focus(); }
  }

  const items: MenuItem[] = [{ label: "사진", onSelect: () => file.current?.click() }];
  if (scheduleHref) items.push({ label: "실측 일정", href: scheduleHref });

  return (
    <div className={s.composer}>
      {quick ? (
        <div className={s.quick} role="group" aria-label="빠른 답">
          {QUICK_REPLIES.map((q) => <button key={q} type="button" className={s.quickBtn} onClick={() => onSend(q)}>{q}</button>)}
        </div>
      ) : null}
      <div className={s.inputRow}>
        <div className={s.plus}>
          <Menu label="더 보내기" icon="plus" title="더 보내기" items={items} align="start" />
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className={s.fileInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = ""; }}
        />
        <div className={s.field}>
          <label htmlFor={id} className="mj-sr">메시지</label>
          <textarea
            ref={area}
            id={id}
            rows={1}
            className={err ? `${s.input} ${s.inputBad}` : s.input}
            placeholder="메시지"
            value={text}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? `${id}-err` : undefined}
            onChange={(e) => { setText(e.currentTarget.value); grow(e.currentTarget); if (err) setErr(null); }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              if (!window.matchMedia("(pointer: fine)").matches) return;
              e.preventDefault();
              submit();
            }}
          />
          {err ? <p id={`${id}-err`} className={s.inputErr} role="alert"><Icon name="error" size={14} />{err}</p> : null}
        </div>
        <div className={s.send}>
          <Button onClick={submit} disabled={!text.trim()}>보내기</Button>
        </div>
      </div>
    </div>
  );
}
