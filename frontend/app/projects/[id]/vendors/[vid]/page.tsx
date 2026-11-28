// /projects/{id}/vendors/{vid} — 업체 자세히
// 2026-11-27 사용자: 옛 화면이 나오지 않게 재재 화면(/projects/{id}/assistant)의 같은 창 · 보드 칸으로 보내요.
// 알림 · 메일 · 공유 주소는 그대로 두고 여기서 넘겨요. 남의 공사 · 없는 공사는 재재 화면이 404예요.
import { redirect } from "next/navigation";

export const metadata = { title: "업체 자세히" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string; vid: string }>; searchParams: Promise<{ trade?: string | string[]; grade?: string | string[]; photo?: string | string[] }> }) {
  const [{ id, vid }, q] = await Promise.all([params, searchParams]);
  // 벽지(?grade) · 크게 볼 사진(?photo)도 업체 창으로 넘겨요(#237 리뷰). 값 확인은 재재 화면(cameFrom)이 해요
  const u = new URLSearchParams({ step: "2", vendor: vid });
  for (const k of ["trade", "grade", "photo"] as const) { const v = q[k]; const one = Array.isArray(v) ? v[0] : v; if (one) u.set(k, one); }
  redirect(`/projects/${encodeURIComponent(id)}/assistant?${u}`);
}
