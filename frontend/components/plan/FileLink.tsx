"use client";
// 파일 받기 링크(캘린더 .ics). 단추 모양은 B4 buttonClass(브라우저 조각)를 써야 해서 작은 브라우저 조각으로 둬요.
// 화면 이동이 아니라 파일 받기라 Next Link가 아닌 <a download>예요(미리 받기 · 화면 전환 없음).
import type { ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

export function FileLink({ href, children, variant = "text", size }: { href: string; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={buttonClass({ variant, size })} href={href} download>{children}</a>;
}
