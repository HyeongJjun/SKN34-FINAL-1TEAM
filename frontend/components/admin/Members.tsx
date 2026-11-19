"use client";
// 회원 관리(A03 a_members): 이름 · 이메일로 찾기 · 계정 상태 거르기 · 계정 정지 · 정지 풀기. 정지 · 정지 풀기는 줄 안에서 한 번 더 물어요.
// 찾기 · 거르기는 주소(?q= · ?status=)를 바꿔 서버가 다시 읽어요. 정지 → POST /admin/members/{uid}/suspend · unsuspend(멱등 키).
// CF-47: 제목 옆 설명 · 아래 설계 메모는 뺐어요. CF-24: 줄 안 확인 단추는 '정지'.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { MemberRow } from "@/lib/api/admin";
import { errorText } from "@/lib/backend/client";
import { dateShort } from "@/lib/format";
import { enc, newKey, send } from "@/components/pro/send";
import { Small } from "@/components/pro/ui/parts";
import { Segmented } from "@/components/ui/Segmented";
import s from "./admin.module.css";

type St = "all" | "active" | "suspended";

export function Members({ rows, q, status }: { rows: MemberRow[]; q: string; status: St }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(q);
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idem] = useState(newKey);
  const go = (nq: string, ns: St) => {
    const p = new URLSearchParams();
    if (nq.trim()) p.set("q", nq.trim());
    if (ns !== "all") p.set("status", ns);
    router.push(`/admin/members${p.toString() ? `?${p.toString()}` : ""}`);
  };
  function onFind(e: FormEvent) { e.preventDefault(); go(text, status); }

  async function act(m: MemberRow) {
    const to = m.status === "active" ? "suspend" : "unsuspend";
    setBusy(m.user_id);
    setErr(null);
    try {
      await send("POST", `/admin/members/${enc(m.user_id)}/${to}`, { note: null }, { idem: `${idem}-${m.user_id}-${to}` });
      toast.show(to === "suspend" ? `${m.name} 님 계정을 정지했어요. 로그인한 기기에서 모두 나가요.` : `${m.name} 님 계정 정지를 풀었어요.`);
      setAsk(null);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={s.filter}>
        <form role="search" className={s.find} onSubmit={onFind}>
          {/* CF-74: 칸 이름은 '회원 찾기', 칸 안 글은 '이름 · 이메일로 찾기' */}
          <Field label="회원 찾기" placeholder="이름 · 이메일로 찾기" type="search" maxLength={50} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="secondary">찾기</Button>
        </form>
        <Segmented legend="계정 상태" options={[{ value: "all", label: "전체" }, { value: "active", label: "사용 중" }, { value: "suspended", label: "정지" }]} value={status} onChange={(x) => go(text, x as St)} />
      </div>
      <p className={`${s.count} mj-num`} aria-live="polite">{rows.length}명</p>
      {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
      {rows.length ? (
        <div className={s.tableBox} tabIndex={0} role="region" aria-label="회원 목록 · 옆으로 넘겨 볼 수 있어요">
          <table className={s.table}>
            <caption className="mj-sr">회원 목록</caption>
            <thead><tr><th scope="col">이름</th><th scope="col">이메일</th><th scope="col">가입일</th><th scope="col" className={s.r}>공사</th><th scope="col">상태</th><th scope="col">관리</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.user_id} className={ask === m.user_id ? s.sel : undefined}>
                  <td><b>{m.name}</b></td>
                  <td className={s.mail}>{m.email}</td>
                  <td className="mj-num">{dateShort(m.created_at)}</td>
                  <td className={`${s.r} mj-num`}>{m.project_count}</td>
                  <td><Badge tone={m.status === "active" ? "ok" : "bad"}>{m.status === "active" ? "사용 중" : "정지"}</Badge></td>
                  <td>
                    {ask === m.user_id ? (
                      <div className={s.tact}>
                        <Button size="sm" variant={m.status === "active" ? "danger" : "primary"} onClick={() => act(m)} busy={busy === m.user_id}>{busy === m.user_id ? "보내는 중" : m.status === "active" ? "정지" : "풀기"}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setAsk(null)} disabled={busy === m.user_id}>취소</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setAsk(m.user_id)} aria-label={`${m.name} ${m.status === "active" ? "계정 정지" : "정지 풀기"}`}>{m.status === "active" ? "계정 정지" : "정지 풀기"}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Small>{q ? "찾는 회원이 없어요. 이름이나 이메일을 바꿔 찾아 주세요." : "회원이 없어요."}</Small>}
    </>
  );
}
