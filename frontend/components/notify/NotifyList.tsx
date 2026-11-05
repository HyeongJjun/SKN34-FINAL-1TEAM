// 알림 목록(시안 WNotify). 서울 날짜로 묶고, 줄마다 안 읽음 · 읽음, 시각, 본문, 갈 곳을 보인다.
import type { Notice } from "@/lib/api/notify";
import { dateSeoul, md } from "@/lib/format";
import { safeNext } from "@/components/auth/next";
import { NotifyLink } from "./NotifyLink";
import s from "./notify.module.css";

const CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

// 갈 곳 이름: link 경로로 고른다. 모르는 경로는 '보기'
const GO: [RegExp, string][] = [
  [/^\/projects\/[^/?#]+\/schedule/, "날짜 확인"],
  [/^\/projects\/[^/?#]+\/quotes/, "견적 비교"],
  [/^\/projects\/[^/?#]+\/visits/, "실측 요청 보기"],
  [/^\/projects\/[^/?#]+\/vendors/, "업체 고르기"],
  [/^\/projects\/[^/?#]+\/plan/, "공정표 보기"],
  [/^\/projects\/[^/?#]+\/standard/, "표준견적서 보기"],
  [/^\/projects\/[^/?#]+(?:[?#]|$)/, "공사 보기"],
  [/^\/vendor\/jobs/, "일정 보기"],
  [/^\/vendor\/profile/, "업체 정보 보기"],
  [/^\/vendor(?:[/?#]|$)/, "작업함 보기"],
];

/** 이 사이트 안 경로만 연다. 아니면 알림 화면에 머문다. */
const safeHref = (link: string) => safeNext(link) ?? "/notifications";

function Dot({ filled }: { filled: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      {filled ? <circle cx="5" cy="5" r="4.5" fill="currentColor" /> : <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  );
}

export function NotifyList({ items }: { items: Notice[] }) {
  const days: { day: string; items: Notice[] }[] = [];
  for (const n of items) {
    const day = dateSeoul(n.created_at);
    const last = days.at(-1);
    if (last && last.day === day) last.items.push(n);
    else days.push({ day, items: [n] });
  }
  return (
    <>
      {days.map((d) => (
        <section key={d.day} className={s.day} aria-labelledby={`d-${d.day}`}>
          <h2 id={`d-${d.day}`} className={`mj-num ${s.dh}`}>{md(d.day)}</h2>
          <ul className={`mj-num ${s.list}`}>
            {d.items.map((n) => {
              const href = safeHref(n.link);
              const go = GO.find(([re]) => re.test(href))?.[1] ?? "보기";
              return (
                <li key={n.id}>
                  <NotifyLink id={n.id} href={href} unread={!n.read} className={`${s.row} ${n.read ? "" : s.new}`}>
                    <span className={`${s.st} ${n.read ? s.read : ""}`}><Dot filled={!n.read} />{n.read ? "읽음" : "안 읽음"}</span>
                    <time className={s.time} dateTime={n.created_at}>{CLOCK.format(new Date(n.created_at))}</time>
                    <span className={s.text}>{n.body}</span>
                    <span className={s.go}>{go}<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5.5 3L9.5 7l-4 4" /></svg></span>
                  </NotifyLink>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
