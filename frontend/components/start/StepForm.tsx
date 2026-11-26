"use client";
// 인테리어 받기 · 기본 정보 고치기(#192, 2026-11-25 회의 · 멘토 피드백): 채팅 없는 단계 카드 화면(성민 v4 폼 카드 모양).
// - 단계 띠: 우리 집 → 원하는 공사 → 표준견적서. 카드 하나씩 [다음]으로 넘기고, 지난 카드는 한 줄 요약 + [고치기].
// - 칸은 dev 백엔드에 있는 것만: 지역 · 면적(공급 | 전용, ㎡ | 평) · 공사할 때 집 · 벽지 · 도배 범위 · 희망 시기.
//   방 개수 · 철거 범위는 DB 칸이 없어 두지 않아요. 예산은 고치기에서 저장된 값을 그대로 넘겨요(이 화면에서 묻지 않아요).
// - 원하는 공사에서 공정을 골라요(#193): 도배(꼭) · 목공(할 곳 하나 이상) · 바닥(마루)은 '준비 중' 틀만(서버로 보내지 않아요).
//   공사 순서는 목공 → 도배 → 바닥이에요(표준견적서 순서 띠와 같아요).
// - 칸 이름 옆 '?'는 백과 용어 사전의 쉬운 말(HelpTip)이에요.
// - 손님: 답은 이 기기에만(mj_guest_v3) → /start/standard. 로그인한 고객: POST /projects → 재재 화면(/projects/{id}/assistant).
// - 고치기(mode=edit): 같은 카드, 마지막 단추가 저장(PATCH /projects/{id}) → 재재 화면.
// - 금액은 서버 계산 엔진이 세요. 여기서는 평 → ㎡ 넣기 도움만 해요.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Main, PageHead, type Crumb } from "@/components/site/Frame";
import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChip";
import { Field } from "@/components/ui/Field";
import { HelpTip } from "@/components/ui/HelpTip";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import type { Region } from "@/lib/api/project";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { dateShort } from "@/lib/format";
import { EMPTY_DRAFT, FACES, GRADE_WORD, MOK_ITEMS, SPACES, checkDraft, placeText, pyeongToM2, scopeText, toHomeInfo, type Face, type InfoDraft, type InfoErrors, type MokItem, type SpaceKind } from "@/lib/guest/info";
import { clearGuest, draftOf, readGuest, writeGuest } from "@/lib/guest/store";
import { termByName, termHref } from "@/lib/guide";
import { DateSheet } from "./DateSheet";
import { RegionSheet } from "./RegionSheet";
import s from "./StepForm.module.css";

export type StepMode = "guest" | "member" | "edit";
type Step = "home" | "work";
const STEPS = ["우리 집", "원하는 공사", "표준견적서"] as const;
const KEYS: Record<Step, (keyof InfoErrors)[]> = { home: ["region", "area", "occupied"], work: ["grade", "spaces", "faces", "mokgong"] };
const errorsIn = (e: InfoErrors, step: Step): InfoErrors => Object.fromEntries(KEYS[step].filter((k) => e[k]).map((k) => [k, e[k]]));

/** 백과 용어 쉬운 말 '?'(용어가 사전에 없으면 note만) */
function Tip({ label, terms, note }: { label: string; terms: string[]; note?: string }) {
  const list = terms.map((n) => termByName(n)).filter((t) => t !== undefined);
  if (!list.length && !note) return null;
  return (
    <HelpTip label={`${label} 설명`}>
      {list.map((t) => (
        <span key={t.id} className={s.tip}><b>{t.term}</b> {t.easy} <Link href={termHref(t)} target="_blank">자세히</Link></span>
      ))}
      {note ? <span className={s.tip}>{note}</span> : null}
    </HelpTip>
  );
}

export function StepForm({ regions, today, mode, projectId, initial, mock, crumbs }: {
  regions: Region[];
  today: string;
  mode: StepMode;
  projectId?: string;
  initial?: InfoDraft;
  mock: boolean;
  crumbs: Crumb[];
}) {
  const router = useRouter();
  const [d, setD] = useState<InfoDraft>(initial ?? EMPTY_DRAFT);
  const [step, setStep] = useState<Step>("home");
  const [tried, setTried] = useState<Record<Step, boolean>>({ home: false, work: false });
  const [ready, setReady] = useState(mode === "edit");
  const [dirty, setDirty] = useState(false);
  const [unit, setUnit] = useState<"m2" | "py">("m2");
  const [py, setPy] = useState("");
  const [sheet, setSheet] = useState<null | "region" | "date">(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const head = useRef<HTMLHeadingElement>(null);

  // 이 기기에 둔 답을 이어 채워요(고치기는 그 공사 값)
  useEffect(() => {
    if (mode === "edit") return;
    const g = readGuest();
    if (g) setD(draftOf(g));
    setReady(true);
  }, [mode]);
  // 손님 · 새 공사는 바꿀 때마다 이 기기에 둬요(백과 '자세히'를 보고 와도 이어져요)
  useEffect(() => { if (ready && dirty && mode !== "edit") writeGuest(d); }, [d, ready, dirty, mode]);
  // 카드를 넘기면 그 카드 제목에 초점(화면 읽기 프로그램이 새 카드를 읽어요)
  useEffect(() => { head.current?.focus({ preventScroll: false }); }, [step]);

  const set = (patch: Partial<InfoDraft>) => { setD((p) => ({ ...p, ...patch })); setDirty(true); setFormErr(null); };
  const all = checkDraft(d);
  const eHome = tried.home ? errorsIn(all, "home") : {};
  const eWork = tried.work ? errorsIn(all, "work") : {};
  const place = placeText(regions, d);
  const areaM2 = unit === "py" ? pyeongToM2(py) : null;
  // 비었을 때 공용 글은 '평으로 넣기' 단추를 말해서, 이 화면의 ㎡ | 평 칸에 맞춰 바꿔요
  const areaErr = !eHome.area ? undefined
    : unit === "py" && !areaM2 ? "평을 숫자로 넣어 주세요. 예: 32"
    : !d.area.trim() ? "면적을 넣어 주세요. 평으로 알면 오른쪽 '평'을 눌러요."
    : eHome.area;

  function setArea(v: string) {
    if (unit === "m2") { set({ area: v }); return; }
    setPy(v);
    set({ area: pyeongToM2(v) ?? "" });
  }
  function switchUnit(v: string) {
    const next = v === "py" ? "py" : "m2";
    if (next === unit) return;
    if (next === "py") { const n = Number(d.area); setPy(d.area && Number.isFinite(n) ? String(Math.round(n / 3.3058)) : ""); }
    setUnit(next);
  }

  function nextHome() {
    setTried((x) => ({ ...x, home: true }));
    if (Object.keys(errorsIn(checkDraft(d), "home")).length) return;
    setStep("work");
  }

  async function finish() {
    setTried((x) => ({ ...x, work: true }));
    if (busy || Object.keys(errorsIn(checkDraft(d), "work")).length) return;
    if (Object.keys(errorsIn(checkDraft(d), "home")).length) { setTried({ home: true, work: true }); setStep("home"); return; }
    if (mode === "guest") {
      writeGuest(d);
      router.push("/start/standard");
      return;
    }
    setBusy(true);
    setFormErr(null);
    try {
      if (mode === "edit" && projectId) {
        if (!mock) await call("PATCH", `/projects/${encodeURIComponent(projectId)}`, toHomeInfo(d));
        router.push(`/projects/${encodeURIComponent(projectId)}/assistant`);
        router.refresh();
        return;
      }
      const g = writeGuest(d);
      if (mock) {
        const { MOCK_PROJECT } = await import("@/lib/mock/v3a/mode");
        clearGuest();
        router.push(`/projects/${d.scope === "partial" ? MOCK_PROJECT.part : MOCK_PROJECT.full}/standard`);
        return;
      }
      const p = await call<Schemas["ProjectOut"]>("POST", "/projects", toHomeInfo(d), { "Idempotency-Key": g.key });
      clearGuest();
      // 기본 정보를 받은 뒤부터 재재와 대화해요(2026-11-25 회의). 표준견적서는 그 화면에서 바로 열려요
      router.push(`/projects/${encodeURIComponent(p.id)}/assistant?open=standard`);
    } catch (er) {
      setFormErr(errorText(er));
      setBusy(false);
    }
  }

  const homeLine = [place || "지역", d.area ? `${d.basis === "exclusive" ? "전용" : "공급"} ${d.area}㎡` : null, d.occupied === null ? null : d.occupied ? "살면서 공사" : "빈 집"].filter(Boolean).join(" · ");
  const doneLabel = mode === "edit" ? "저장하고 돌아가기" : busy ? "내 공사를 만들고 있어요" : "표준견적서 보기";
  const nWork = Object.keys(eWork).length;
  const nHome = Object.keys(eHome).length;

  return (
    <>
      <Main narrow>
        <PageHead title={mode === "edit" ? "기본 정보 고치기" : "인테리어 받기"} crumbs={crumbs} />
        <ol className={s.steps} aria-label="인테리어 받기 단계">
          {STEPS.map((label, i) => {
            const now = step === "home" ? 0 : 1;
            return <li key={label} className={i < now ? s.done : i === now ? s.now : s.later} aria-current={i === now ? "step" : undefined}>{label}</li>;
          })}
        </ol>

        {step === "work" ? (
          <section className={`${s.card} ${s.past}`} aria-label="우리 집 요약">
            <div className={s.top}><h2>우리 집</h2><Button variant="text" onClick={() => setStep("home")}>고치기</Button></div>
            <p className={s.line}>{homeLine}</p>
          </section>
        ) : null}

        {step === "home" ? (
          <section className={s.card} aria-labelledby="sf-home">
            <div className={s.top}><h2 id="sf-home" ref={head} tabIndex={-1}>우리 집</h2><span className={s.mute}>아파트</span></div>
            <Row label="지역" error={eHome.region}>
              <button type="button" className={eHome.region ? `${s.pick} ${s.bad}` : s.pick} aria-label={`지역 ${place || "고르기"}`} onClick={() => setSheet("region")}>
                <span className={place ? undefined : s.ph}>{place || "지역 고르기"}</span><Icon name="chevron-down" size={18} />
              </button>
            </Row>
            <Row label="면적" help={<Tip label="면적" terms={["공급면적", "전용면적"]} />} error={areaErr}>
              <Segmented legend="면적 기준" hideLegend value={d.basis} onChange={(v) => set({ basis: v === "exclusive" ? "exclusive" : "supply" })}
                options={[{ value: "supply", label: "공급면적" }, { value: "exclusive", label: "전용면적" }]} />
              <div className={s.area}>
                <Field id="sf-area" label={`${d.basis === "exclusive" ? "전용" : "공급"}면적(${unit === "py" ? "평" : "㎡"})`} hideLabel num maxLength={8}
                  unit={unit === "py" ? "평" : "㎡"} value={unit === "py" ? py : d.area} onChange={(e) => setArea(e.target.value)} />
                <Segmented legend="면적 단위" hideLegend value={unit} onChange={switchUnit} options={[{ value: "m2", label: "㎡" }, { value: "py", label: "평" }]} />
              </div>
              {areaM2 ? <p className={s.mute}>믿집 계산 {py.trim()}평 × 3.3058 = <b className="mj-num">{areaM2}㎡</b></p> : null}
            </Row>
            <Row label="공사할 때 집" error={eHome.occupied}>
              <ChoiceChips legend="공사할 때 집" hideLegend value={d.occupied === null ? null : d.occupied ? "yes" : "no"} onChange={(v) => set({ occupied: v === "yes" })}
                options={[{ value: "yes", label: "살면서 공사" }, { value: "no", label: "빈 집" }]} />
            </Row>
            {nHome ? <p className={s.err} role="alert">고를 칸이 {nHome}개 있어요</p> : null}
            <div className={s.actions}><Button size="lg" onClick={nextHome}>다음</Button></div>
          </section>
        ) : (
          <section className={s.card} aria-labelledby="sf-work">
            <div className={s.top}><h2 id="sf-work" ref={head} tabIndex={-1}>원하는 공사</h2><span className={s.mute}>아파트</span></div>
            <Row label="공정" help={<Tip label="공정" terms={["걸레받이", "문선"]} note="목공은 몰딩 · 걸레받이 · 문처럼 나무로 마감하는 일이에요. 목공을 먼저 하고 도배를 해요." />} error={eWork.mokgong}>
              <div className={s.chips} role="group" aria-label="공정 고르기">
                {/* 공사 순서대로 목공 → 도배 → 바닥(2026-11-26 사용자) */}
                <button type="button" className={s.chip} aria-pressed={d.mok} onClick={() => set({ mok: !d.mok })}>목공</button>
                <button type="button" className={s.chip} aria-pressed disabled>도배</button>
                <button type="button" className={s.chip} aria-pressed={false} disabled aria-describedby="sf-floor">바닥(마루) <span className={s.soon}>준비 중</span></button>
              </div>
              {d.mok ? (
                <ChoiceChips multiple legend="목공 할 곳" value={d.mokgong} onChange={(v) => set({ mokgong: v as MokItem[] })} options={MOK_ITEMS.map((x) => ({ value: x.key, label: x.label }))} />
              ) : null}
              <p id="sf-floor" className={s.mute}>바닥(마루)은 준비 중이에요. 마루 종류 · 기존 바닥 철거는 곧 여기서 골라요.</p>
              {d.mok ? <p className={s.order} aria-label="공사 순서">공사 순서 <b>목공</b> → <b>도배</b> → <span>바닥</span></p> : null}
            </Row>
            <Row label="벽지" help={<Tip label="벽지" terms={["실크 벽지", "합지"]} />} error={eWork.grade}>
              <ChoiceChips legend="벽지" hideLegend value={d.grade} onChange={(v) => set({ grade: v as InfoDraft["grade"] })}
                options={[{ value: "basic", label: GRADE_WORD.basic }, { value: "economy", label: GRADE_WORD.economy }]} />
            </Row>
            <Row label="도배 범위" help={<Tip label="도배 범위" terms={[]} note="전체는 집 안 벽 + 천장이에요. 방 몇 개나 벽만 하려면 부분을 골라요." />}>
              <Segmented legend="도배 범위" hideLegend value={d.scope} onChange={(v) => set(v === "partial" ? { scope: "partial" } : { scope: "full", spaces: [], faces: ["wall", "ceiling"] })}
                options={[{ value: "full", label: "전체" }, { value: "partial", label: "부분" }]} />
              {d.scope === "partial" ? (
                <div className={s.part}>
                  <ChoiceChips multiple legend="공간" value={d.spaces} error={eWork.spaces} onChange={(v) => set({ spaces: v as SpaceKind[] })} options={SPACES.map((x) => ({ value: x.key, label: x.label }))} />
                  <ChoiceChips multiple legend="면" value={d.faces} error={eWork.faces} onChange={(v) => set({ faces: v as Face[] })} options={FACES.map((x) => ({ value: x.key, label: x.label }))} />
                </div>
              ) : null}
            </Row>
            <Row label="희망 시기">
              <div className={s.chips}>
                <button type="button" className={s.chip} aria-pressed={!d.start} onClick={() => set({ start: null })}>아직 몰라요</button>
                <button type="button" className={s.chip} aria-pressed={!!d.start} onClick={() => setSheet("date")}>{d.start ? `${dateShort(d.start, today)} 시작` : "날짜 고르기"}</button>
              </div>
            </Row>
            {formErr ? <p className={s.err} role="alert">{formErr}</p> : null}
            {nWork ? <p className={s.err} role="alert">고를 칸이 {nWork}개 있어요</p> : null}
            <p className={s.mute}>{d.grade ? `도배 ${GRADE_WORD[d.grade]} · ${scopeText(d)}${d.mok && d.mokgong.length ? ` + 목공 ${d.mokgong.map((k) => MOK_ITEMS.find((x) => x.key === k)?.label).join(" · ")}` : ""}` : "벽지를 고르면 표준견적서를 계산해요"}</p>
            <div className={s.actions}>
              <Button size="lg" variant="secondary" disabled={busy} onClick={() => setStep("home")}>이전</Button>
              <Button size="lg" busy={busy} onClick={() => { void finish(); }}>{doneLabel}</Button>
            </div>
          </section>
        )}
      </Main>

      <RegionSheet open={sheet === "region"} regions={regions} value={{ sido: d.sido, sgg: d.sgg }} onClose={() => setSheet(null)} onApply={(p) => { set({ ...p, emd: "" }); setSheet(null); }} />
      <DateSheet open={sheet === "date"} value={d.start} today={today} onClose={() => setSheet(null)} onApply={(day) => { set({ start: day }); setSheet(null); }} />
    </>
  );
}

function Row({ label, help, error, children }: { label: string; help?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <span className={s.lbl}>{label}{help}</span>
      {children}
      {error ? <span className={s.fieldErr}><Icon name="error" size={16} />{error}</span> : null}
    </div>
  );
}
