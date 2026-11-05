"use client";
// 상태 화면 버튼 중 브라우저에서 움직이는 것: 새로 고침 · 로그아웃하고 다른 계정으로.
import { useRouter } from "next/navigation";
import { logout } from "./logout";

export function ReloadButton({ label = "새로 고침", className = "mj-btn mj-btn-sec" }: { label?: string; className?: string }) {
  return <button type="button" className={className} onClick={() => window.location.reload()}>{label}</button>;
}

/** 누르면 로그아웃한 뒤 로그인 화면으로 간다. 글자에 그 뜻을 다 적는다. */
export function LogoutButton({ label = "로그아웃하고 다른 계정으로", to = "/login", className = "mj-btn mj-btn-sec" }: { label?: string; to?: string; className?: string }) {
  const router = useRouter();
  return <button type="button" className={className} onClick={() => logout(router, to)}>{label}</button>;
}
