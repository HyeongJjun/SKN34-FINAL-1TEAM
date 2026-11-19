// 조각 모음의 묶음 하나(제목 + 내용). 목차 이동(#id)이 붙는 머리에 가리지 않게 scroll-margin을 둬요.
import s from "./gallery.module.css";

export function Sec({ id, title, children, wide }: { id: string; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section id={id} className={`${s.sec} ${wide ? s.wide : ""}`} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className={s.h}>{title}</h2>
      {children}
    </section>
  );
}
