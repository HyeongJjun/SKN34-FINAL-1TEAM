"use client";
// 휴대폰 번호(C51): 내 정보에만 저장돼요(업체에는 가지 않아요). 인증번호는 준비 중이라 꺼 둬요.
// 저장 → PATCH /me {phone} → 내 정보. 화면 본문(Main)과 아래 단추 띠까지 그려요(띠는 Main 바로 뒤에 붙어야 해서요).
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { errorText } from "@/lib/backend/client";
import { phoneText } from "@/lib/labels";
import { send } from "@/lib/mock/v3b/client";
import { PHONE_MSG, phoneOk } from "@/components/auth/parts";
import { Badge } from "@/components/ui/Badge";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Main } from "@/components/site/Frame";
import { Group } from "@/components/project/Kit";
import s from "./account2.module.css";

export function PhoneForm({ phone, top }: { phone: string | null; top?: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const formId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(phone ? phoneText(phone) : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) { setErr("휴대폰 번호를 적어 주세요."); input.current?.focus(); return; }
    if (!phoneOk(v)) { setErr(PHONE_MSG); input.current?.focus(); return; }
    setErr("");
    setBusy(true);
    try {
      await send("PATCH", "/me", { phone: v });
      toast.show("휴대폰 번호를 저장했어요");
      router.push("/account");
      router.refresh();
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <>
      <Main narrow>
        {top}
        <Group>
          <form id={formId} noValidate onSubmit={submit} aria-label="휴대폰 번호">
            <Field
              ref={input}
              label="휴대폰"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              error={err || undefined}
            />
          </form>
          <div className={s.phoneRow}>
            <Button variant="secondary" size="sm" disabled>인증번호 받기</Button>
            <Badge tone="mute">준비 중</Badge>
          </div>
        </Group>
      </Main>
      <BottomBar>
        <Button size="lg" type="submit" form={formId} busy={busy}>{busy ? "저장하는 중" : "저장"}</Button>
      </BottomBar>
    </>
  );
}
