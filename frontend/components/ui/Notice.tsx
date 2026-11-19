// 안내 상자(design-system 3.6 Notice · 9판 k-info): 정보(파랑) · 회색 · 흰(회색 바탕 위) · 주의(주황). 14/1.5 · 모서리 16.
// 적게 써요(사용자 결정: 칸 위 힌트 · 안심 문구 최소). 오류는 칸 아래 글 · 토스트로, 이 상자는 '알아 둘 것'만.
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./Notice.module.css";

export function Notice({ tone = "info", title, children, icon, className }: {
  tone?: "info" | "gray" | "white" | "warn";
  /** 굵은 첫 줄 */
  title?: ReactNode;
  children?: ReactNode;
  /** 앞 아이콘(정보 · 주의만 모양이 있어요) */
  icon?: boolean;
  className?: string;
}) {
  const name = tone === "warn" ? "warn" : "info";
  return (
    <div className={[s.box, s[tone], className].filter(Boolean).join(" ")}>
      {icon ? <Icon name={name} size={18} className={s.ic} /> : null}
      <div className={s.body}>
        {title ? <p className={s.title}>{title}</p> : null}
        {children ? <div className={s.text}>{children}</div> : null}
      </div>
    </div>
  );
}
