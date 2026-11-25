"use client";
// 로그인 전 표준견적서(C57 · D12 · N1 A). 이 기기에 둔 답(mj_guest_v3)을 읽어 서버 계산 엔진에 물어요(POST /guest/standard, 저장 안 함).
// - 줄은 모두 가입 없이 봐요. '업체 보기' · '예상 공정표' · AI 칸 '가입 · 로그인'을 누르면 그 자리에 가입 카드가 떠요(C59 · D13).
// - 웹 ≥1024: 왼쪽 재재 대화(자주 묻는 질문 칩만) · 오른쪽 표준견적서. 폰: 견적서 아래 대화, 머리 'AI에게 묻기' → 아래 시트(C58).
// - 금액은 서버가 다시 센 값이에요. 화면이 보낸 숫자를 믿지 않고, 화면도 더하지 않아요.
import { useCallback, useEffect, useState } from "react";
import { JoinDialog } from "@/components/auth/JoinDialog";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarketSheet, MarketTotal, MarketTrust } from "@/components/v2/market/MarketQuote";
import { call, errorText } from "@/lib/backend/client";
import { calcGuest } from "@/lib/guest/api";
import { checkDraft, conditionText, toHomeInfo } from "@/lib/guest/info";
import { toMarketIn, type MqOut } from "@/lib/guest/market";
import { budgetText, toQuoteLines, type StdView } from "@/lib/guest/standard";
import { draftOf, readGuest } from "@/lib/guest/store";
import { GUEST_ASK_EVENT, GuestAskSheet } from "./GuestAside";
import { GuestJaejae } from "./GuestJaejae";
import { StandardSheet, StandardSkeleton } from "./StandardSheet";
import { TradeOrder } from "./TradeParts";
import s from "./standard.module.css";

// 전체 도배는 시장 단가 표준견적서(업체 견적서 235건 중앙값, /estimate와 같은 계산)로 보여요.
// 부분 공사는 고른 공간만 어림하는 계산이라 기존 표준견적서 계산 그대로예요.
type State = { kind: "loading" } | { kind: "none" } | { kind: "error"; msg: string } | { kind: "ok"; view: StdView } | { kind: "market"; q: MqOut };

export function GuestStandard({ mock }: { mock: boolean }) {
  const [st, setSt] = useState<State>({ kind: "loading" });
  const [join, setJoin] = useState(false);
  const [ask, setAsk] = useState(false);
  /** 목공도 골랐어요(#193): 손님 계산은 도배만 세고, 목공 줄은 가입 뒤 내 공사 표준견적서에 나와요 */
  const [mok, setMok] = useState(false);

  const load = useCallback(async () => {
    const g = readGuest();
    const d = g ? draftOf(g) : null;
    if (!d || Object.keys(checkDraft(d)).length) { setSt({ kind: "none" }); return; }
    setMok(d.mok && d.mokgong.length > 0);
    setSt({ kind: "loading" });
    const info = toHomeInfo(d);
    try {
      if (info.scope === "full" && !mock) {
        setSt({ kind: "market", q: await call<MqOut>("POST", "/v2/market-quote", toMarketIn(info)) });
        return;
      }
      const r = await calcGuest(info, mock);
      setSt({
        kind: "ok",
        view: {
          scope: r.scope, lines: toQuoteLines(r.lines, r.scope), supply: r.supply, vat: r.vat, total: r.total, days: r.days,
          budget: budgetText(r.budget_fit, info.budget_won),
          condition: conditionText({ ...info, area_m2: r.area_m2, area_basis: r.area_basis }),
        },
      });
    } catch (e) {
      setSt({ kind: "error", msg: errorText(e) });
    }
  }, [mock]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const on = () => setAsk(true);
    window.addEventListener(GUEST_ASK_EVENT, on);
    return () => window.removeEventListener(GUEST_ASK_EVENT, on);
  }, []);

  // 시트 위에 창을 겹치지 않아요: 시트를 닫고 가입 카드를 열어요
  const openJoin = () => { setAsk(false); setJoin(true); };
  const ok = st.kind === "ok" ? st.view : null;
  const shown = ok != null || st.kind === "market";

  return (
    <>
      <Main>
        <PageHead title="표준견적서" crumbs={[{ label: "표준견적서 받기", href: "/start" }, { label: "표준견적서" }]} />
        {/* 재재 공사 화면과 같은 모양: 왼쪽 재재 대화 · 오른쪽 표준견적서(웹 ≥1024). 폰은 견적서 먼저, 대화는 아래 */}
        <div className={s.split}>
        <GuestJaejae onJoin={openJoin} ready={shown} />
        <div className={s.sheetCol}>
          {st.kind === "loading" ? <StandardSkeleton /> : null}
          {st.kind === "none" ? (
            <EmptyState icon="doc" title="넣은 답이 없어요" action={<Button href="/start">기본 정보 넣기</Button>}>
              기본 정보를 넣으면 가입 없이 표준견적서가 나와요. 답은 이 기기에 저장돼요.
            </EmptyState>
          ) : null}
          {st.kind === "error" ? (
            <div className={s.alert} role="alert">
              <p>표준견적서를 계산하지 못했어요</p>
              <p>{st.msg}</p>
              <div className={s.alertBtns}>
                <Button onClick={() => void load()}>다시 계산하기</Button>
                <Button variant="secondary" href="/start">기본 정보 보기</Button>
              </div>
            </div>
          ) : null}
          {mok ? <TradeOrder has={["dobae", "mokgong"]} /> : null}
          {mok ? <p className={s.guestInfo}>여기 금액은 도배만이에요. 목공 줄은 가입하면 내 공사 표준견적서에 공정별로 같이 나와요.</p> : null}
          {ok ? <StandardSheet view={ok} changeHref="/start" /> : null}
          {st.kind === "market" ? (
            <>
              <MarketTotal q={st.q} changeHref="/start" />
              <MarketSheet q={st.q} />
              <MarketTrust q={st.q} />
            </>
          ) : null}
        </div>
        </div>
      </Main>
      {shown ? (
        <BottomBar>
          {ok?.scope === "partial" ? null : <Button variant="secondary" size="lg" onClick={() => setJoin(true)}>예상 공정표</Button>}
          <Button size="lg" onClick={() => setJoin(true)}>업체 보기</Button>
        </BottomBar>
      ) : null}
      <GuestAskSheet open={ask} onClose={() => setAsk(false)} onJoin={openJoin} />
      <JoinDialog open={join} onClose={() => setJoin(false)} />
    </>
  );
}
