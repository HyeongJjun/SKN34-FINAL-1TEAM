"use client";
// 조각 모음 2차(B4, 2026-11-18): 탭 · 표 · 나눔 칸 · 켜기/끄기 · 체크 · 요약 칸 · 파일 줄 · 안내 상자 · 얼굴 · 진행 중 띠 · 기록 · 접는 목록 · 사진 칸.
// 숫자 · 날짜는 9판 시안의 예시 값이에요(계산 엔진 값이 아니에요).
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Accordion } from "@/components/ui/Accordion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Check, CheckGroup } from "@/components/ui/Check";
import { CellText, DataTable, type DataColumn } from "@/components/ui/DataTable";
import { EventLog } from "@/components/ui/EventLog";
import { FileRow } from "@/components/ui/FileRow";
import { Lightbox, type LightboxPhoto } from "@/components/ui/Lightbox";
import { Notice } from "@/components/ui/Notice";
import { PhotoGrid, type Photo } from "@/components/ui/PhotoGrid";
import { ResumeStrip } from "@/components/ui/ResumeStrip";
import { ScheduleChart, type ChartDay } from "@/components/ui/ScheduleChart";
import { Segmented } from "@/components/ui/Segmented";
import { StateLegend, StateTag } from "@/components/ui/StateTag";
import { KeyValue, SummaryRows } from "@/components/ui/Summary";
import { Switch } from "@/components/ui/Switch";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import type { StateTone } from "@/lib/labels";
import { Sec } from "./Sec";
import s from "./gallery.module.css";

type Inbox = { id: string; at: string; area: string; home: string; tone: StateTone; state: string; hold?: boolean; next: string; due: string | null; late?: boolean };
const INBOX: Inbox[] = [
  { id: "v1", at: "11.17 21:40", area: "상계동 69.4㎡", home: "노원구 · 아파트 · 전체 · 빈 집 · 희망 12.7~12.21", tone: "todo", state: "새 실측 요청", next: "기간 답하기", due: "11.19(목) 21:40" },
  { id: "v2", at: "11.18 08:30", area: "월계동 82.6㎡", home: "노원구 · 아파트 · 전체 · 사는 중", tone: "todo", state: "날짜 수락", hold: true, next: "12.16(수) 오후 수락", due: "11.20(금) 08:30" },
  { id: "v3", at: "11.15 20:10", area: "창동 74.4㎡", home: "도봉구 · 아파트 · 전체 · 빈 집", tone: "late", state: "답 기한 지남", next: "재요청 오면 답하기", due: "11.17(화) 20:10", late: true },
  { id: "v4", at: "11.16 19:02", area: "공릉동 76.0㎡", home: "노원구 · 사는 중", tone: "wait", state: "고객 차례", next: "고객 답 기다림", due: null },
  { id: "v5", at: "11.10 10:15", area: "하계동 59.9㎡", home: "노원구 · 빈 집", tone: "ok", state: "실측 확정", next: "12.18(금) 오전 실측", due: null },
];
const COLS: DataColumn<Inbox>[] = [
  { key: "at", label: "받은 때", num: true, width: "104px" },
  { key: "area", label: "집", primary: true, cell: (r) => <CellText main={r.area} sub={r.home} /> },
  { key: "state", label: "상태", width: "164px", cell: (r) => <span className={s.cellRow}><StateTag tone={r.tone}>{r.state}</StateTag>{r.hold ? <Badge>잡아 둠</Badge> : null}</span> },
  { key: "next", label: "다음 일", width: "150px" },
  { key: "due", label: "기한", num: true, width: "128px", cell: (r) => r.due ?? "—" },
];

const pic = (a: string, b: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`)}`;
const PHOTOS: Photo[] = [
  { key: "p1", src: pic("#ece6db", "#d8cfc0"), alt: "거실 벽 사진", label: "거실" },
  { key: "p2", src: pic("#e3e8ee", "#cdd6e0"), alt: "작은방 벽 사진", label: "작은방" },
  { key: "p3", src: pic("#efe7df", "#dccfc1"), alt: "안방 천장 사진", label: "안방 천장" },
  { key: "p4", src: pic("#e6ebe4", "#d0d9cb"), alt: "곰팡이 자국 사진", label: "곰팡이" },
];

const WEEK_JAN: ChartDay[] = ["04", "05", "06", "07", "08", "09", "10"].map((d) => ({ day: `2027-01-${d}`, off: d === "09" || d === "10" }));
const WEEK_JAN2: ChartDay[] = [...WEEK_JAN, { day: "2027-01-11" }];
const WEEK_DEC: ChartDay[] = ["14", "15", "16", "17", "18", "19", "20"].map((d) => ({ day: `2026-12-${d}`, off: d === "19" || d === "20" }));
const WEEK_HOL: ChartDay[] = [{ day: "2026-12-31" }, { day: "2027-01-01", off: true, holiday: "신정" }, { day: "2027-01-02", off: true }, { day: "2027-01-03", off: true }, { day: "2027-01-04" }];
const big = (a: string, b: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="40" height="30" fill="url(#g)"/><rect x="26" y="5" width="9" height="12" fill="#fff" opacity=".55"/></svg>`)}`;
const CASES: LightboxPhoto[] = [
  { key: "c1", src: big("#ece6db", "#d8cfc0"), alt: "거실 실크벽지 시공 사진", title: "거실 · 실크벽지", sub: "공급 79.3㎡ · 2026년 10월 · 마루와벽" },
  { key: "c2", src: big("#e3e8ee", "#cdd6e0"), alt: "작은방 합지 시공 사진", title: "작은방 · 합지", sub: "공급 59.9㎡ · 2026년 9월 · 마루와벽" },
  { key: "c3", src: big("#efe7df", "#dccfc1"), alt: "안방 천장 도배 사진", title: "안방 천장 · 실크벽지", sub: "공급 84.9㎡ · 2026년 8월 · 마루와벽" },
];

const TAB_ITEMS = [
  { key: "todo", label: "할 일", count: 3, tone: "todo" as const },
  { key: "waiting", label: "기다림", count: 2, tone: "wait" as const },
  { key: "sched", label: "일정", count: 1, tone: "ok" as const },
  { key: "jobs", label: "공사", count: 1, tone: "ok" as const },
  { key: "done", label: "끝남", count: 1, tone: "done" as const },
];

export function Gallery2() {
  const q = useSearchParams();
  const tab = q.get("tab") ?? "todo";
  const [view, setView] = useState("estimate");
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [sel, setSel] = useState<string | null>("v1");
  const [basis, setBasis] = useState<string | null>("supply");
  const [grade, setGrade] = useState<string | null>("basic");
  const [fee, setFee] = useState<string | null>("free");
  const [instant, setInstant] = useState(true);
  const [weekend, setWeekend] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({ name: true, num: true, ceo: false });
  const [act, setAct] = useState("warn");
  const [photos, setPhotos] = useState(PHOTOS);
  const [lb, setLb] = useState<number | null>(q.get("open") === "photo" ? 1 : null);
  const row = INBOX.find((r) => r.id === sel) ?? null;

  return (
    <>
      <Sec id="tabs" title="탭 · 거르기 알약">
        <p className={s.small}>밑줄 탭(이 화면 안 · 화살표 키로 옮겨요)</p>
        <Tabs id="vd" label="업체 상세" value={view} onChange={setView} items={[{ key: "estimate", label: "가견적" }, { key: "cases", label: "사례", count: 6 }, { key: "reviews", label: "리뷰", count: 5 }]} fill />
        <TabPanel tabsId="vd" tabKey="estimate" active={view === "estimate"}><p className={s.p}>가견적 칸이에요. 업체 단가 × 믿집 수량.</p></TabPanel>
        <TabPanel tabsId="vd" tabKey="cases" active={view === "cases"}><p className={s.p}>시공 사례 6개 칸이에요.</p></TabPanel>
        <TabPanel tabsId="vd" tabKey="reviews" active={view === "reviews"}><p className={s.p}>리뷰 5개 칸이에요.</p></TabPanel>
        <p className={s.small}>작업함 탭(주소 ?tab= · 상태 아이콘 · 수)</p>
        <Tabs variant="pill" label="작업함 탭" value={tab} items={TAB_ITEMS.map((t) => ({ ...t, href: `/dev/ui?tab=${t.key}#tabs` }))} />
        <p className={s.small}>관리자 상태 탭 + 종류 알약</p>
        <div className={s.row}>
          <Tabs variant="pill" label="처리 상태" value={status} onChange={setStatus} id="rs" items={[{ key: "open", label: "처리 기다림", count: 2 }, { key: "closed", label: "처리함" }]} />
          <Tabs variant="type" label="신고 종류" value={kind} onChange={setKind} id="rk" items={[{ key: "all", label: "전체" }, { key: "chat", label: "채팅" }, { key: "vendor", label: "업체" }, { key: "link", label: "링크" }]} />
        </div>
      </Sec>

      <Sec id="table" title="표(작업함 · 관리자) + 옆 자세히 칸">
        <DataTable
          caption="작업함"
          columns={COLS}
          rows={INBOX}
          rowKey={(r) => r.id}
          selected={sel}
          onSelect={(k) => setSel(k)}
          rowTone={(r) => (r.late ? "bad" : r.hold ? "warn" : null)}
          head={<><Tabs variant="pill" label="작업함 탭(표)" value="all" onChange={() => undefined} id="tb" items={[{ key: "all", label: "전체", count: 5 }, ...TAB_ITEMS.slice(0, 3)]} /><span className={s.small}>기한 가까운 순</span></>}
          foot={<StateLegend />}
          detailOnPhone={false}
          card={(r) => (
            <div className={s.card}>
              <div className={s.cardTop}><StateTag tone={r.tone}>{r.state}</StateTag>{r.hold ? <Badge>잡아 둠</Badge> : null}<span className={s.small}>{r.at}</span></div>
              <b className={s.cardTitle}>{r.area}</b>
              <span className={s.small}>{r.home}</span>
              <span className={s.p}><b>다음 일</b> {r.next}{r.due ? ` · ${r.due}까지` : ""}</span>
              {r.tone === "todo" ? <Button size="sm" href="/dev/ui#table">{r.next}</Button> : null}
            </div>
          )}
          detail={row ? (
            <>
              <StateTag tone={row.tone}>{row.state}</StateTag>
              <b className={s.cardTitle}>{row.area}</b>
              <SummaryRows size="sm" items={[
                { label: "집", value: "아파트 · 도배 전체 · 빈 집" },
                { label: "희망 기간", value: "12.7(월) ~ 12.21(월)", num: true },
                { label: "가견적", sub: "실크", value: "318만 6,150원", num: true },
                { label: "예산", sub: "고객이 넣었어요", value: "300만 원", num: true },
                { label: "답 기한", value: row.due ?? "—", num: true },
              ]} />
              <PhotoGrid label="집 사진" photos={PHOTOS.slice(0, 2)} />
              <p className={s.small}>위치는 동까지만 보여요. 동 · 호 · 연락처는 고객이 채팅으로 알려 줘요.</p>
              <div className={s.row}><Button variant="secondary" size="sm">못 받아요</Button><Button size="sm">기간 답하기</Button></div>
            </>
          ) : <p className={s.small}>줄을 고르면 자세히 보여요</p>}
        />
        <DataTable caption="빈 표" columns={COLS} rows={[]} rowKey={(r) => r.id} empty={<p className={s.small}>아직 받은 요청이 없어요</p>} />
      </Sec>

      <Sec id="controls" title="나눔 칸 · 켜기/끄기 · 체크">
        <Segmented legend="면적 기준" value={basis} onChange={setBasis} options={[{ value: "supply", label: "공급면적" }, { value: "exclusive", label: "전용면적" }]} />
        <Segmented legend="벽지" value={grade} onChange={setGrade} options={[{ value: "basic", label: "실크" }, { value: "economy", label: "합지", sub: "−31만 1,850원" }]} />
        <Segmented legend="실측 비용" value={fee} onChange={setFee} options={[{ value: "free", label: "무료" }, { value: "paid", label: "받아요" }, { value: "na", label: "다른 줄에 포함", disabled: true }]} />
        <div>
          <Switch label="바로 확정 받기" desc="고객이 고른 반나절을 묻지 않고 확정해요" checked={instant} onChange={setInstant} />
          <Switch label="주말 실측" checked={weekend} onChange={setWeekend} />
          <Switch label="출장 실측(준비 중)" disabled checked={false} />
        </div>
        <CheckGroup legend="사업자등록증 확인">
          <Check row label="상호가 같아요" checked={checks.name} onChange={(v) => setChecks((c) => ({ ...c, name: v }))} />
          <Check row label="등록번호가 같아요" checked={checks.num} onChange={(v) => setChecks((c) => ({ ...c, num: v }))} />
          <Check row label="대표자가 같아요" hint="이○○ · 신청서와 등록증" checked={checks.ceo} onChange={(v) => setChecks((c) => ({ ...c, ceo: v }))} />
        </CheckGroup>
        <CheckGroup legend="처리">
          {[["warn", "경고 보내기"], ["mute", "채팅 쓰기 막기"], ["stop", "업체 기능 멈추기"], ["ok", "문제없음으로 닫기"]].map(([v, l]) => (
            <Check key={v} row type="radio" name="act" value={v} label={l} danger={v === "stop"} checked={act === v} onChange={() => setAct(v)} />
          ))}
        </CheckGroup>
        <Check label="이용약관에 동의해요(필수)" defaultChecked />
      </Sec>

      <Sec id="info" title="요약 칸 · 파일 줄 · 안내 상자 · 얼굴 · 진행 중 띠">
        <ResumeStrip href="/dev/ui#band" badge="진행 중" title="상계동 아파트 도배" sub="지금: 마루와벽 날짜 고르기 · 11.25(수) 09:05까지" />
        <SummaryRows items={[{ label: "업체", value: "마루와벽" }, { label: "실측 날짜", value: "12.15(화) 오전", num: true }, { label: "확정 금액", sub: "부가세 포함", value: "326만 7,000원", num: true, strong: true }]} />
        <KeyValue items={[{ label: "희망 기간", value: "12.7~12.21", num: true }, { label: "고른 날", value: "12.15(화) 오전", num: true }, { label: "실측 비용", value: "무료" }, { label: "남은 반나절", value: "3", num: true }]} />
        <div className={s.stack}>
          <FileRow name="마루와벽_실측견적서_최종본_2026년11월.pdf" size={1258291} note="11.21 받음" href="/dev/ui#info" />
          <FileRow name="단가표.xlsx" size={84000} action={<Button variant="text" gray>빼기</Button>} />
          <FileRow name="사업자등록증.jpg" size={1258291} note="위치 정보 지움" href="/dev/ui#info" openLabel="크게" />
          <FileRow name="견적서.hwp" busy />
          <FileRow name="견적서.zip" size={2400000} error="PDF · 엑셀 · 사진만 올릴 수 있어요." />
        </div>
        <Notice icon title="동 · 호는 채팅으로 알려 줘요">위치는 동까지만 업체에 보여요.</Notice>
        <Notice tone="gray">바로 확정으로 잡힌 반나절은 열어 둔 다른 요청 기간에서 빠져요.</Notice>
        <Notice tone="warn" icon>믿집 밖 거래를 권하면 신고할 수 있어요.</Notice>
        <div className={s.row}><Avatar name="마루와벽" size="s" /><Avatar name="결도배" /><Avatar name="한결인테리어" size="l" warm label="한결인테리어" /></div>
      </Sec>

      <Sec id="plan" title="공정표 · 업체 일정 칸 · 크게 보기">
        <p className={s.small}>예상 공정표(C08, 날 칸 · 쉬는 날 흐리게)</p>
        <ScheduleChart caption="예상 공정표" days={WEEK_JAN} today="2027-01-04" rows={[{ key: "dobae", name: "도배", cells: ["2027-01-04", "2027-01-05"].map((day) => ({ day, label: "도배", note: "2일" })) }]}
          legend={["work", "off"]} note="반나절로 계산해 하루 단위로 잡았어요. 회색 칸은 공사를 쉬는 날(토 · 일 · 공휴일)이에요." />
        <p className={s.small}>확정 공정표(D19, 반나절 칸 · 공정 둘 · 건조 · 청소 칸 켬)</p>
        <ScheduleChart caption="확정 공정표" half days={WEEK_JAN2} showAfter
          rows={[
            { key: "wood", name: "목공", sub: "한결인테리어 · 2명", cells: [{ day: "2027-01-04", label: "목공", note: "1일" }] },
            { key: "dobae", name: "도배", sub: "마루와벽 · 2명", cells: [{ day: "2027-01-05", label: "도배", note: "1.5일" }, { day: "2027-01-06", half: "am", label: "도배", note: "1.5일" }] },
            { key: "after", name: "마무리", sub: "고객이 해요", cells: [{ day: "2027-01-07", kind: "dry", label: "자연 건조" }, { day: "2027-01-08", kind: "dry", label: "자연 건조" }, { day: "2027-01-09", kind: "clean", label: "입주 청소" }] },
          ]}
          legend={["work", "dry", "clean", "off"]} />
        <p className={s.small}>쉬는 날이 낀 주(공휴일 이름)</p>
        <ScheduleChart caption="연말연시 공정표" days={WEEK_HOL} rows={[{ key: "dobae", name: "도배", cells: [{ day: "2026-12-31", label: "도배" }, { day: "2027-01-04", label: "도배" }] }]} />
        <p className={s.small}>업체 일정 반나절 칸(V08 · D14: 팀 줄 × 오전 · 오후)</p>
        <ScheduleChart caption="12월 14일 주 일정" half labelHead="팀" days={WEEK_DEC} today="2026-12-15"
          rows={[
            { key: "t1", name: "1팀", sub: "2명", cells: [
              { day: "2026-12-15", half: "am", kind: "booked", label: "상계동 69.4㎡", href: "/dev/ui#plan" },
              { day: "2026-12-15", half: "pm", kind: "booked", label: "공릉동 76.0㎡", href: "/dev/ui#plan" },
              { day: "2026-12-17", half: "am", kind: "hold", label: "창동 84.0㎡" },
            ] },
            { key: "t2", name: "2팀", sub: "1명", cells: [
              { day: "2026-12-16", half: "pm", kind: "booked", label: "월계동 82.6㎡" },
              { day: "2026-12-18", kind: "pending", label: "하계동 59.9㎡" },
            ] },
          ]}
          legend={["booked", "hold", "pending", "off"]} note="바로 확정으로 잡힌 반나절과 잡아 둔 반나절은 다른 요청 기간에서 빠져요." />
        <p className={s.small}>같은 일정 · 폰 목록을 날짜 묶음 머리로(V08: heads="near" · restHead="이번 주")</p>
        <ScheduleChart caption="12월 14일 주 일정(묶음)" half labelHead="팀" days={WEEK_DEC} today="2026-12-15" heads="near" restHead="이번 주"
          rows={[
            { key: "t1", name: "1팀", cells: [
              { day: "2026-12-15", half: "am", kind: "booked", label: "상계동 69.4㎡", note: "실측 · 빈 집", href: "/dev/ui#plan" },
              { day: "2026-12-15", half: "pm", kind: "booked", label: "공릉동 76.0㎡", note: "실측 · 사는 중" },
              { day: "2026-12-17", half: "am", kind: "hold", label: "창동 84.0㎡", note: "고객이 고른 날 · 오늘 18:00까지 수락해요" },
            ] },
            { key: "t2", name: "2팀", cells: [
              { day: "2026-12-16", half: "pm", kind: "booked", label: "월계동 82.6㎡", note: "실측 · 사는 중" },
              { day: "2026-12-18", half: "am", kind: "booked", label: "하계동 59.9㎡", note: "실측 · 빈 집" },
            ] },
          ]} />
        <p className={s.small}>시공 사례 사진(누르면 크게 보기 · ← → · Esc · 폰은 넘기기)</p>
        <PhotoGrid label="시공 사례 사진" photos={CASES.map((c) => ({ key: c.key, src: c.src, alt: c.alt, label: c.title?.split(" · ")[0] }))} onOpen={setLb} />
        <Lightbox open={lb !== null} start={lb ?? 0} onClose={() => setLb(null)} photos={CASES} label="시공 사례" />
      </Sec>

      <Sec id="log" title="기록 · 접는 목록 · 사진 칸">
        <EventLog items={[
          { key: "1", at: "2026-11-18T11:00:00+09:00", who: "고객", what: "마루와벽 · 결도배에 실측 일정 요청을 보냈어요" },
          { key: "2", at: "2026-11-18T14:20:00+09:00", who: "마루와벽", what: "갈 수 있는 기간을 답했어요(12.13~12.18)" },
          { key: "3", at: "2026-11-19T09:05:00+09:00", who: "고객", what: "12.15(화) 오전으로 골랐어요" },
        ]} />
        <Accordion name="faq" items={[
          { key: "q-grade", q: "합지랑 실크는 뭐가 달라요?", a: <p>합지는 종이 벽지, 실크는 겉에 비닐 막을 입힌 벽지예요. 표준견적서는 고른 벽지로 계산해요.</p> },
          { key: "q-days", q: "공사는 며칠 걸려요?", a: <p>예상 공정표에서 반나절 단위로 보여요. 확정은 업체가 공사 날짜를 올린 뒤예요.</p> },
        ]} />
        <PhotoGrid label="올린 집 사진" photos={photos} onRemove={(k) => setPhotos((p) => p.filter((x) => x.key !== k))} />
      </Sec>
    </>
  );
}
