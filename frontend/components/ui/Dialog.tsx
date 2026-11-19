"use client";
// 가운데 창(W2 A): 되돌리기 어려운 확인(업체 확정 · 이 날짜로 확정 · 거절) · 고르기 · 가입 카드.
// 폰 · 웹 같은 가운데 카드예요. 웹(≥768)은 460px에 오른쪽 위 ×가 더 붙어요. Esc · 바깥 누르기로 닫혀요.
// 제목은 질문 한 문장('마루와벽으로 확정할까요?'), 단추는 [닫기 | 질문의 동작](copy-guide W11).
import { useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useModal } from "./useModal";
import s from "./Dialog.module.css";

export function Dialog({ open, onClose, title, children, actions, dismissible = true, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** 아래 단추 줄. 확인 창은 ConfirmDialog를 써요 */
  actions?: ReactNode;
  /** 보내는 중처럼 닫으면 안 될 때 false */
  dismissible?: boolean;
  /** 웹에서 560px(양식이 길 때) */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, open, onClose, { dismissible });
  return (
    <dialog ref={ref} className={`${s.dlg} ${wide ? s.wide : ""}`} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick}>
      {open ? (
        <div className={s.card}>
          <div className={s.head}>
            <h2 id={`${id}-t`} className={s.title}>{title}</h2>
            <button type="button" className={s.x} aria-label="닫기" onClick={() => dismissible && onClose()}><Icon name="close" /></button>
          </div>
          {children ? <div className={s.body}>{children}</div> : null}
          {actions ? <div className={s.actions}>{actions}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** 확인 창: [닫기 | 동작]. danger면 동작 단추가 빨강이에요(거절 · 탈퇴 · 실측 취소) */
export function ConfirmDialog({ open, onClose, title, children, confirmLabel, onConfirm, danger, busy }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      dismissible={!busy}
      actions={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>닫기</Button>
          <Button variant={danger ? "danger" : "primary"} size="lg" onClick={onConfirm} busy={busy}>{busy ? "보내는 중" : confirmLabel}</Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
