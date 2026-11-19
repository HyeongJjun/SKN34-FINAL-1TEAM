"use client";
// 조각 모음 본문. 상태가 있는 조각(창 · 시트 · 메뉴 · 달력 · 칩)을 실제로 눌러 볼 수 있어요.
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeaderBar } from "@/components/site/HeaderBar";
import { LiveProvider } from "@/components/site/LiveProvider";
import { AsidePanel } from "@/components/site/AsideSlot";
import { Main, PageHead, WithAside } from "@/components/site/Frame";
import { ProjectBand } from "@/components/site/ProjectBand";
import { TABS } from "@/components/site/nav";
import { TabBarNav } from "@/components/site/TabBarNav";
import { Badge, Count, DueBadge } from "@/components/ui/Badge";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button, IconButton } from "@/components/ui/Button";
import { CalcBox } from "@/components/ui/CalcBox";
import { Calendar, CalendarLegend } from "@/components/ui/Calendar";
import { ChoiceChips } from "@/components/ui/ChoiceChip";
import { CompareTable } from "@/components/ui/CompareTable";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, SelectField, TextArea } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { HalfDayPicker } from "@/components/ui/HalfDayPicker";
import { ICON_NAMES, Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { BigFigure, Money } from "@/components/ui/Money";
import { NotifyList, NotifyRow } from "@/components/ui/NotifyRow";
import { QuoteLines, type QuoteLine } from "@/components/ui/QuoteLines";
import { OptionRow, Sheet } from "@/components/ui/Sheet";
import { StarInput, Stars } from "@/components/ui/Stars";
import { StateLegend, StateTag } from "@/components/ui/StateTag";
import { Steps, SubSteps } from "@/components/ui/Steps";
import { useToast } from "@/components/ui/Toast";
import { ShortlistTray, VendorCard, type ShortlistState } from "@/components/ui/VendorCard";
import { dateLong, dueText, halfDayText, rangeText, type Half } from "@/lib/format";
import { visitState } from "@/lib/labels";
import type { Session } from "@/lib/types";
import { Gallery2 } from "./Gallery2";
import { Sec } from "./Sec";
import s from "./gallery.module.css";

const TODAY = "2026-11-18";
const NOW = "2026-11-18T12:00:00+09:00";
const person = (role: Session["role"], name: string, vendorStatus: string | null = null): Session => ({ id: role, email: `${role}@example.test`, name, role, vendorStatus, vendorRejectReason: null, phone: null, joinedAt: "2026-11-01T00:00:00Z" });

const STD_LINES: QuoteLine[] = [
  { key: "wall", name: "벽 도배 시공", note: "풀 포함", qty: "130.1", unit: "㎡", unitPrice: 5993, amount: 779689, state: "included" },
  { key: "ceil", name: "천장 도배 시공", note: "풀 포함", qty: "43.4", unit: "㎡", unitPrice: 8531, amount: 370245, state: "included" },
  { key: "silk", name: "실크벽지", note: "시장 평균 가격", qty: "63.0", unit: "평", unitPrice: 9500, amount: 598500, state: "included" },
  { key: "base", name: "초배지", qty: "190.8", unit: "㎡", unitPrice: 242, amount: 46174, state: "included" },
  { key: "tear", name: "기존 벽지 철거", qty: "173.5", unit: "㎡", unitPrice: 1727, amount: 299635, state: "after_visit" },
];
const VENDOR_LINES: QuoteLine[] = [
  { key: "1201", code: "1201", name: "퍼티작업", note: "사전퍼티 또는 밀작업", qty: "21.0", unit: "평", unitPrice: 20000, amount: 420000 },
  { key: "1204", code: "1204", name: "실크벽지", qty: "63.0", unit: "평", unitPrice: 9500, amount: 598500 },
  { key: "1205", code: "1205", name: "부자재", note: "풀 · 부직포 · 네바리 · 실리콘 등", qty: "21.0", unit: "평", unitPrice: 13000, amount: 273000 },
  { key: "1206", code: "1206", name: "인건비", note: "품 = 1명이 하루 하는 일", qty: "5.0", unit: "품", unitPrice: 300000, amount: 1500000 },
];

export function Gallery() {
  const toast = useToast();
  // ?open=dialog · sheet: 처음부터 열린 창(개발 모드 두 번 실행에도 닫히지 않는지 보기)
  const auto = useSearchParams().get("open");
  const [dlg, setDlg] = useState(auto === "dialog");
  const [form, setForm] = useState(false);
  const [sheet, setSheet] = useState(auto === "sheet");
  const [reason, setReason] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>("basic");
  const [inc, setInc] = useState<string[]>(["tear"]);
  const [day, setDay] = useState<string | null>("2026-12-15");
  const [half, setHalf] = useState<Half | null>("am");
  const [days, setDays] = useState<string[]>(["2027-01-04", "2027-01-05"]);
  const [range, setRange] = useState<{ from: string; to?: string } | null>({ from: "2026-12-13", to: "2026-12-18" });
  const [star, setStar] = useState(4);
  const [pick, setPick] = useState<Record<string, ShortlistState>>({ gyeol: "added", maru: "add" });
  const [files, setFiles] = useState<string[]>([]);
  const [area, setArea] = useState("12");

  const added = Object.values(pick).filter((v) => v === "added").length;
  const toggle = (k: string) => setPick((p) => ({ ...p, [k]: p[k] === "added" ? "add" : "added" }));

  const aside = (
    <AsidePanel
      title="AI에게 묻기"
      listLabel="AI 대화"
      foot={<ChoiceChips legend="빠른 질문" hideLegend value={null} onChange={() => toast.show("예시 질문이에요")} options={[{ value: "a", label: "합지랑 실크는 뭐가 달라요?" }, { value: "b", label: "며칠 걸려요?" }]} />}
    >
      <span className={s.ctx}>표준견적서 보는 중</span>
      <p className={s.q}>철거는 왜 합계에 안 들어가요?</p>
      <div className={s.a}>
        <span className={s.auto}>자동 답변</span>
        <p>뜯어낼 벽지 양은 집을 봐야 알 수 있어서 실측 뒤 업체가 정해요. 괄호 금액은 참고 금액이에요.</p>
        <CalcBox lines={[{ terms: [{ n: "173.5", unit: "㎡" }, "×", { n: 1727, unit: "원" }], result: { n: 299635, unit: "원", paren: true } }]} />
      </div>
      {Array.from({ length: 6 }, (_, i) => <p key={i} className={s.fill}>대화 목록만 칸 안에서 스크롤해요({i + 1}).</p>)}
    </AsidePanel>
  );

  return (
    <>
      <Main>
        <PageHead title="조각 모음" crumbs={[{ label: "개발", href: "/dev/ui" }, { label: "조각 모음" }]} desc="B4 디자인 체계 · 앱 껍데기 · ui 조각(개발에서만 보여요)" />
        <WithAside aside={aside}>
          <Sec id="tokens" title="토큰 · 글꼴">
            <div className={s.swatches}>
              {["--mj-primary", "--mj-text", "--mj-text-sub", "--mj-text-mute", "--mj-line-control", "--mj-danger", "--mj-st-wait", "--mj-st-ok", "--mj-fill", "--mj-surface-sub"].map((t) => (
                <div key={t} className={s.sw}><i style={{ background: `var(${t})` }} /><code>{t}</code></div>
              ))}
            </div>
            <div className={s.types}>
              {[["38", "--mj-size-38"], ["28", "--mj-size-28"], ["20", "--mj-size-20"], ["18", "--mj-size-18"], ["16", "--mj-size-16"], ["14", "--mj-size-14"], ["13", "--mj-size-13"]].map(([n, v]) => (
                <p key={n} style={{ fontSize: `var(${v})` }}>{n}px 믿집 표준견적서 197만 4,069원</p>
              ))}
            </div>
            <div className={s.tnum} data-tnum="">
              <p className="mj-num" data-tnum-a="">1,111,111원</p>
              <p className="mj-num" data-tnum-b="">8,888,888원</p>
              <p data-pnum-a="">1,111,111원</p>
              <p data-pnum-b="">8,888,888원</p>
            </div>
          </Sec>

          <Sec id="header" title="머리 · 역할별(9판)">
            {/* 보기용 머리 · 탭 바는 실시간 수를 따로 둬요(진짜 머리의 알림 수와 섞이지 않게) */}
            <div className={s.frames}>
              <LiveProvider source={null}><HeaderBar session={null} sticky={false} /></LiveProvider>
              <LiveProvider source={null}><HeaderBar session={person("customer", "김하늘")} unread={3} sticky={false} /></LiveProvider>
              <LiveProvider source={null}><HeaderBar session={person("vendor", "마루와벽", "approved")} unread={2} sticky={false} /></LiveProvider>
              <LiveProvider source={null}><HeaderBar session={person("vendor", "바른벽", "pending")} sticky={false} /></LiveProvider>
              <LiveProvider source={null}><HeaderBar session={person("admin", "관리자")} admin sticky={false} /></LiveProvider>
              <LiveProvider source={null}><HeaderBar session={person("customer", "김하늘")} sticky={false} only="phone" phone={{ title: "마루와벽", back: "/dev/ui", action: <Menu label="더 보기" icon="more" title="마루와벽" items={[{ label: "실측 일정 보기", href: "/dev/ui#compare" }, { label: "실측 취소", danger: true, onSelect: () => toast.show("실측 취소(예시)") }]} /> }} /></LiveProvider>
            </div>
            <p className={s.small}>폰 아래 탭 바(고객 5칸 · 업체 4칸, 폰에서만 보여요)</p>
            <div className={`${s.frames} ${s.tabs}`}>
              <LiveProvider source={null}><TabBarNav tabs={TABS.customer!} counts={{ notify: 3 }} role="customer" /></LiveProvider>
              <LiveProvider source={null}><TabBarNav tabs={TABS.vendor!} counts={{ notify: 2 }} role="vendor" /></LiveProvider>
            </div>
          </Sec>

          <Sec id="band" title="공사 띠(W1 A)">
            <div className={s.frames}>
              <ProjectBand sticky={false} name="상계동 아파트 도배" href="/dev/ui" current={1} todo={[{ label: "업체 보기", href: "/dev/ui#vendor" }]} />
              <ProjectBand sticky={false} name="상계동 아파트 도배" href="/dev/ui" current={5} sub={{ steps: [{ label: "견적서 비교", href: "/dev/ui#compare" }, { label: "업체 확정", href: "/dev/ui#overlay" }, { label: "공사 날짜" }, { label: "공사" }, { label: "끝 확인" }], current: 2 }} todo={[{ label: "공사 날짜 수락", href: "/dev/ui#date" }]} />
            </div>
          </Sec>

          <Sec id="buttons" title="단추">
            <div className={s.row}>
              <Button>업체 보기</Button>
              <Button variant="weak">결도배로 확정</Button>
              <Button variant="secondary">예상 공정표</Button>
              <Button variant="danger">실측 취소</Button>
              <Button variant="kakao">카카오로 시작(준비 중)</Button>
            </div>
            <div className={s.row}>
              <Button size="lg">고른 2곳에 요청 보내기</Button>
              <Button size="sm">날짜 고르기</Button>
              <Button disabled>보내기</Button>
              <Button busy>보내는 중</Button>
              <Button icon="plus" variant="secondary" size="sm">사진 더 넣기</Button>
            </div>
            <div className={s.row}>
              <Button variant="text" arrow href="/dev/ui#quote">자세히</Button>
              <Button variant="text">바꾸기</Button>
              <Button variant="text" gray>요청 취소</Button>
              <p className={s.p}>믿집에서 공사를 끝낸 고객만 써요 · <Button variant="inline" href="/dev/ui#stars">리뷰 기준</Button></p>
              <Button variant="text" href="https://example.com" external>네이버 플레이스</Button>
            </div>
            <div className={s.row}>
              <IconButton icon="back" label="뒤로" />
              <IconButton icon="close" label="닫기" />
              <IconButton icon="more" label="더 보기" />
              <IconButton icon="plus" label="더 보내기" size={40} />
            </div>
          </Sec>

          <Sec id="field" title="입력 칸">
            <div className={s.stack}>
              <Field label="공급면적" unit="㎡" num value={area} onChange={(e) => setArea(e.target.value)} error={Number(area) < 20 ? "방 한 칸보다 작아요. 69.4를 넣으려던 건가요?" : null} />
              <Field label="휴대폰" type="tel" autoComplete="tel" placeholder="010-1234-5678" />
              <Field label="주소" value="서울 노원구 상계동" locked readOnly />
              <SelectField label="시작 희망" options={[{ value: "date", label: "날짜가 정해졌어요" }, { value: "unknown", label: "아직 몰라요" }]} />
              <TextArea label="업체에 남길 말" optional placeholder="예: 작은방 곰팡이를 봐 주세요" />
            </div>
          </Sec>

          <Sec id="chips" title="고르기 칩">
            <ChoiceChips legend="벽지" value={grade} onChange={setGrade} options={[{ value: "economy", label: "합지" }, { value: "basic", label: "실크" }, { value: "film", label: "필름", soon: true }]} />
            <ChoiceChips legend="포함됐나요?" multiple value={inc} onChange={setInc} options={[{ value: "tear", label: "철거" }, { value: "waste", label: "폐기물 따로", proposed: true }, { value: "as", label: "하자 1년" }]} />
          </Sec>

          <Sec id="steps" title="단계 표시">
            <Steps current={2} />
            <SubSteps current={2} />
          </Sec>

          <Sec id="money" title="금액 · 큰 숫자">
            <BigFigure value={1974069} caption="부가세 포함 · 예상 2일" sub="예산 300만 원 안이에요" />
            <div className={s.row}>
              <BigFigure value={3267000} size="mid" label="확정 금액" />
              <BigFigure size="mid" label="실측 날짜" caption={null}>{halfDayText("2026-12-15", "am", true)}</BigFigure>
              <BigFigure value={2860000} size="mid" label="결도배 실측 견적서" past caption="12.31(목)까지 유효했어요" />
            </div>
            <p className={s.p}>
              줄 금액 <Money value={598500} full size="line" /> · 차이 <Money value={55000} delta /> · 합계 밖 <Money value={299635} full paren /> · 없음 <Money value={null} />
            </p>
          </Sec>

          <Sec id="quote" title="견적서 줄 표">
            <QuoteLines caption="표준견적서 줄" lines={STD_LINES} totals={{ supply: 1794608, vat: 179461, total: 1974069 }} vatSplit />
            <div className={s.narrowBox}><QuoteLines caption="표준견적서 줄(좁은 칸)" lines={STD_LINES.slice(0, 3)} totals={{ total: 1974069 }} /></div>
            <QuoteLines caption="마루와벽 가견적 줄" lines={VENDOR_LINES} totals={{ supply: 2896500, vat: 289650, total: 3186150 }} vatSplit showCode />
          </Sec>

          <Sec id="vendor" title="업체 카드 · 담기 띠">
            <div className={s.list}>
              <VendorCard name="결도배" href="/dev/ui" amount={2774200} compare="표준견적서보다 41% 많아요" rating={{ avg: 4.7, count: 3 }} jobs={3} extra="실측 무료" state={pick.gyeol} onToggle={() => toggle("gyeol")} />
              <VendorCard name="마루와벽" href="/dev/ui" amount={3186150} compare="표준견적서보다 61% 많아요" badge={<Badge tone="ok">바로 확정</Badge>} rating={{ avg: 4.8, count: 5 }} jobs={5} extra="실측 무료" state={pick.maru} onToggle={() => toggle("maru")} />
              <VendorCard name="한결인테리어" href="/dev/ui" amount={null} rating={{ avg: 5, count: 1 }} jobs={1} state="preparing" />
              <VendorCard name="바른벽" href="/dev/ui" amount={2500000} state="excluded" />
            </div>
            <ShortlistTray count={added} note="폰 · PC 어디서든 이어져요" action={<Button size="sm" href="/dev/ui#compare">실측 일정 잡기</Button>} />
          </Sec>

          <Sec id="compare" title="비교표(업체를 열로 · W4 A)">
            <CompareTable
              caption="실측 일정 비교"
              columns={[{ key: "maru", name: "마루와벽", highlight: true }, { key: "gyeol", name: "결도배" }]}
              rows={[
                { key: "st", label: "상태", cells: { maru: <Badge tone="now">날짜 고를 차례</Badge>, gyeol: <Badge tone="wait">답 기다림</Badge> } },
                { key: "date", label: "날짜", big: true, cells: { maru: <Money value={null} empty={rangeText("2026-12-13", "2026-12-18")} size="mid" className={s.ink} />, gyeol: "—" } },
                { key: "next", label: "다음 할 일", cells: { maru: "반나절 고르기", gyeol: "결도배가 기간을 답해요" } },
                { key: "due", label: "기한", cells: { maru: <span className="mj-num">{dueText("2026-11-25T09:05:00+09:00")}</span>, gyeol: <span className="mj-num">{dueText("2026-11-19T21:40:00+09:00")}</span> } },
                { key: "act", label: "할 일", action: true, cells: { maru: <Button size="sm" href="/dev/ui#date">날짜 고르기</Button>, gyeol: <Button variant="text" gray>요청 취소</Button> } },
              ]}
              empty={{ title: "1곳 더 담을 수 있어요", action: <Button variant="text" arrow href="/dev/ui#vendor">업체 더 담기</Button> }}
            />
          </Sec>

          <Sec id="state" title="상태 칩(N4 C) · 배지 · 기한">
            <div className={s.row}>
              {(["requested", "offered", "picked", "booked", "expired", "declined"] as const).map((k) => {
                const v = visitState(k, "vendor");
                return <StateTag key={k} tone={v.tone}>{v.label}</StateTag>;
              })}
            </div>
            <StateLegend />
            <div className={s.row}>
              <Badge tone="now">진행 중</Badge><Badge tone="wait">다른 날 제안 옴</Badge><Badge tone="ok">확정</Badge><Badge tone="bad">거절</Badge><Badge tone="mute">잡아 둠</Badge>
              <span className={s.p}>안 읽은 수 <Count n={3} /> <Count n={120} /></span>
            </div>
            <div className={s.row}>
              <DueBadge due="2026-11-25T09:05:00+09:00" now={NOW} who="· 고객이 골라요" />
              <DueBadge due="2026-11-19T21:40:00+09:00" now={NOW} relative />
              <DueBadge due="2026-11-17T20:10:00+09:00" now={NOW} />
            </div>
          </Sec>

          <Sec id="overlay" title="가운데 창 · 아래 시트 ↔ 작은 메뉴">
            <div className={s.row}>
              <Button onClick={() => setDlg(true)}>업체 확정 창</Button>
              <Button variant="secondary" onClick={() => setForm(true)}>양식 창</Button>
              <Button variant="secondary" onClick={() => setSheet(true)}>이유 고르기 시트</Button>
              <Menu label="더 보기" icon="more" title="마루와벽" items={[{ label: "실측 일정 보기", href: "/dev/ui#compare" }, { label: "공사 보기", href: "/dev/ui#band" }, { label: "실측 취소", danger: true, onSelect: () => setSheet(true) }, { label: "신고 · 차단", danger: true, onSelect: () => toast.show("신고 창(예시)") }]} />
              <Menu label="김하늘 님" items={[{ label: "내 정보", href: "/dev/ui" }, { label: "로그아웃", onSelect: () => toast.show("로그아웃(예시)") }]} />
            </div>
            <ConfirmDialog open={dlg} onClose={() => setDlg(false)} title="마루와벽으로 확정할까요?" confirmLabel="확정" onConfirm={() => { setDlg(false); toast.show("마루와벽으로 확정했어요(예시)"); }}>
              <dl className={s.kv}>
                <div><dt>확정 금액 <small>부가세 포함</small></dt><dd><Money value={3267000} size="line" /></dd></div>
                <div><dt>견적서</dt><dd>{dateLong("2026-12-16")} 받은 것</dd></div>
                <div><dt>공사 기간</dt><dd>2일</dd></div>
              </dl>
              <p className={s.small}>이 견적서로 고정돼요. 결도배 실측 견적서는 닫히고, 공사 날짜는 마루와벽이 올려요.</p>
            </ConfirmDialog>
            <Dialog open={form} onClose={() => setForm(false)} title="평으로 넣기" actions={<Button size="lg" onClick={() => setForm(false)}>69.4㎡로 넣기</Button>}>
              <Field label="평" unit="평" num defaultValue="21" />
              <CalcBox tone="form" lines={[{ terms: [{ n: 21, unit: "평" }, "×", { n: "3.3058" }], result: { n: "69.4", unit: "㎡" } }]} />
            </Dialog>
            <Sheet open={sheet} onClose={() => setSheet(false)} title="실측을 왜 취소하나요?" actions={<Button size="lg" block variant="danger" disabled={!reason} onClick={() => { setSheet(false); toast.show("실측을 취소했어요(예시)"); }}>실측 취소</Button>}>
              <div role="radiogroup" aria-label="취소 이유">
                {["일정이 바뀌었어요", "다른 업체로 할게요", "공사를 미뤘어요", "그 밖"].map((r) => (
                  <OptionRow key={r} selected={reason === r} onClick={() => setReason(r)}>{r}</OptionRow>
                ))}
              </div>
            </Sheet>
          </Sec>

          <Sec id="notify" title="알림 줄 · 빈 화면">
            <NotifyList
              fresh={[<NotifyRow key="1" href="/dev/ui#date" title="내일 오전 실측이에요" sub="마루와벽 · 동 · 호 보냄" time="12.14 18:00" unread />]}
              past={[
                <NotifyRow key="2" href="/dev/ui#date" title="결도배가 다른 날을 제안했어요" sub="상계동 아파트 도배" time="11.21 10:12" />,
                <NotifyRow key="3" href="/dev/ui#date" title="실측이 12월 15일(화) 오전으로 정해졌어요" sub="마루와벽" time="11.18 11:00" />,
              ]}
            />
            <EmptyState icon="chat" title={<>실측 날짜가 정해지면<br />업체와 채팅할 수 있어요</>} action={<Button variant="text" arrow href="/dev/ui#compare">실측 일정 보기</Button>}>
              마루와벽 날짜를 고르면 바로 열려요
            </EmptyState>
          </Sec>

          <Sec id="drop" title="끌어다 놓기 칸(I9)">
            <FileDrop label="집 사진 올리기" onFiles={(f) => setFiles((x) => [...x, ...f.map((v) => v.name)])} />
            <FileDrop kind="doc" label="실측 견적서 파일 올리기" types="PDF · 엑셀 · 사진" multiple={false} onFiles={(f) => setFiles((x) => [...x, ...f.map((v) => v.name)])} error={files.some((n) => n.endsWith(".zip")) ? "PDF · 엑셀 · 사진만 올릴 수 있어요." : null} />
            {files.length ? <p className={s.small}>고른 파일: {files.join(", ")}</p> : null}
          </Sec>

          <Sec id="date" title="날짜 고르기 · 반나절">
            <CalendarLegend items={["wish", "available", "selected", "unavailable", "proposed"]} wishText={`내 희망 ${rangeText("2026-12-07", "2026-12-21")}`} />
            <Calendar
              mode="single"
              label="마루와벽 날짜 고르기"
              today={TODAY}
              month="2026-12-01"
              value={day}
              onChange={setDay}
              wish={{ from: "2026-12-07", to: "2026-12-21" }}
              marks={{ "2026-12-13": ["available"], "2026-12-14": ["available"], "2026-12-15": ["available"], "2026-12-16": ["unavailable"], "2026-12-17": ["available", "proposed"], "2026-12-18": ["available"], "2026-12-25": ["holiday"] }}
              notes={{ "2026-12-15": { text: "오전", label: "오전만 돼요" }, "2026-12-17": { text: "제안", label: "업체가 제안한 날" }, "2026-12-25": { text: "성탄", label: "기독탄신일" } }}
              only={["2026-12-13", "2026-12-14", "2026-12-15", "2026-12-17", "2026-12-18"]}
            />
            {day ? <HalfDayPicker legend={dateLong(day)} value={half} onChange={setHalf} slots={{ am: "open", pm: day === "2026-12-17" ? "proposed" : "closed" }} /> : null}
            <Calendar mode="multiple" label="공사 날짜(날 하나씩)" today={TODAY} month="2027-01-01" value={days} onChange={setDays} marks={{ "2027-01-01": ["holiday"] }} notes={{ "2027-01-01": { text: "신정", label: "신정" } }} wide />
            <Calendar mode="range" label="갈 수 있는 기간" today={TODAY} month="2026-12-01" value={range} onChange={setRange} vendor={{ from: "2026-12-13", to: "2026-12-18" }} />
          </Sec>

          <Sec id="stars" title="별점 · 믿집 계산 · 토스트">
            <p className={s.p}><Stars value={4.8} count={5} /> · <Stars value={4.7} count={3} size="sm" /></p>
            <StarInput value={star} onChange={setStar} label="별점 고르기" />
            <CalcBox lines={[{ terms: [{ n: "63.0", unit: "평" }, "×", { n: 9500, unit: "원" }], result: { n: 598500, unit: "원" } }, { terms: [{ n: "173.5", unit: "㎡" }, "×", { n: 1727, unit: "원" }], result: { n: 299635, unit: "원", paren: true }, note: "합계 밖" }]} />
            <div className={s.row}>
              <Button variant="secondary" onClick={() => toast.show("저장했어요")}>토스트 보이기</Button>
              <Button variant="secondary" onClick={() => toast.show("방금 다른 고객이 골랐어요. 다른 날을 골라 주세요.", { tone: "error" })}>오류 토스트</Button>
            </div>
          </Sec>

          <Gallery2 />

          <Sec id="icons" title="아이콘">
            <ul className={s.icons}>
              {ICON_NAMES.map((n) => <li key={n}><Icon name={n} /><code>{n}</code></li>)}
            </ul>
          </Sec>
        </WithAside>
      </Main>
      <BottomBar note="보내면 지금 가견적이 고정되고, 기본 정보는 잠겨요">
        <Button variant="secondary" size="lg">예상 공정표</Button>
        <Button size="lg" onClick={() => toast.show("요청을 보냈어요(예시)")}>고른 2곳에 요청 보내기</Button>
      </BottomBar>
    </>
  );
}
