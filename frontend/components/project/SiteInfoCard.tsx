"use client";
// 현장 정보(시연 피드백): 고객이 주차 · 엘리베이터 · 출입 방법을 적어 두면 업체가 방문을 준비할 때 봐요.
// GET · PUT /projects/{id}/site. 주차 · 엘리베이터는 업체 요청 화면에 바로, 출입 방법은 실측이 확정된 뒤에만 보여요(서버가 정해요).
// 비밀번호 · 연락처 · 동호수는 서버가 받지 않아요(채팅으로 알리게 해요).
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import s from "./SiteInfoCard.module.css";

type Site = Schemas["SiteOut"];
const YN = [{ value: "yes", label: "있어요" }, { value: "no", label: "없어요" }];
type Yn = "yes" | "no";

export function SiteInfoCard({ projectId }: { projectId: string }) {
  const uid = useId();
  const [site, setSite] = useState<Site | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const url = `/projects/${encodeURIComponent(projectId)}/site`;

  useEffect(() => {
    let live = true;
    call<Site>("GET", url)
      .then((x) => { if (live) { setSite(x); setNote(x.entry_note ?? ""); } })
      .catch(() => {}); // 못 읽었으면 칸을 그리지 않아요(빈 값으로 덮어쓰지 않게)
    return () => { live = false; };
  }, [url]);

  async function save(next: Site) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const got = await call<Site>("PUT", url, next);
      setSite(got);
      setNote(got.entry_note ?? "");
      setMsg({ ok: true, text: "저장했어요." });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!site) return null;
  return (
    <section className={s.box} aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="mj-h3">현장 정보</h2>
      <p className="mj-hint">업체가 방문을 준비할 때 봐요. 적지 않아도 돼요.</p>
      <Segmented legend="주차할 곳" options={YN} value={site.parking ?? null} disabled={busy} onChange={(v) => save({ ...site, parking: v as Yn })} />
      <Segmented legend="엘리베이터" options={YN} value={site.elevator ?? null} disabled={busy} onChange={(v) => save({ ...site, elevator: v as Yn })} />
      <Field label="출입 방법" placeholder="예: 정문 경비실에 말하고 들어와요" maxLength={100} value={note} onChange={(e) => { setNote(e.target.value); setMsg(null); }} />
      <p className="mj-hint">출입 방법은 실측 날짜가 확정된 뒤에 업체에 보여요. 비밀번호 · 연락처 · 동호수는 여기 말고 채팅으로 알려 주세요.</p>
      <div className={s.row}>
        <Button size="sm" variant="secondary" onClick={() => save({ ...site, entry_note: note || null })} busy={busy}>{busy ? "저장하는 중" : "출입 방법 저장"}</Button>
        {msg ? <p className={msg.ok ? "mj-hint" : "mj-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </div>
    </section>
  );
}
