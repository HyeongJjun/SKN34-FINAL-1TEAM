"use client";
// 업체 정보 · 시공 사례(V16 v_cases): 사진 20장까지. 고객 업체 상세의 '사례'와 크게 보기(C47)에 이 칸이 그대로 보여요.
// 사진을 고르면 바로 올리고(POST /files kind=portfolio → POST /vendor/portfolio), 사진마다 공간 · 벽지 · 면적(㎡ + 공급 · 전용) · 찍은 때를 적어요.
// 저장 → PUT /vendor/profile(portfolio). 사진 빼기 → DELETE /vendor/portfolio/{id}(한 번 더 물어요).
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, SelectField } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { Segmented } from "@/components/ui/Segmented";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { ProfileV3 } from "@/lib/api/vendor";
import { errorText, type Schemas } from "@/lib/backend/client";
import { MOCK } from "@/lib/mock/v3c/mode";
import { enc, newKey, send, upload } from "../send";
import { PAPERS, paperLabel, SPACES } from "../text";
import { Eyebrow, Group, Small } from "../ui/parts";
import { profileBody } from "./body";
import s from "./Profile.module.css";

type Item = Schemas["PortfolioOut"];
const MAX = 20;
const title = (x: Item) => [x.space, x.paper ? paperLabel(x.paper) : null].filter(Boolean).join(" · ") || "시공 사진";
const altOf = (x: Item) => [x.space, x.paper ? `${paperLabel(x.paper)}벽지` : null, "시공 사진", x.taken_on ? `${x.taken_on.slice(0, 4)}년 ${Number(x.taken_on.slice(5, 7))}월` : null].filter(Boolean).join(" · ");

export function CasesForm({ profile, tabs }: { profile: ProfileV3; tabs: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(profile.portfolio);
  const [sel, setSel] = useState<string | null>(profile.portfolio[0]?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drop, setDrop] = useState<Item | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cur = items.find((x) => x.id === sel) ?? null;
  const edit = (patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === sel ? { ...x, ...patch } : x)));

  async function pick(files: File[]) {
    const room = MAX - items.length;
    if (room <= 0) { setErr(`사진은 ${MAX}장까지 올릴 수 있어요.`); return; }
    setErr(null);
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        const fo = await upload("portfolio", f);
        const made = await send<Item>("POST", "/vendor/portfolio", { title: "시공 사진", file_id: fo.id });
        const item: Item = MOCK || !made?.id ? { id: newKey(), file_id: fo.id, title: "시공 사진", space: null, paper: null, area_m2: null, taken_on: null } : made;
        setItems((xs) => [...xs, item]);
        setSel(item.id);
      }
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setUploading(false);
    }
  }

  async function remove(x: Item) {
    setBusy(true);
    try {
      await send("DELETE", `/vendor/portfolio/${enc(x.id)}`);
      setItems((xs) => xs.filter((y) => y.id !== x.id));
      setSel((v) => (v === x.id ? null : v));
      setDrop(null);
      toast.show("사진을 뺐어요.");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await send("PUT", "/vendor/profile", profileBody(profile, {
        portfolio: items.map((x) => ({ id: x.id, title: title(x), space: x.space ?? null, paper: x.paper ?? null, area_m2: x.area_m2 ?? null, area_basis: x.area_m2 ? x.area_basis ?? "supply" : null, taken_on: x.taken_on ?? null })),
      }));
      toast.show("저장했어요.");
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
        <PageHead title="업체 정보" crumbs={[{ label: "업체 정보", href: "/vendor/profile" }, { label: "시공 사례" }]} />
        {tabs}
        <Group>
          <Eyebrow as="h2"><span className="mj-num">시공 사진 {items.length} / {MAX}</span></Eyebrow>
          {items.length ? (
            <ul className={s.cases} aria-label="시공 사진">
              {items.map((x) => (
                <li key={x.id} className={`${s.case} ${x.id === sel ? s.caseOn : ""}`}>
                  <button type="button" className={s.caseBtn} aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>
                    {MOCK ? <span className={s.ph} role="img" aria-label={altOf(x)}><Icon name="image" size={22} /></span> : <img src={`/api/files/${enc(x.file_id)}`} alt={altOf(x)} loading="lazy" />}
                    <span className={s.cl} aria-hidden="true">{title(x)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <FileDrop kind="photo" label="시공 사진 올리기" busy={uploading} error={err} onFiles={pick} disabled={items.length >= MAX} />
          <Small>사진마다 아래 칸을 적어요.</Small>
        </Group>
        {cur ? (
          <Group>
            <div className={s.selHead}>
              <Eyebrow as="h2">고른 사진 · {title(cur)}</Eyebrow>
              <Button variant="text" gray onClick={() => setDrop(cur)}>사진 빼기</Button>
            </div>
            <div className={s.two}>
              <SelectField label="공간" options={[{ value: "", label: "고르기" }, ...SPACES.map((x) => ({ value: x, label: x }))]} value={cur.space ?? ""} onChange={(e) => edit({ space: e.target.value || null })} />
              <SelectField label="벽지" options={[{ value: "", label: "고르기" }, ...PAPERS]} value={cur.paper ?? ""} onChange={(e) => edit({ paper: (e.target.value || null) as Item["paper"] })} />
            </div>
            <div className={s.two}>
              <Field label="면적" unit="㎡" num inputMode="decimal" value={cur.area_m2 ?? ""} onChange={(e) => edit({ area_m2: e.target.value.replace(/[^\d.]/g, "").slice(0, 6) || null })} />
              <Field label="찍은 때" type="month" value={cur.taken_on ? cur.taken_on.slice(0, 7) : ""} onChange={(e) => edit({ taken_on: e.target.value ? `${e.target.value}-01` : null })} />
            </div>
            {cur.area_m2 ? (
              <Segmented legend="면적 기준" options={[{ value: "supply", label: "공급" }, { value: "exclusive", label: "전용" }]} value={cur.area_basis ?? "supply"} onChange={(x) => edit({ area_basis: x as Item["area_basis"] })} />
            ) : null}
          </Group>
        ) : null}
      </Main>
      <BottomBar>
        <Button size="lg" block onClick={save} busy={busy || uploading}>{busy ? "저장하는 중" : "저장"}</Button>
      </BottomBar>
      <ConfirmDialog open={!!drop} onClose={() => setDrop(null)} title="이 사진을 뺄까요?" confirmLabel="빼기" danger busy={busy} onConfirm={() => drop && remove(drop)}>
        <p>고객 화면의 시공 사례에서도 빠져요. 다시 보이려면 사진을 새로 올려요.</p>
      </ConfirmDialog>
    </>
  );
}
