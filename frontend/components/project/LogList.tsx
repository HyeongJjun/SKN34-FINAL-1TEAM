// 한 공사 화면 · 기록(C63): 실측 일정 · 견적서 · 공사 이력을 시간 순 한 줄씩. 고객과 업체가 같은 기록을 봐요.
import type { ApiLogItem } from "@/lib/api/schedule";
import { EmptyState } from "@/components/ui/EmptyState";
import { Group, Meta } from "./Kit";
import { logLines } from "./logText";
import s from "./home.module.css";

export function LogList({ items }: { items: ApiLogItem[] }) {
  const lines = logLines(items);
  return (
    <>
      {lines.length ? (
        <Group>
          <ol className={s.log} aria-label="기록">
            {lines.map((x) => (
              <li key={x.key} className={s.logRow}>
                <time className={`${s.logTime} mj-num`} dateTime={x.at}>{x.time}</time>
                <span className={s.logWho}>{x.who}</span>
                <span className={s.logText}>{x.text}</span>
              </li>
            ))}
          </ol>
        </Group>
      ) : (
        <EmptyState icon="clock" title="아직 기록이 없어요">실측을 요청하면 여기에 한 줄씩 쌓여요</EmptyState>
      )}
      <Meta>고객과 업체가 같은 기록을 봐요. 다툼 · 신고 때 근거가 돼요.</Meta>
    </>
  );
}
