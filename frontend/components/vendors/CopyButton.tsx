"use client";
// 문구 · 번호 복사. 복사했는지는 글로 알린다(화면 읽기 프로그램도 듣게 role=status).
import { useState } from "react";
import { Copy } from "./icons";
import s from "./CopyButton.module.css";

export function CopyButton({ text, label, aria, small }: { text: string; label: string; aria?: string; small?: boolean }) {
  const [said, setSaid] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setSaid("복사했어요");
    } catch {
      setSaid("복사하지 못했어요. 길게 눌러 복사해 주세요.");
    }
  }
  return (
    <span className={s.wrap}>
      <button type="button" className={`mj-btn mj-btn-sec${small ? " mj-btn-sm" : ""}`} aria-label={aria} onClick={copy}><Copy />{label}</button>
      <span className="mj-small" role="status">{said}</span>
    </span>
  );
}
