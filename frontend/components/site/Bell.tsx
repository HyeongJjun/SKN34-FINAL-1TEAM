// 옛 화면(SiteHeader) 폰 머리의 알림 종 링크. 새 화면 폰은 아래 탭 바 '알림', 웹은 NotifyBell 펼침을 써요.
// 안 읽은 수는 부르는 쪽(SiteHeader → lib/api/notify.ts)이 넘겨요. 0이면 수를 두지 않아요.
import Link from "next/link";
import { Count } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import s from "./header.module.css";

export function Bell({ unread, href = "/notifications" }: { unread: number; href?: string }) {
  const label = unread > 0 ? `알림, 새 알림 ${unread}개` : "알림";
  return (
    <Link href={href} className={s.pbell} aria-label={label}>
      <Icon name="bell" />
      <Count n={unread} className={s.pcount} />
    </Link>
  );
}
