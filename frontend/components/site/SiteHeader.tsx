// 옛 화면의 머리(지금 화면들이 쓰는 이름 그대로). 웹 머리는 v3와 같고, 폰은 로고 + 종 + '메뉴' 펼침을 그대로 둬요.
// 붙지 않는 머리라 옛 화면의 붙는 옆 칸(top: 24px)을 가리지 않아요. 새 화면은 AppHeader + TabBar를 써요.
// variant="admin"은 관리자 화면 레이아웃이 넘겨요. 고객 화면에는 오른쪽 아래 '공사 상담' 단추(예시 답변)를 같이 붙여요(B5의 AI 칸으로 바뀌기 전까지).
import { AskLauncher } from "./AskLauncher";
import { HeaderBar } from "./HeaderBar";
import { getShellData } from "./who";

export async function SiteHeader({ variant = "user" }: { variant?: "user" | "admin" }) {
  const { session, unread } = await getShellData();
  const admin = variant === "admin";
  return (
    <>
      <HeaderBar session={session} admin={admin} unread={admin ? 0 : unread} legacy sticky={false} />
      {session?.role === "customer" ? <AskLauncher /> : null}
    </>
  );
}
