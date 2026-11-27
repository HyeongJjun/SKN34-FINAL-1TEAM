// 승인 · 처음 할 일(V02 v_first) = 업체 정보 탭의 첫 화면. 9판: 업체 정보 탭 · 업체 정보 · 링크 · 리뷰 화면의 ‹ 가 이 화면으로 와요.
// /vendor(받은 요청이 아직 없을 때)와 /vendor/profile(탭 '업체 정보')이 같이 써요.
// 마친 일(✓)은 부르는 쪽이 지금 있는 읽기로 정해 넘겨요: 단가 = v3 확인 묶음 있음 · 업체 정보 = 한 번이라도 저장 · 링크 = 1개 이상.
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Group, Hero } from "../ui/parts";
import s from "./home.module.css";

export type FirstDone = { prices: boolean; profile: boolean; links: boolean };

export function FirstDay({ done, waiting }: { done: FirstDone; /** 답글 기다리는 리뷰 수 */ waiting?: number }) {
  const items = [
    { k: "prices", on: done.prices, t: "도배 단가 넣기", d: "견적서 줄마다 단가 · 다른 줄에 포함 · 빼기", href: "/vendor/prices/dobae" },
    { k: "profile", on: done.profile, t: "업체 정보 · 시공 사례", d: "출장비 · 연락 방법 · 사진", href: "/vendor/profile?tab=basic" },
    { k: "links", on: done.links, t: "외부 리뷰 · 시공 사례 링크", d: "외부 리뷰 링크는 3개까지 · 관리자가 확인해요", href: "/vendor/profile?tab=links" },
  ];
  const left = items.some((x) => !x.on);
  return (
    <>
      {left ? (
        <Hero badge={<Badge tone="ok">승인됐어요</Badge>} title={<>고객에게 보일<br />준비를 해요</>} sub="단가를 넣고 확인하면 고객에게 가견적이 보여요." />
      ) : (
        <Hero title="업체 정보" sub="고객에게 보이는 단가 · 정보 · 링크를 여기서 고쳐요." />
      )}
      <Group flush>
        <ul className={s.todo} aria-label="처음 할 일">
          {items.map((x) => (
            <li key={x.k}>
              <Link className={s.ti} href={x.href}>
                <span className={`${s.ck} ${x.on ? s.ckOn : ""}`} aria-hidden="true">{x.on ? <Icon name="check" size={14} strokeWidth={3} /> : null}</span>
                <span className={s.tt}>
                  <b><span className="mj-sr">{x.on ? "마쳤어요, " : "아직 안 했어요, "}</span>{x.t}</b>
                  <span>{x.d}</span>
                </span>
                <Icon name="chevron-right" size={18} className={s.chev} />
              </Link>
            </li>
          ))}
          {/* 폰은 아래 탭이 넷이라 영업일을 업체 정보 목록에 둬요(웹은 머리 메뉴에도 있어요) */}
          <li>
            <Link className={s.ti} href="/vendor/open-days">
              <span className={s.tt}>
                <b>실측 영업일</b>
                <span>실측 받는 요일 · 쉬는 날. 고객은 이 날만 고를 수 있어요</span>
              </span>
              <Icon name="chevron-right" size={18} className={s.chev} />
            </Link>
          </li>
          <li>
            <Link className={s.ti} href="/vendor/reviews">
              <span className={s.tt}>
                <b>리뷰 · 답글</b>
                <span>{waiting ? `답글 기다림 ${waiting}` : "고객이 리뷰를 쓰면 여기서 답글을 달아요"}</span>
              </span>
              <Icon name="chevron-right" size={18} className={s.chev} />
            </Link>
          </li>
        </ul>
      </Group>
    </>
  );
}
