"use client";
// 아래 시트(폰 < 768) ↔ 가운데 창(웹 ≥ 768). W2 A · design-system 3.7.
// 폰: 위 모서리 24 · 손잡이(꾸밈) · 보이는 [닫기] 단추 · 뒤로 가기로 닫힘 · 최대 85dvh 안에서 스크롤 · 아래 안전 영역.
// 웹: 460px 가운데 창 + 오른쪽 위 ×(폰의 [닫기] 단추는 빼요). 시트 위에 시트를 겹치지 않아요.
// 메뉴(⋯ · +)는 Sheet가 아니라 Menu를 써요(웹에서 단추 옆 작은 메뉴로 바뀌어요).
import Link from "next/link";
import { useId, useRef, type ReactNode } from "react";
import { MQ } from "@/components/site/breakpoints";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useModal } from "./useModal";
import s from "./Sheet.module.css";

const isPhone = () => !window.matchMedia(MQ.tablet).matches;

export function Sheet({ open, onClose, title, children, actions, hideClose, dismissible = true }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** 시트 아래 단추(예: [이유 보내기]). 폰에서는 [닫기] 위에 놓여요 */
  actions?: ReactNode;
  /** 폰 [닫기] 단추를 빼요(actions에 닫기가 이미 있을 때만) */
  hideClose?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, open, onClose, { closeOnBack: isPhone, dismissible });
  return (
    <dialog ref={ref} className={s.sheet} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick}>
      {open ? (
        <div className={s.card}>
          <span className={s.grip} aria-hidden="true" />
          <div className={s.head}>
            <h2 id={`${id}-t`} className={s.title}>{title}</h2>
            <button type="button" className={s.x} aria-label="닫기" onClick={() => dismissible && onClose()}><Icon name="close" /></button>
          </div>
          <div className={s.body}>{children}</div>
          {actions || !hideClose ? (
            <div className={s.foot}>
              {actions}
              {hideClose ? null : <Button variant="secondary" size="lg" block className={s.close} onClick={() => dismissible && onClose()}>닫기</Button>}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** 시트 · 메뉴 안 고르기 줄(48px). 이유 고르기 · ⋯ 메뉴 줄에 써요 */
export function OptionRow({ children, onClick, href, danger, selected, disabled }: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  /** 이유 고르기처럼 하나를 고르는 줄 */
  selected?: boolean;
  disabled?: boolean;
}) {
  const cls = [s.opt, danger ? s.danger : null].filter(Boolean).join(" ");
  if (href && !disabled) return <Link className={cls} href={href}>{children}</Link>;
  return (
    <button type="button" className={cls} onClick={() => !disabled && onClick?.()} aria-pressed={selected === undefined ? undefined : selected} aria-disabled={disabled || undefined}>
      {selected !== undefined ? <span className={s.radio} aria-hidden="true">{selected ? <Icon name="check" size={16} strokeWidth={3} /> : null}</span> : null}
      <span>{children}</span>
    </button>
  );
}
