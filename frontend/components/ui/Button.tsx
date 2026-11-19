"use client";
// 단추 · 글자 단추(design-system 3.2 Button · TextLink). 서버 화면에서도 글 · href만 넘기면 바로 써요.
// - variant: primary 주 · weak 약한 · secondary 보조(9판 회색) · danger 위험 · text 글자 단추 · inline 글 속 얇은 밑줄 · kakao 준비 중(늘 꺼짐)
// - size: lg 52(아래 단추 띠) · md 44(기본) · sm 40(촘촘한 곳 최소). 글자 단추도 누를 곳 높이는 44예요(inline만 WCAG '글 속' 예외).
// - href를 주면 링크(Next Link)로 그려요. 다른 화면으로 가는 글자 단추는 arrow로 ›를 붙여요(사용자 결정 U4).
// - disabled는 aria-disabled로 둬서 초점은 받되 눌러도 아무 일도 없어요. busy는 '보내는 중'처럼 글을 바꿔 넘겨요.
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import s from "./Button.module.css";

export type ButtonVariant = "primary" | "weak" | "secondary" | "danger" | "text" | "inline" | "kakao";
export type ButtonSize = "lg" | "md" | "sm";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 가득 채움(폰 아래 단추 띠) */
  block?: boolean;
  /** 글자 단추의 회색 모양(접기 · 요청 취소) */
  gray?: boolean;
  /** 다른 화면으로 가는 글자 단추: › */
  arrow?: boolean;
  icon?: IconName;
  busy?: boolean;
  className?: string;
  children: ReactNode;
};
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { href?: undefined };
type AsLink = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
  href: string;
  /** 새 창: ↗와 숨은 글 '새 창'을 붙여요(copy-guide A8) */
  external?: boolean;
  disabled?: boolean;
};

export function buttonClass({ variant = "primary", size = "md", block, gray, className }: Pick<Common, "variant" | "size" | "block" | "gray" | "className">) {
  return [s.btn, s[variant], variant === "text" || variant === "inline" ? null : s[size], block ? s.block : null, gray ? s.gray : null, className].filter(Boolean).join(" ");
}

export function Button(props: AsButton | AsLink) {
  const { variant = "primary", size = "md", block, gray, arrow, icon, busy, className, children } = props;
  const off = props.disabled || busy || variant === "kakao";
  const cls = buttonClass({ variant, size, block, gray, className });
  const inner = (
    <>
      {icon ? <Icon name={icon} size={size === "sm" || variant === "text" ? 16 : 20} /> : null}
      <span className={s.label}>{children}</span>
      {arrow ? <Icon name="chevron-right" size={16} className={s.arrow} /> : null}
    </>
  );
  const block_ = (e: MouseEvent) => { if (off) e.preventDefault(); };

  if (props.href !== undefined) {
    const { variant: _v, size: _s, block: _b, gray: _g, arrow: _a, icon: _i, busy: _bu, className: _c, children: _ch, external, disabled: _d, href, onClick, ...rest } = props;
    return (
      <Link
        {...rest}
        href={href}
        className={cls}
        aria-disabled={off || undefined}
        aria-busy={busy || undefined}
        target={external ? "_blank" : rest.target}
        rel={external ? "noopener noreferrer" : rest.rel}
        onClick={(e) => { block_(e); if (!off) onClick?.(e); }}
      >
        {inner}
        {external ? <><Icon name="external" size={16} className={s.arrow} /><span className="mj-sr">(새 창)</span></> : null}
      </Link>
    );
  }
  const { variant: _v, size: _s, block: _b, gray: _g, arrow: _a, icon: _i, busy: _bu, className: _c, children: _ch, disabled: _d, type = "button", onClick, ...rest } = props;
  return (
    <button
      {...rest}
      type={type}
      className={cls}
      aria-disabled={off || undefined}
      aria-busy={busy || undefined}
      onClick={(e) => { block_(e); if (!off) onClick?.(e); }}
    >
      {inner}
    </button>
  );
}

/** 아이콘만 있는 단추: 이름(label)이 꼭 있어요. 예: ⋯ '더 보기' · × '닫기' · ‹ '뒤로' */
export function IconButton({ icon, label, href, size = 44, className, ...rest }: {
  icon: IconName;
  label: string;
  href?: string;
  size?: 40 | 44;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const cls = [s.iconBtn, size === 40 ? s.iconSm : null, className].filter(Boolean).join(" ");
  if (href) return <Link href={href} className={cls} aria-label={label}><Icon name={icon} /></Link>;
  return <button type="button" {...rest} className={cls} aria-label={label}><Icon name={icon} /></button>;
}
