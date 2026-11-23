"use client";
// 표준견적서 받기 왼쪽 '재재와 대화'(시연 피드백 11-20 · 11-23): 한 줄로 말하면 오른쪽 폼 칸을 대신 채우고,
// 빈 칸은 하나씩 단추로 물어요. 고친 값은 오른쪽 폼에서 그대로 바꿀 수 있어요.
// - 로그인 전 손님도 쓰는 화면이라 서버 AI를 부르지 않아요(AI는 로그인한 고객만, security-02 8). 규칙으로 값만 읽어요.
// - 금액은 만들지 않아요. 표준견적서 금액은 '표준견적서 보기'를 누른 뒤 서버 계산 엔진이 만들어요.
// - 저장 · 다음 단계는 오른쪽 '표준견적서 보기'를 사람이 눌러요.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Region } from "@/lib/api/project";
import { placeText, pyeongToM2, type InfoDraft } from "@/lib/guest/info";
import s from "./chat.module.css";

type Msg = { who: "bot" | "me"; text: string; pick?: Pick };
type Pick = "region" | "area" | "occupied" | "grade";

const HELLO = "안녕하세요, 믿집 비서 재재예요. 어떤 집을 도배하려고 하세요? 한 줄로 적어 주시면 오른쪽 칸을 채워 드릴게요.";
const EXAMPLE = "노원구 24평 아파트 도배하려고요. 지금 살고 있어요";
const AREA_CHIPS = ["18", "24", "32", "40"];
/** 홈 한 줄 입력이 이 탭에 남긴 말(HomeAsk) */
export const START_SAY_KEY = "mj_start_say";

/** 글에서 폼 값만 읽어요. 못 읽은 칸은 비워 둬요(틀린 값을 넣지 않아요) */
export function readLine(text: string, regions: Region[], today: string): Partial<InfoDraft> {
  const out: Partial<InfoDraft> = {};
  for (const r of regions) {
    for (const g of r.groups) {
      const hit = g.items.find((sgg) => sgg.length >= 2 && text.includes(sgg));
      if (hit) { out.sido = r.id; out.sgg = hit; break; }
    }
    if (out.sgg) break;
  }
  const py = text.match(/(\d{1,3}(?:\.\d)?)\s*평/);
  const m2 = text.match(/(\d{1,3}(?:\.\d)?)\s*(?:㎡|m2|제곱)/i);
  if (py) { const v = pyeongToM2(py[1]); if (v) { out.area = v; out.basis = "supply"; } }
  else if (m2) { out.area = m2[1]; out.basis = /전용/.test(text) ? "exclusive" : "supply"; }
  if (/살고|사는\s*중|거주/.test(text)) out.occupied = true;
  else if (/비어|빈\s*집|이사\s*(?:전|하기\s*전)|입주\s*전/.test(text)) out.occupied = false;
  if (/실크/.test(text)) out.grade = "basic";
  else if (/합지/.test(text)) out.grade = "economy";
  if (/부분|방\s*하나|일부/.test(text)) out.scope = "partial";
  const won = text.match(/예산\D{0,6}(\d{2,5})\s*만/);
  if (won) out.budget = won[1];
  const day = text.match(/(\d{1,2})\s*(?:월|\/)\s*(\d{1,2})\s*일?/);
  if (day) {
    const y = Number(today.slice(0, 4)), m = Number(day[1]), dd = Number(day[2]);
    const year = m < Number(today.slice(5, 7)) ? y + 1 : y;
    const iso = `${year}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (m >= 1 && m <= 12 && dd >= 1 && dd <= 31 && iso >= today) out.start = iso;
  }
  return out;
}

function said(p: Partial<InfoDraft>, regions: Region[]): string[] {
  const out: string[] = [];
  if (p.sgg) out.push(`지역 ${placeText(regions, { sido: p.sido ?? "", sgg: p.sgg })}`);
  if (p.area) out.push(`면적 ${p.area}㎡`);
  if (p.occupied != null) out.push(p.occupied ? "살면서 공사" : "빈 집");
  if (p.grade) out.push(p.grade === "basic" ? "실크 벽지" : "합지 벽지");
  if (p.scope === "partial") out.push("부분 도배");
  if (p.budget) out.push(`예산 ${p.budget}만 원`);
  if (p.start) out.push(`시작 희망 ${p.start.slice(5).replace("-", "/")}`);
  return out;
}

const firstMissing = (d: InfoDraft): Pick | null =>
  !d.sgg ? "region" : !d.area ? "area" : d.occupied == null ? "occupied" : !d.grade ? "grade" : null;

const ASK: Record<Pick, string> = {
  region: "어느 지역이에요? 구 이름을 적어 주세요. 예: 노원구",
  area: "몇 평이에요? 분양 면적(공급) 기준으로 골라 주세요.",
  occupied: "공사하는 동안 집에 살고 계세요?",
  grade: "벽지는 어떤 걸로 할까요? 잘 모르면 실크로 먼저 볼게요.",
};

export function StartChat({ d, set, regions, today }: { d: InfoDraft; set: (p: Partial<InfoDraft>) => void; regions: Region[]; today: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "bot", text: HELLO }]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // 이 기기에 둔 답으로 폼이 이미 차 있으면 다음에 물을 것부터 이어가요
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let say = "";
    try { say = window.sessionStorage.getItem(START_SAY_KEY) ?? ""; window.sessionStorage.removeItem(START_SAY_KEY); } catch { /* 없으면 인사부터 */ }
    if (say) { send(say); return; }
    const miss = firstMissing(d);
    if (d.sgg || d.area) setMsgs((m) => [...m, miss ? { who: "bot", text: `앞에서 적던 내용을 이어서 채웠어요. ${ASK[miss]}`, pick: miss } : { who: "bot", text: "앞에서 적던 내용으로 다 채워져 있어요. 오른쪽에서 확인하고 '표준견적서 보기'를 눌러 주세요." }]);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  function next(after: InfoDraft, lead: string) {
    const miss = firstMissing(after);
    setMsgs((m) => [...m, miss
      ? { who: "bot", text: `${lead}${ASK[miss]}`, pick: miss }
      : { who: "bot", text: `${lead}필요한 칸은 다 채웠어요. 오른쪽에서 확인하고 '표준견적서 보기'를 눌러 주세요. 금액은 믿집 계산으로 바로 나와요.` }]);
  }

  function apply(p: Partial<InfoDraft>, me: string) {
    setMsgs((m) => [...m, { who: "me", text: me }]);
    set(p);
    const got = said(p, regions);
    next({ ...d, ...p }, got.length ? `오른쪽 칸에 넣었어요: ${got.join(" · ")}. ` : "");
  }

  function send(t: string) {
    const v = t.trim();
    if (!v) return;
    setText("");
    const p = readLine(v, regions, today);
    if (!Object.keys(p).length) {
      setMsgs((m) => [...m, { who: "me", text: v }, { who: "bot", text: `제가 읽을 수 있는 값이 없었어요. 예: "${EXAMPLE}"처럼 적어 주시거나 오른쪽 칸을 바로 골라 주세요.` }]);
      return;
    }
    apply(p, v);
  }

  const last = msgs[msgs.length - 1];
  return (
    <section className={s.chat} aria-label="재재와 대화">
      <header className={s.head}><b>재재 · 믿집 비서</b><span>말하면 오른쪽 칸을 채워요. 고치는 것도 언제든 돼요.</span></header>
      <div className={s.log} role="log" aria-live="polite">
        {msgs.map((m, i) => <p key={i} className={m.who === "me" ? s.me : s.bot}>{m.text}</p>)}
        {last.who === "bot" && last.pick === "area" ? (
          <div className={s.chips}>{AREA_CHIPS.map((n) => <Button key={n} size="sm" variant="weak" onClick={() => { const v = pyeongToM2(n); if (v) apply({ area: v, basis: "supply" }, `${n}평`); }}>{n}평</Button>)}</div>
        ) : null}
        {last.who === "bot" && last.pick === "occupied" ? (
          <div className={s.chips}>
            <Button size="sm" variant="weak" onClick={() => apply({ occupied: true }, "살고 있어요")}>살고 있어요</Button>
            <Button size="sm" variant="weak" onClick={() => apply({ occupied: false }, "비어 있어요")}>비어 있어요</Button>
          </div>
        ) : null}
        {last.who === "bot" && last.pick === "grade" ? (
          <div className={s.chips}>
            <Button size="sm" variant="weak" onClick={() => apply({ grade: "basic" }, "실크")}>실크</Button>
            <Button size="sm" variant="weak" onClick={() => apply({ grade: "economy" }, "합지")}>합지</Button>
            <Button size="sm" variant="secondary" onClick={() => apply({ grade: "basic" }, "잘 모르겠어요")}>잘 모르겠어요</Button>
          </div>
        ) : null}
        {msgs.length === 1 ? <div className={s.chips}><Button size="sm" variant="weak" onClick={() => setText(EXAMPLE)}>예시 문장 넣기</Button></div> : null}
        <div ref={end} />
      </div>
      <form className={s.row} onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label className="mj-sr" htmlFor="start-chat">재재에게 보낼 말</label>
        <textarea id="start-chat" className={s.input} rows={1} maxLength={300} value={text} placeholder="예: 노원구 24평 아파트, 살고 있어요"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        <Button type="submit" disabled={!text.trim()}>보내기</Button>
      </form>
    </section>
  );
}
