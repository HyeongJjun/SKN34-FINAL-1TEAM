// 파일 줄(design-system 3.3 FileRow · 9판 k-file): 종류 칸 40(PDF 빨강 · XLS 초록 · 사진 파랑 글자) · 이름 14/600 말줄임 · 크기 · '위치 정보 지움' 13
// 오른쪽: href면 '열기 ↗'(새 창) · action으로 '빼기' 같은 단추를 넣어요. 올리는 중 · 오류도 이 줄에서 알려요.
// 쓰는 화면: A01 A04(사업자등록증) · C33 D18(실측 견적서) · V01 V10 V14(올린 파일). 크기 글은 lib/format.ts fileSize.
import type { ReactNode } from "react";
import { fileSize } from "@/lib/format";
import { Icon } from "./Icon";
import s from "./FileRow.module.css";

const KIND: Record<string, { tag: string; tone: "pdf" | "xls" | "img" | "doc" }> = {
  pdf: { tag: "PDF", tone: "pdf" },
  xls: { tag: "XLS", tone: "xls" }, xlsx: { tag: "XLS", tone: "xls" }, csv: { tag: "CSV", tone: "xls" },
  jpg: { tag: "JPG", tone: "img" }, jpeg: { tag: "JPG", tone: "img" }, png: { tag: "PNG", tone: "img" },
  heic: { tag: "HEIC", tone: "img" }, heif: { tag: "HEIF", tone: "img" }, webp: { tag: "WEBP", tone: "img" },
};

export function FileRow({ name, size, note, href, openLabel = "열기", action, busy, error, className }: {
  name: string;
  /** 바이트(숫자) 또는 이미 만든 글 */
  size?: number | string | null;
  /** 크기 옆 작은 글('위치 정보 지움' · '11.21 받음') */
  note?: ReactNode;
  /** 열기 주소(같은 사이트 /api/files/…). 새 창으로 열어요 */
  href?: string;
  openLabel?: string;
  /** 오른쪽 단추(예: <Button variant="text" gray onClick={…}>빼기</Button>) */
  action?: ReactNode;
  busy?: boolean;
  error?: string | null;
  className?: string;
}) {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const kind = KIND[ext] ?? { tag: ext ? ext.slice(0, 4).toUpperCase() : "파일", tone: "doc" as const };
  const sizeText = typeof size === "number" ? fileSize(size) : size;
  return (
    <div className={[s.row, error ? s.bad : null, className].filter(Boolean).join(" ")} aria-busy={busy || undefined}>
      <span className={`${s.ext} ${s[kind.tone]}`} aria-hidden="true">{kind.tag}</span>
      <span className={s.body}>
        <b className={s.name} title={name}>{name}</b>
        <span className={s.meta}>
          {busy ? "올리는 중" : [sizeText, note].filter(Boolean).map((x, i) => <span key={i}>{i ? " · " : null}{x}</span>)}
        </span>
        {error ? <span className={s.err} role="alert"><Icon name="error" size={16} />{error}</span> : null}
      </span>
      {href && !busy ? (
        <a className={s.open} href={href} target="_blank" rel="noopener noreferrer">
          {openLabel}<Icon name="external" size={16} /><span className="mj-sr">(새 창)</span>
        </a>
      ) : null}
      {action ? <span className={s.act}>{action}</span> : null}
    </div>
  );
}
