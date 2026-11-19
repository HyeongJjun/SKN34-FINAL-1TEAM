// 사진 칸(design-system 3.3 PhotoGrid · 9판 k-pics): 폰 3열 · 웹은 칸 너비로 4~6열. 정사각 · 모서리 16.
// 사진 위 글은 흰 바탕 작은 라벨로만 얹어요(사진에 바로 글자를 쓰지 않아요). 누르면 크게 보기(C47): href(주소 ?photo=) 또는 onOpen(Lightbox 열기).
// onRemove를 주면 오른쪽 위 × '빼기'(44, 이름: '거실 사진 빼기') — 브라우저 조각 안에서만 넘겨요. add 칸에 FileDrop · '더 넣기'를 둘 수 있어요.
// 사진 주소는 같은 사이트(/api/files/…)만. 위치 정보는 서버가 올릴 때 지워요.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./PhotoGrid.module.css";

export type Photo = { key: string; src: string; alt: string; label?: string; href?: string };

export function PhotoGrid({ photos, label, onOpen, onRemove, add, className }: {
  photos: Photo[];
  /** 묶음 이름(읽기용): '집 사진' · '시공 사례 사진' */
  label: string;
  /** 누르면 이 순서로 Lightbox를 열어요(브라우저 조각 안에서) */
  onOpen?: (index: number) => void;
  onRemove?: (key: string) => void;
  /** 끝 칸(더 넣기) */
  add?: ReactNode;
  className?: string;
}) {
  return (
    <ul className={[s.grid, className].filter(Boolean).join(" ")} aria-label={label}>
      {photos.map((p, i) => {
        const img = <img className={s.img} src={p.src} alt={p.alt} loading="lazy" decoding="async" />;
        return (
          <li key={p.key} className={s.cell}>
            {onOpen ? (
              <button type="button" className={s.link} onClick={() => onOpen(i)} aria-label={`${p.alt}, 크게 보기`}>{img}</button>
            ) : p.href ? <Link href={p.href} className={s.link}>{img}</Link> : img}
            {p.label ? <span className={s.tag} aria-hidden="true">{p.label}</span> : null}
            {onRemove ? (
              <button type="button" className={s.x} aria-label={`${p.label ?? p.alt} 빼기`} onClick={() => onRemove(p.key)}>
                <Icon name="close" size={18} strokeWidth={2.4} />
              </button>
            ) : null}
          </li>
        );
      })}
      {add ? <li className={`${s.cell} ${s.add}`}>{add}</li> : null}
    </ul>
  );
}
