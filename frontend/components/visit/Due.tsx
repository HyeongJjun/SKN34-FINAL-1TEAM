// 기한 배지(9판 k-bdg mute · copy-guide F4): '11.25(수) 09:05까지'. 지남 · 가까움은 서버가 준 값(next.overdue · soon)을 그대로 써요.
// (B4 DueBadge는 now를 받아 화면에서 견줘요. 실측 일정은 API가 '지남'을 계산해 주므로 이 조각을 써요 — api.md 5장)
import { dueText } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export function DueChip({ due, overdue, soon, overText = "지났어요", who }: { due: string; overdue?: boolean; soon?: boolean; overText?: string; who?: string }) {
  const tone = overdue ? "bad" : soon ? "wait" : "mute";
  return (
    <Badge tone={tone}>
      <Icon name={overdue ? "error" : "clock"} size={14} />
      <time dateTime={due} className="mj-num">{overdue ? overText : dueText(due)}</time>
      {who && !overdue ? <span>{who}</span> : null}
    </Badge>
  );
}
