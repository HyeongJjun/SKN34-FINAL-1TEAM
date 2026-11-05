"use client";
// 사진 넣는 칸. 끌어다 놓거나, 칸을 눌러 파일을 고른다(진짜 파일 입력을 칸 안에 둬서 키보드로도 연다).
// variant="drop"(기본): 큰 칸 + 작은 그림 + 크게 보기. 업체 가입의 사업자등록증이 쓴다.
// variant="list": 제목 줄의 '고르기' 버튼 + 한 줄에 하나씩(작은 그림 · 이름 · 크기 · 빼기). 견적 받기 공간별 사진 · 도면이 쓴다.
// 넣은 차례대로 보이고, 뺀 뒤에는 같은 자리의 다음 '빼기'(없으면 파일 고르기)로 초점을 옮긴다.
import { useEffect, useRef, useState } from "react";
import { eulReul, fileSize } from "@/lib/format";
import s from "./PhotoDrop.module.css";

/** file: 새로 고른 파일. fileId: 이미 올려 둔 파일(집 정보 고치기에서 불러온 것) */
export type Photo = { id: string; name: string; type: string; file?: File; fileId?: string };

let seq = 0;
export function toPhotos(files: File[]): Photo[] {
  return files.map((f) => ({ id: `p${++seq}`, name: f.name, type: f.type, file: f }));
}

/** 미리보기. 새로 고른 사진은 파일에서 바로 그리고(파일로 만든 주소를 img에 넣지 않는다), 올려 둔 사진은 서버 주소로 연다. */
function Picture({ photo, alt, max }: { photo: Photo; alt: string; max: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const file = photo.file;
  useEffect(() => {
    const c = ref.current;
    if (!file || !c) return;
    let live = true;
    createImageBitmap(file)
      .then((bmp) => {
        if (live) {
          const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
          c.width = Math.max(1, Math.round(bmp.width * k));
          c.height = Math.max(1, Math.round(bmp.height * k));
          c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
        }
        bmp.close();
      })
      .catch(() => {}); // 브라우저가 못 그리는 형식은 빈 칸으로 둔다
    return () => { live = false; };
  }, [file, max]);
  if (!file) return photo.fileId ? <img src={`/api/files/${photo.fileId}`} alt={alt} /> : null;
  return alt ? <canvas ref={ref} role="img" aria-label={alt} /> : <canvas ref={ref} aria-hidden="true" />;
}

type Props = {
  id: string; label: string; photos: Photo[]; onAdd: (files: File[]) => void; onRemove: (photoId: string) => void;
  max?: number; accept?: string; maxMB?: number; hint: string;
  variant?: "drop" | "list"; title?: string; describedBy?: string;
};

export function PhotoDrop({ id, label, photos, onAdd, onRemove, max = 10, accept = "image/*", maxMB, hint, variant = "drop", title, describedBy }: Props) {
  const [over, setOver] = useState(false);
  const [cur, setCur] = useState(0);
  const [msg, setMsg] = useState(""); // 넣었어요 · 뺐어요: 화면 읽기에만 알린다
  const [warn, setWarn] = useState(""); // 못 넣은 파일이 있을 때만 화면에 보인다
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const refocus = useRef<number | null>(null);
  const room = max - photos.length;
  const one = max === 1;
  const okType = (f: File) => accept.split(",").some((a) => (a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a.trim()));
  const xClass = variant === "list" ? s.x : "mj-thumb-x";

  useEffect(() => { if (cur > photos.length - 1) setCur(Math.max(0, photos.length - 1)); }, [photos.length, cur]);
  useEffect(() => {
    if (refocus.current == null) return;
    const xs = list.current?.querySelectorAll<HTMLButtonElement>(`.${xClass}`);
    const target = xs?.[Math.min(refocus.current, xs.length - 1)];
    (target ?? input.current)?.focus();
    refocus.current = null;
  }, [photos.length, xClass]);

  function remove(i: number) {
    const p = photos[i];
    refocus.current = i;
    onRemove(p.id);
    setMsg(`${i + 1}번째를 뺐어요.`);
    setWarn("");
  }

  function take(files: FileList | null) {
    const all = Array.from(files ?? []);
    const typed = all.filter(okType);
    const good = maxMB ? typed.filter((f) => f.size <= maxMB * 1024 * 1024) : typed;
    const fit = one ? good.slice(0, 1) : good.slice(0, Math.max(0, room));
    if (fit.length) { onAdd(fit); setCur(one ? 0 : photos.length); }
    if (!all.length) return;
    const done = !fit.length ? "" : one ? `${eulReul(label)} 넣었어요.` : `${fit.length}장을 넣었어요.`;
    const notType = all.length - typed.length;
    const tooBig = typed.length - good.length;
    const notRoom = good.length - fit.length;
    const why = [
      notType ? `넣을 수 없는 형식 ${notType}개는 뺐어요.` : "",
      tooBig ? `${maxMB}MB가 넘는 파일 ${tooBig}개는 뺐어요.` : "",
      !one && notRoom ? `${max}장까지 넣을 수 있어요.` : "",
    ].filter(Boolean).join(" ");
    setMsg([done, why].filter(Boolean).join(" "));
    setWarn(why);
  }

  const drag = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); },
  };
  const fileInput = <input ref={input} id={id} type="file" accept={accept} multiple={!one} className="mj-sr" aria-describedby={describedBy} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />;

  if (variant === "list") {
    const name = title ?? label;
    return (
      <div className={`${s.list}${over ? ` ${s.over}` : ""}`} {...drag}>
        <div className={s.head}>
          <h3 className={s.title}>{name} <span className="mj-small mj-num">{photos.length}{one ? "개" : "장"}</span></h3>
          <label className={`mj-btn mj-btn-sec mj-btn-sm ${s.pick}`} htmlFor={id}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 12V3M5.5 6.5L9 3l3.5 3.5" /><path d="M3 11.5V15h12v-3.5" /></svg>
            {label} 고르기
            {fileInput}
          </label>
        </div>
        <p className="mj-sr" aria-live="polite">{msg}</p>
        {warn ? <p className={s.warn}>{warn}</p> : null}
        {photos.length ? (
          <ol ref={list} className={s.rows} aria-label={`${name} 목록`}>
            {photos.map((p, i) => (
              <li key={p.id} className={s.row}>
                <span className={s.thumb} aria-hidden="true">
                  {p.type.startsWith("image/") ? <Picture photo={p} alt="" max={256} /> : <FileMark />}
                </span>
                <p className={s.name}>{p.name}{p.file ? <span className="mj-small mj-num"> · {fileSize(p.file.size)}</span> : <span className="mj-small"> · 올려 둔 파일</span>}</p>
                <button type="button" className={`mj-btn mj-btn-sec mj-btn-sm ${s.x}`} onClick={() => remove(i)} aria-label={`${name} ${i + 1}번째 빼기 · ${p.name}`}>빼기</button>
              </li>
            ))}
          </ol>
        ) : null}
        {hint ? <p className="mj-small">{hint}</p> : null}
      </div>
    );
  }

  const shown = photos[cur];
  return (
    <div className="mj-photo">
      <label className={`mj-drop${over ? " is-over" : ""}`} htmlFor={id} {...drag}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></svg>
        <span className="mj-drop-t">{label}</span>
        <span className="mj-small">여기로 끌어다 놓거나 눌러서 고르세요 · {hint}</span>
        {fileInput}
      </label>
      <p className="mj-sr" aria-live="polite">{msg}</p>
      {warn ? <p className="mj-small" style={{ color: "var(--warn)" }}>{warn}</p> : null}

      {photos.length > 0 && (
        <>
          <ol ref={list} className="mj-thumbs" aria-label={`${label} 목록`}>
            {photos.map((p, i) => (
              <li key={p.id} className="mj-thumb-li">
                <button type="button" className="mj-thumb" aria-pressed={i === cur} onClick={() => setCur(i)} aria-label={`${i + 1}번째 크게 보기 · ${p.name}`}>
                  {p.type.startsWith("image/") ? <Picture photo={p} alt="" max={256} /> : <span className="mj-thumb-file">PDF</span>}
                  <span className="mj-thumb-n mj-num" aria-hidden="true">{i + 1}</span>
                </button>
                <button type="button" className="mj-thumb-x" onClick={() => remove(i)} aria-label={`${i + 1}번째 빼기 · ${p.name}`}>
                  <span aria-hidden="true"><svg width="12" height="12" viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg></span>
                </button>
              </li>
            ))}
          </ol>
          {shown && (
            <figure className="mj-viewer">
              {shown.type.startsWith("image/") ? <Picture key={shown.id} photo={shown} alt={`${label} ${cur + 1}번째: ${shown.name}`} max={1280} /> : <div className="mj-viewer-file">{shown.name}</div>}
            </figure>
          )}
        </>
      )}
    </div>
  );
}

function FileMark() {
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" fill="none" aria-hidden="true"><path d="M3 1.5h15l7 7v24H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M18 1.5v7h7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 17h12M8 22h12M8 27h8" stroke="currentColor" strokeWidth="1.5" /></svg>
  );
}
