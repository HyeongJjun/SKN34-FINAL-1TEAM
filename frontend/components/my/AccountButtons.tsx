"use client";
// 내 정보(C45)의 로그아웃 단추. 서버 세션을 지우고 첫 화면으로 가요(연결이 안 돼도 화면은 넘겨요).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { logout } from "@/components/site/logout";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" block busy={busy} onClick={async () => { setBusy(true); await logout(router); }}>
      {busy ? "로그아웃 중" : "로그아웃"}
    </Button>
  );
}
