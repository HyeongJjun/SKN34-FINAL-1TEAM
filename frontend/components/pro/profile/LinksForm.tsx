"use client";
// 업체 정보 · 링크(V18 v_links): 외부 리뷰 링크 3개까지(관리자가 이 업체 것인지 확인하면 고객 화면에 보여요) · 시공 사례 링크 5개까지.
// 저장 → PUT /vendor/review-links(바뀐 링크는 다시 '확인 중') + PUT /vendor/profile(links).
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { Badge } from "@/components/ui/Badge";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { ProfileV3, VendorReviewLinks } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { send } from "../send";
import { Group, Small } from "../ui/parts";
import { profileBody } from "./body";
import s from "./Profile.module.css";

type L = { key: string; label: string; url: string; status?: "checking" | "shown" | "hidden"; fresh?: boolean };
const STATUS = {
  shown: { sub: "이 업체 것인지 확인했어요", badge: "보여요", tone: "ok" as const },
  checking: { sub: "관리자가 보는 중이에요", badge: "확인 중", tone: "wait" as const },
  hidden: { sub: "관리자가 숨겼어요", badge: "숨김", tone: "bad" as const },
};
const urlOk = (u: string) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(u.trim());
let seq = 0;
const k = () => `n${++seq}`;

function LinkList({ title, max, list, setList, kind }: { title: string; max: number; list: L[]; setList: (f: (x: L[]) => L[]) => void; kind: "review" | "case" }) {
  return (
    <Group
      title={<span className="mj-num">{title} {list.length} / {max}</span>}
      action={<Button variant="text" icon="plus" disabled={list.length >= max} onClick={() => setList((x) => [...x, { key: k(), label: "", url: "", fresh: true }])} aria-label={`${title} 넣기`}>넣기</Button>}
    >
      {list.length ? (
        <ul className={s.links}>
          {list.map((l) => (
            <li key={l.key} className={s.link}>
              {l.fresh ? (
                <div className={s.linkEdit}>
                  <Field label="이름" placeholder={kind === "review" ? "예: 네이버 플레이스" : "예: 인스타그램"} maxLength={30} value={l.label} onChange={(e) => setList((x) => x.map((y) => (y.key === l.key ? { ...y, label: e.target.value } : y)))} />
                  <Field label="주소" type="url" inputMode="url" placeholder="https://" maxLength={300} value={l.url} error={l.url && !urlOk(l.url) ? "주소를 https://로 시작하게 넣어 주세요." : null} onChange={(e) => setList((x) => x.map((y) => (y.key === l.key ? { ...y, url: e.target.value } : y)))} />
                </div>
              ) : (
                <div className={s.linkRow}>
                  <span className={s.ll}>
                    <b>{l.label || "링크"}</b>
                    {kind === "review" && l.status ? <span>{STATUS[l.status].sub}</span> : (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className={s.open}>새 창에서 열려요<Icon name="external" size={14} /><span className="mj-sr"> ({l.label || "링크"}, 새 창)</span></a>
                    )}
                  </span>
                  {kind === "review" && l.status ? <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].badge}</Badge> : null}
                </div>
              )}
              <Button variant="text" gray onClick={() => setList((x) => x.filter((y) => y.key !== l.key))} aria-label={`${l.label || "링크"} 빼기`}>빼기</Button>
            </li>
          ))}
        </ul>
      ) : <Small>아직 넣은 링크가 없어요.</Small>}
    </Group>
  );
}

export function LinksForm({ profile, links, tabs }: { profile: ProfileV3; links: VendorReviewLinks; tabs: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [reviews, setReviews] = useState<L[]>(links.map((l) => ({ key: `r${l.sort}`, label: l.label ?? "", url: l.url, status: l.status })));
  const [cases, setCases] = useState<L[]>(profile.links.map((l, i) => ({ key: `c${i}`, label: l.label ?? "", url: l.url })));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const all = [...reviews, ...cases];
    if (all.some((l) => !urlOk(l.url))) { setErr("주소가 비었거나 https://로 시작하지 않는 링크가 있어요. 고치거나 빼 주세요."); return; }
    setErr(null);
    setBusy(true);
    try {
      await send("PUT", "/vendor/review-links", { links: reviews.map((l) => ({ label: l.label.trim() || null, url: l.url.trim() })) });
      await send("PUT", "/vendor/profile", profileBody(profile, { links: cases.map((l) => ({ label: l.label.trim() || null, url: l.url.trim() })) }));
      toast.show("저장했어요. 바뀐 외부 리뷰 링크는 관리자가 확인하면 보여요.");
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Main narrow>
        <PageHead title="업체 정보" crumbs={[{ label: "업체 정보", href: "/vendor/profile" }, { label: "링크" }]} />
        {tabs}
        <LinkList title="외부 리뷰 링크" max={3} list={reviews} setList={setReviews} kind="review" />
        <Small>관리자가 링크가 이 업체 것인지 확인하면 고객 화면에 보여요.</Small>
        <LinkList title="시공 사례 링크" max={5} list={cases} setList={setCases} kind="case" />
        {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
      </Main>
      <BottomBar>
        <Button size="lg" block onClick={save} busy={busy}>{busy ? "저장하는 중" : "저장"}</Button>
      </BottomBar>
    </>
  );
}
