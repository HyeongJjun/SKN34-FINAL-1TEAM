// 빈 화면(C23 · C56 · 길 주기 C12 · C22): [왜 비었는지 · 언제 채워지는지] + [다음 할 일 하나]. 막다른 화면을 만들지 않아요.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import s from "./EmptyState.module.css";

export function EmptyState({ icon = "doc", title, children, action, as: H = "h2" }: {
  icon?: IconName;
  /** 줄바꿈이 필요하면 <br />를 넣어요 */
  title: ReactNode;
  children?: ReactNode;
  /** 다음 할 일 단추 · 글자 단추 */
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={s.empty}>
      <span className={s.ic}><Icon name={icon} size={34} /></span>
      <H className={s.title}>{title}</H>
      {children ? <div className={s.desc}>{children}</div> : null}
      {action ? <div className={s.act}>{action}</div> : null}
    </div>
  );
}
