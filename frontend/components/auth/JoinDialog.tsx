"use client";
// 가입 · 로그인 카드(C59 · D13, W9 A): 로그인 전 표준견적서에서 '업체 보기' · '예상 공정표' · AI 칸 '가입 · 로그인'을 누르면 그 자리에 떠요.
// 카드에는 가입 · 로그인만 둬요. 가입하면 넣은 답과 표준견적서가 내 공사로 옮겨지고 업체 보기로 가요(N1 A).
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import s from "./join.module.css";

export function JoinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="가입하고 이어서 봐요">
      <p className={s.sub}>업체 가견적 · 예상 공정표는 가입하면 열려요. 넣은 답과 표준견적서가 그대로 이어져요</p>
      <div className={s.btns}>
        <Button size="lg" block href="/signup?step=email">이메일로 가입</Button>
        <Button size="lg" block variant="kakao">카카오로 가입 <Badge tone="mute">준비 중</Badge></Button>
      </div>
      <p className={s.note}>이미 회원이에요 · <Button variant="text" href="/login">로그인</Button></p>
      <Button variant="text" gray className={s.later} onClick={onClose}>나중에 할게요</Button>
    </Dialog>
  );
}
