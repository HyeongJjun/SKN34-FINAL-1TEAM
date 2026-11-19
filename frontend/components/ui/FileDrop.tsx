"use client";
// 끌어다 놓기 칸(I9 A · design-system 3.2 FileDrop).
// - 폰(손가락으로 누르는 기기): '눌러서 앨범 · 카메라에서 골라요'만. 서류는 '눌러서 파일 · 앨범 · 카메라에서 골라요'.
// - 웹(마우스): '사진을 끌어다 놓거나 눌러서 골라요' + [파일 고르기]. 끌어 오는 동안 테두리 · 문구가 바뀌어요('여기에 놓으면 올라가요 · 사진 2장').
// - 칸 아래 안내 줄은 두지 않아요(I9). 받는 형식은 칸 안 작은 글(types)로만. 오류(형식 · 크기)는 칸 아래 한 줄이에요(U5).
// 폰 · 웹 글은 CSS (pointer: coarse)로 갈라서 서버 · 브라우저 그림이 같아요. 올린 뒤 사진 칸 · 파일 줄은 부르는 쪽이 그려요.
import { useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import s from "./FileDrop.module.css";

export function FileDrop({ kind = "photo", label, onFiles, accept, multiple = true, types, busy, error, disabled }: {
  kind?: "photo" | "doc";
  /** 칸 이름(화면 읽기). 예: '집 사진 올리기' */
  label: string;
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** 칸 안 작은 글: 'PDF · 엑셀 · 사진' */
  types?: string;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState<number | null>(null);
  const depth = useRef(0);
  const word = kind === "photo" ? "사진" : "파일";
  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length && !disabled && !busy) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div className={s.wrap}>
      <label
        htmlFor={id}
        className={[s.zone, over !== null ? s.over : null, error ? s.bad : null, disabled ? s.off : null].filter(Boolean).join(" ")}
        onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(e.dataTransfer?.items?.length ?? 0); }}
        onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; }}
        onDragLeave={() => { depth.current -= 1; if (depth.current <= 0) { depth.current = 0; setOver(null); } }}
        onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(null); take(e.dataTransfer?.files ?? null); }}
      >
        <input
          ref={input}
          id={id}
          type="file"
          className={s.input}
          accept={accept ?? (kind === "photo" ? "image/*" : "application/pdf,.xls,.xlsx,image/*")}
          multiple={multiple}
          disabled={disabled || busy}
          aria-label={label}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => { take(e.currentTarget.files); e.currentTarget.value = ""; }}
        />
        <Icon name={kind === "photo" ? "camera" : "doc"} className={s.ic} />
        {busy ? (
          <b aria-live="polite">올리는 중이에요</b>
        ) : over !== null ? (
          <b>여기에 놓으면 올라가요{over > 0 ? <span className="mj-num"> · {word} {over}{kind === "photo" ? "장" : "개"}</span> : null}</b>
        ) : (
          <>
            <b className={s.coarse}>{kind === "photo" ? "눌러서 앨범 · 카메라에서 골라요" : "눌러서 파일 · 앨범 · 카메라에서 골라요"}</b>
            <b className={s.fine}>{kind === "photo" ? "사진을 끌어다 놓거나 눌러서 골라요" : "파일을 끌어다 놓거나 눌러서 골라요"}</b>
            <span className={`${s.fine} ${s.pickBtn}`} aria-hidden="true">파일 고르기</span>
          </>
        )}
        {types ? <span className={s.types}>{types}</span> : null}
      </label>
      {error ? <p id={`${id}-err`} className={s.error} role="alert"><Icon name="error" size={16} />{error}</p> : null}
    </div>
  );
}
