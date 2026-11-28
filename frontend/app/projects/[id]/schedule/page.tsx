// /projects/{id}/schedule — 공사 날짜 · 추가 금액 · 공사 끝 확인(?view=dates|extra|done)
// 2026-11-27 사용자: 옛 화면이 나오지 않게 재재 화면(/projects/{id}/assistant)의 같은 창 · 보드 칸으로 보내요.
// 알림 · 메일 · 공유 주소는 그대로 두고 여기서 넘겨요. 남의 공사 · 없는 공사는 재재 화면이 404예요.
import { redirect } from "next/navigation";

export const metadata = { title: "공사 일정" };

const VIEWS = ["dates", "extra", "done"];

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string | string[] }> }) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const v = Array.isArray(view) ? view[0] : view;
  redirect(`/projects/${encodeURIComponent(id)}/assistant?open=schedule${v && VIEWS.includes(v) ? `&view=${v}` : ""}`);
}
