"use client";
// /assistant 시작(시연 영상 1~10장면): 재재가 묻고 → 한 줄로 집 정보를 채우고 → 빈 칸은 단추로 묻고 → 확인하면 대화 안에 표준견적서 →
// 업체 보기로 이어가요. 위 칩 · 오른쪽 플랜 1단계 폼으로 언제든 고쳐요.
// - 로그인 전 손님도 쓰는 화면이라 서버 AI를 부르지 않아요(AI는 로그인한 고객만). 말은 규칙(readLine)으로 값만 읽어요.
// - 금액은 POST /guest/standard(계산 엔진) 값 그대로예요. 화면은 계산하지 않아요.
// - 업체부터는 공사가 있어야 해서: 로그인한 고객은 답으로 공사를 만들고(POST /projects, 손님 답 옮기기와 같은 길) /projects/{id}/assistant로,
//   손님은 답을 이 기기에 두고 가입 → 같은 화면으로 돌아와요.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChip";
import { QuoteLines } from "@/components/ui/QuoteLines";
import { START_SAY_KEY, readLine } from "@/components/start/StartChat";
import type { Region } from "@/lib/api/project";
import { errorText } from "@/lib/backend/client";
import { calcGuest, moveGuest, type GuestStandard } from "@/lib/guest/api";
import { EMPTY_DRAFT, FACES, SPACES, checkDraft, placeText, pyeongToM2, scopeText, toHomeInfo, type Face, type InfoDraft, type SpaceKind } from "@/lib/guest/info";
import { toQuoteLines } from "@/lib/guest/standard";
import { draftOf, readGuest, writeGuest } from "@/lib/guest/store";
import { won } from "@/lib/format";
import { Jaejae } from "./Jaejae";
import { Plan } from "./Plan";
import s from "./flow.module.css";

type Pick = "region" | "area" | "occupied" | "grade" | "spaces" | "start";
type Msg = { id: number; who: "bot" | "me"; node: ReactNode };
const PY = ["18", "24", "32", "40"];
const toPy = (m2: string) => (m2 ? `${Math.round(Number(m2) / 3.3058)}평` : "");

/** 면적 글: 공급은 평(㎡), 전용은 ㎡만(공급 평으로 바꾸지 않아요) */
const areaText = (x: Partial<InfoDraft>) => (x.basis === "exclusive" ? `전용 ${x.area}㎡` : `${toPy(x.area ?? "")}(공급 ${x.area}㎡)`);

export function StartFlow({ regions, today, member, mock }: { regions: Region[]; today: string; member: boolean; mock: boolean }) {
  const router = useRouter();
  const [d, setD] = useState<InfoDraft>(EMPTY_DRAFT);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [std, setStd] = useState<GuestStandard | null>(null);
  // 대화에 들어간 단추는 만든 때의 값을 붙잡아요. 지금 표준견적서는 ref로 읽어요
  const stdRef = useRef<GuestStandard | null>(null);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const dRef = useRef(d);
  // 말한 시작일을 넣지 못함(2월 31일 · 지난 날). 다시 말하거나 '날짜 없이'를 고를 때까지 견적으로 넘어가지 않아요
  const badStart = useRef(false);
  const setBadStart = (v: boolean) => { badStart.current = v; };
  dRef.current = d;
  const end = useRef<HTMLDivElement>(null);

  const add = (who: Msg["who"], node: ReactNode) => setMsgs((m) => [...m, { id: ++seq.current, who, node }]);
  const say = (node: ReactNode, ms = 450) => new Promise<void>((r) => setTimeout(() => { add("bot", node); r(); }, ms));
  const set = (p: Partial<InfoDraft>) => setD((x) => { const n = { ...x, ...p }; writeGuest(n); return n; });

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs]);

  // 처음: 인사 → 홈 한 줄(있으면) 또는 이 기기에 둔 답으로 이어가기
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const g = readGuest();
    const saved = g ? draftOf(g) : null;
    let first = "";
    try { first = window.sessionStorage.getItem(START_SAY_KEY) ?? ""; window.sessionStorage.removeItem(START_SAY_KEY); } catch { /* 없으면 인사부터 */ }
    void (async () => {
      await say(<><p>안녕하세요, 믿집 비서 <b>재재</b>예요. 도배를 처음부터 끝까지 같이 챙길게요.</p><p>어떤 집을 도배하려고 하세요? 한 줄로 적어 주시면 위 칸과 오른쪽 플랜을 채워 드려요.</p></>, 200);
      if (first) { take(first, saved ?? EMPTY_DRAFT); return; }
      if (saved && (saved.sgg || saved.area)) { setD(saved); await next(saved, "앞에서 적던 내용을 이어서 채웠어요. "); return; }
      add("bot", <div className={s.row}><Button size="sm" variant="weak" onClick={() => setText("노원구 24평 아파트 도배하려고요. 지금 살고 있어요")}>예시 문장 넣기</Button></div>);
    })();
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filled(p: Partial<InfoDraft>): string {
    const out: string[] = [];
    if (p.sgg) out.push(placeText(regions, { sido: p.sido ?? "", sgg: p.sgg }));
    if (p.area) out.push(areaText(p));
    if (p.occupied != null) out.push(p.occupied ? "살면서 공사" : "빈 집");
    if (p.grade) out.push(p.grade === "basic" ? "실크 벽지" : "합지 벽지");
    if (p.scope === "partial") out.push("부분 도배");
    if (p.budget) out.push(`예산 ${p.budget}만 원`);
    if (p.start) out.push(`${Number(p.start.slice(5, 7))}월 ${Number(p.start.slice(8, 10))}일 시작 희망`);
    return out.join(" · ");
  }

  function missing(x: InfoDraft): Pick | null {
    // 부분 공사는 고른 공간만 계산해서, 공간 · 면이 없으면 서버가 받지 않아요
    const part = x.scope === "partial" && (!x.spaces.length || !x.faces.length);
    // 면적은 있어도 범위 밖(10㎡ 이하 · 400㎡ 이상)이면 다시 물어요
    return !x.sgg ? "region" : !x.area || checkDraft(x).area ? "area" : x.occupied == null ? "occupied" : !x.grade ? "grade" : part ? "spaces" : badStart.current ? "start" : null;
  }

  async function next(x: InfoDraft, lead = "") {
    const m = missing(x);
    if (m === "region") return say(<p>{lead}어느 지역이에요? 구 이름으로 적어 주세요. 예: 노원구</p>);
    if (m === "area") return say(<><p>{lead}{x.area ? `${checkDraft(x).area} ` : ""}몇 평이에요? 분양 면적(공급) 기준으로 골라 주세요.</p>
      <div className={s.row}>{PY.map((n) => <Button key={n} size="sm" variant="weak" onClick={() => pick(`${n}평`, { area: pyeongToM2(n) ?? "", basis: "supply" })}>{n}평</Button>)}</div></>);
    if (m === "occupied") return say(<><p>{lead}공사하는 동안 집에 살고 계세요? 짐이 있으면 가구 이동 · 보양이 더 들어요.</p>
      <div className={s.row}><Button size="sm" variant="weak" onClick={() => pick("살고 있어요", { occupied: true })}>살고 있어요</Button><Button size="sm" variant="weak" onClick={() => pick("비어 있어요", { occupied: false })}>비어 있어요</Button></div></>);
    if (m === "grade") return say(<><p>{lead}도배 유형을 골라 주세요. 벽지 종류에 따라 금액이 가장 크게 달라져요.</p>
      <p className={s.why}>실크: 겉에 비닐 막이 있어 물걸레질이 되고 이음매가 덜 보여요. 합지: 종이라 값이 싸고 이음매가 보일 수 있어요.</p>
      <div className={s.row}><Button size="sm" variant="weak" onClick={() => pick("기본형 (실크)", { grade: "basic" })}>기본형 (실크)</Button><Button size="sm" variant="weak" onClick={() => pick("저가형 (합지)", { grade: "economy" })}>저가형 (합지)</Button><Button size="sm" variant="secondary" onClick={() => pick("잘 모르겠어요", { grade: "basic" })}>잘 모르겠어요</Button></div></>);
    if (m === "start") return say(<><p>{lead}시작 희망일을 다시 말해 주세요. 예: 12월 5일부터. 아직 정하지 않았으면 날짜 없이 견적을 볼 수 있어요.</p>
      <div className={s.row}><Button size="sm" variant="weak" onClick={() => { add("me", "날짜 없이 할래요"); setBadStart(false); set({ start: null }); void next({ ...dRef.current, start: null }); }}>날짜 없이 할래요</Button></div></>);
    if (m === "spaces") return say(<><p>{lead}부분 도배는 고른 공간만 계산해요. 어느 공간의 어느 면을 할지 골라 주세요.</p>
      <SpacePick start={x} onDone={(p) => pick(p.scope === "full" ? "전체로 할래요" : scopeText({ scope: "partial", spaces: p.spaces ?? [], faces: p.faces ?? [] }), p)} /></>);
    return confirm(x, lead);
  }

  async function confirm(x: InfoDraft, lead = "") {
    const bad = Object.values(checkDraft(x)).filter(Boolean);
    await say(<><p>{lead}이 조건이 맞나요?</p>
      <div className={s.card}>
        <div className={s.kv}><span>집</span><b>아파트 · {placeText(regions, x)}</b></div>
        <div className={s.kv}><span>평형</span><b>{areaText(x)}</b></div>
        <div className={s.kv}><span>공정</span><b>도배 {x.scope === "partial" ? scopeText(x) : "전체"}</b></div>
        <div className={s.kv}><span>거주</span><b>{x.occupied ? "살면서 공사" : "빈 집"}</b></div>
        <div className={s.kv}><span>도배 유형</span><b>{x.grade === "economy" ? "저가형 (합지)" : "기본형 (실크)"}</b></div>
        {bad.length ? <p className={s.note}>{bad.join(" · ")}</p> : null}
      </div>
      <div className={s.row}><Button size="sm" onClick={() => { add("me", "맞아요"); const cur = dRef.current; if (missing(cur) || Object.values(checkDraft(cur)).some(Boolean)) { void next(cur, "고칠 칸이 있어요. "); return; } void quote(cur); }}>맞아요, 견적 볼게요</Button><Button size="sm" variant="secondary" onClick={() => { add("me", "고칠래요"); setOpen(true); void say(<p>위 칩이나 오른쪽 플랜 1단계에서 고쳐 주세요. 고친 뒤 &quot;다 고쳤어요&quot;라고 말해 주세요.</p>); }}>고칠래요</Button></div></>);
  }

  async function quote(x: InfoDraft, compare = false) {
    if (busyRef.current) return;
    // 틀린 칸(범위 밖 면적 등)이 있으면 계산하지 않고 그 칸부터 다시 물어요
    const bad = Object.values(checkDraft(x)).filter(Boolean);
    if (badStart.current) bad.push("시작 희망일을 다시 말해 주세요.");
    if (bad.length) { void say(<p>견적을 내기 전에 고칠 칸이 있어요. {bad.join(" ")}</p>); return; }
    busyRef.current = true;
    setBusy(true);
    try {
      const got = await calcGuest(toHomeInfo(x), mock);
      const base = stdRef.current;
      if (!compare) { setStd(got); stdRef.current = got; }
      if (compare && base) {
        await say(<><div className={s.two}>
          <div className={s.card}><h4>{x.grade === "economy" ? "기본형 (실크)" : "저가형 (합지)"}</h4><b className="mj-num">{won(base.total)}</b></div>
          <div className={s.card}><h4>{x.grade === "economy" ? "저가형 (합지)" : "기본형 (실크)"}</h4><b className="mj-num">{won(got.total)}</b></div></div>
          <p>두 금액의 차이는 대부분 벽지값에서 나요.</p>
          <div className={s.row}><Button size="sm" onClick={() => { add("me", "업체 볼게요"); void vendors(); }}>그대로 업체 볼게요</Button></div></>);
        return;
      }
      await say(<><p><b>표준견적서</b>가 나왔어요. 공공 기준 단가로 믿집이 계산한 참고 금액이에요. 업체 견적이 아니에요.</p>
        <div className={s.card}>
          <h4>표준견적서 · {toPy(x.area)} {x.grade === "economy" ? "합지" : "실크"}{x.scope === "partial" ? ` · ${scopeText(x)}` : ""}</h4>
          <div className={`${s.big} mj-num`}>{won(got.total)}</div>
          <QuoteLines caption="표준견적서 줄" lines={toQuoteLines(got.lines, got.scope)} totals={{ supply: got.supply, vat: got.vat, total: got.total }} vatSplit />
        </div>
        <p className={s.why}>업체를 만나기 전에 기준 금액을 알아 두면, 업체 견적이 비싼지 싼지 스스로 볼 수 있어요.</p>
        <div className={s.row}>
          <Button size="sm" variant="weak" onClick={() => { add("me", "다른 유형과 비교해 주세요"); void quote({ ...x, grade: x.grade === "economy" ? "basic" : "economy" }, true); }}>{x.grade === "economy" ? "기본형(실크)" : "저가형(합지)"}과 비교</Button>
          <Button size="sm" onClick={() => { add("me", "업체 볼게요"); void vendors(); }}>업체 보러 가기</Button>
        </div></>, 600);
    } catch (e) {
      await say(<p>표준견적서를 계산하지 못했어요. {errorText(e)}</p>);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function vendors() {
    if (busyRef.current) return; // 두 번 눌러 공사가 둘 생기지 않게
    writeGuest(dRef.current);
    if (!member) {
      await say(<><p>업체 가견적과 실측 요청은 <b>가입 · 로그인</b>한 뒤에 이어져요. 지금까지 적은 내용은 그대로 가져가요.</p>
        <div className={s.row}><Button size="sm" href="/signup?next=/assistant">가입하고 이어가기</Button><Button size="sm" variant="secondary" href="/login?next=/assistant">로그인</Button></div></>);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const p = await moveGuest(mock);
      if (!p) throw new Error("옮길 답이 없어요");
      await say(<p>내 공사를 만들었어요. 업체 단계로 넘어갈게요.</p>, 200);
      router.push(`/projects/${encodeURIComponent(p.id)}/assistant`);
    } catch (e) {
      await say(<p>공사를 만들지 못했어요. {errorText(e)}</p>);
      busyRef.current = false;
      setBusy(false);
    }
  }

  function pick(label: string, p: Partial<InfoDraft>) {
    add("me", label);
    const n = { ...dRef.current, ...p };
    set(p);
    void next(n, "");
  }

  function take(t: string, base: InfoDraft) {
    const p = readLine(t, regions, today);
    add("me", t);
    // 시작일을 말했는데 못 넣었으면(2월 31일처럼 없는 날 · 지난 날) 알려요
    const badDay = !p.start && /\d{1,2}\s*(?:월|\/)\s*\d{1,2}\s*일?\s*(?:부터|시작|에|쯤|경)/.test(t) ? "말씀하신 시작일은 달력에 없거나 지난 날이라 넣지 않았어요. " : "";
    if (p.start) setBadStart(false);
    else if (badDay) setBadStart(true);
    if (!Object.keys(p).length) {
      if (badDay) { void next(base, badDay); return; } // 없는 날짜만 말했으면 시작일부터 다시 물어요
      if (/다\s*고쳤|됐어|확인|맞아요|맞습니다|^네\b|^네요?$/.test(t.trim())) { void next(base); return; } // 빈 칸이 남았으면 그것부터 다시 물어요
      void say(<p>{badDay || <>제가 읽을 수 있는 값이 없었어요. &quot;노원구 24평 아파트, 살고 있어요&quot;처럼 적거나 위 칩을 눌러 고쳐 주세요.</>}</p>);
      return;
    }
    const n = { ...base, ...p };
    setD(n);
    writeGuest(n);
    void next(n, `위 칸에 넣었어요: ${filled(p)}. ${badDay}`);
  }

  function send() {
    const v = text.trim();
    if (!v) return;
    setText("");
    take(v, dRef.current);
  }

  const chips: [string, string][] = [
    ["집", "아파트"],
    ["지역", d.sgg ? placeText(regions, d) : ""],
    ["평형", d.area ? areaText(d) : ""],
    ["공정", `도배 ${d.scope === "partial" ? "부분" : "전체"}`],
    ["거주", d.occupied == null ? "" : d.occupied ? "살고 있어요" : "빈 집"],
    ["도배 유형", d.grade ? (d.grade === "basic" ? "기본형" : "저가형") : ""],
  ];
  const now = std ? 2 : 1 - (missing(d) ? 1 : 0);

  return (
    <div className={s.page}>
      <div className={s.chips} aria-label="모은 조건 · 누르면 고쳐요">
        {chips.map(([k, v]) => <button key={k} type="button" className={`${s.chip} ${v ? s.chipOn : s.chipEmpty}`} onClick={() => setOpen(true)}>{k}<b>{v || "아직 몰라요"}</b></button>)}
      </div>
      <button type="button" className={s.planBar} aria-expanded={open} onClick={() => setOpen((v) => !v)}><b>{Math.min(now + 1, 8)}/8 · 내 도배 플랜</b><span>{open ? "접기" : "보기"}</span></button>
      <div className={s.body}>
        <section className={s.chat} aria-label="재재와 대화">
          <div className={s.msgs} role="log" aria-live="polite">
            {msgs.map((m) => m.who === "me"
              ? <p key={m.id} className={s.me}>{m.node}</p>
              : <div key={m.id} className={s.bot}><div className={s.face}><Jaejae /></div><div className={s.bubble}><span className={s.who}>재재 · 믿집 비서</span>{m.node}</div></div>)}
            <div ref={end} />
          </div>
          <form className={s.input} onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="mj-sr" htmlFor="flow-in">재재에게 보낼 말</label>
            <textarea id="flow-in" rows={1} maxLength={300} value={text} placeholder="재재에게 말해 보세요" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            <Button type="submit" disabled={!text.trim() || busy}>보내기</Button>
          </form>
        </section>
        <Plan now={now} scope="guest" open={open}
          auto={{ 0: [d.sgg ? "지역 정리" : "", d.area ? "평형 정리" : ""].filter(Boolean), 1: std ? ["표준견적서 계산"] : [] }}
          render={(step) => step === 0 ? (
            <>
              <label className={s.field}>평형(공급)
                <select value={d.area ? String(Math.round(Number(d.area) / 3.3058)) : ""} onChange={(e) => set({ area: pyeongToM2(e.target.value) ?? "", basis: "supply" })}>
                  <option value="">골라 주세요</option>
                  {Array.from({ length: 36 }, (_, i) => String(i + 15)).map((n) => <option key={n} value={n}>{n}평</option>)}
                </select>
              </label>
              <label className={s.field}>거주
                <select value={d.occupied == null ? "" : d.occupied ? "y" : "n"} onChange={(e) => set({ occupied: e.target.value === "" ? null : e.target.value === "y" })}>
                  <option value="">골라 주세요</option><option value="y">살고 있어요</option><option value="n">비어 있어요</option>
                </select>
              </label>
              <ChoiceChips legend="공사 범위" value={d.scope} onChange={(v) => set(v === "partial" ? { scope: "partial" } : { scope: "full", spaces: [], faces: ["wall", "ceiling"] })}
                options={[{ value: "full", label: "전체" }, { value: "partial", label: "부분" }]} />
              {d.scope === "partial" ? (
                <>
                  <ChoiceChips multiple legend="공간" value={d.spaces} onChange={(v) => set({ spaces: v as SpaceKind[] })} options={SPACES.map((x) => ({ value: x.key, label: x.label }))} />
                  <ChoiceChips multiple legend="면" value={d.faces} onChange={(v) => set({ faces: v as Face[] })} options={FACES.map((x) => ({ value: x.key, label: x.label }))} />
                </>
              ) : null}
              <label className={s.field}>도배 유형
                <select value={d.grade ?? ""} onChange={(e) => set({ grade: (e.target.value || null) as InfoDraft["grade"] })}>
                  <option value="">골라 주세요</option><option value="basic">기본형 (실크)</option><option value="economy">저가형 (합지)</option>
                </select>
              </label>
              <p className={s.note}>지역 · 예산 · 시작 희망일은 대화로 말하거나 <a href="/start">자세한 폼</a>에서 고쳐요.</p>
            </>
          ) : step === 1 && std ? (
            <div className={s.card}><h4>표준견적서</h4><b className="mj-num">{won(std.total)}</b><span className={s.note}>부가세 포함 · 업체 견적이 아니에요</span></div>
          ) : null} />
      </div>
    </div>
  );
}

/** 부분 도배 공간 · 면 고르기(대화 안 카드). 둘 다 하나 이상 골라야 넘어가요. 한 번 고르면 이 카드는 잠가요 */
function SpacePick({ start, onDone }: { start: InfoDraft; onDone: (p: Partial<InfoDraft>) => void }) {
  const [spaces, setSpaces] = useState<SpaceKind[]>(start.spaces);
  const [faces, setFaces] = useState<Face[]>(start.faces.length ? start.faces : ["wall", "ceiling"]);
  const [done, setDone] = useState(false);
  const finish = (p: Partial<InfoDraft>) => { if (done) return; setDone(true); onDone(p); };
  return (
    <div className={s.card}>
      <ChoiceChips multiple legend="공간" value={spaces} onChange={(v) => setSpaces(v as SpaceKind[])} options={SPACES.map((x) => ({ value: x.key, label: x.label, disabled: done }))} />
      <ChoiceChips multiple legend="면" value={faces} onChange={(v) => setFaces(v as Face[])} options={FACES.map((x) => ({ value: x.key, label: x.label, disabled: done }))} />
      <div className={s.row}>
        <Button size="sm" disabled={done || !spaces.length || !faces.length} onClick={() => finish({ scope: "partial", spaces, faces })}>골랐어요</Button>
        <Button size="sm" variant="secondary" disabled={done} onClick={() => finish({ scope: "full", spaces: [], faces: ["wall", "ceiling"] })}>전체로 할래요</Button>
      </div>
    </div>
  );
}
