"use client";
// 업체 자세히 아래 단추(C11 · D07): [담음 ✓ | 담기] [실측 일정 잡기]. 담기는 업체 보기와 같은 POST · DELETE …/shortlist예요.
// 담음은 눌린 단추(aria-pressed)로 읽혀요(CF-76). 가견적이 없거나 고른 벽지를 안 하거나 3곳을 다 담았으면 '담을 수 없어요'.
// 담을 때 지금 보는 벽지(grade)를 같이 보내요: 그 벽지의 가견적으로 요청해요(C11 · ShortlistIn.grade).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ApiError, call, errorText } from "@/lib/backend/client";
import { eulReul } from "@/lib/format";
import { pickRule } from "@/components/secretary/boardLink";

const MAX = 3;

export function DetailActions({ projectId, vendorId, name, grade, trade = "dobae", canPick, shortlisted, count, mock, pick }: {
  projectId: string;
  vendorId: string;
  name: string;
  /** 지금 보는 벽지 */
  grade: "basic" | "economy";
  /** 담는 공정(벽지는 도배만 보내요) */
  trade?: "dobae" | "mokgong";
  /** 가견적이 있고 고른 벽지를 하는 업체(state ok) */
  canPick: boolean;
  shortlisted: boolean;
  /** 이 공사에 담은 업체 수 */
  count: number;
  /** 보드 · 업체 창과 같은 담기 규칙(#221 리뷰): 그 공정 확정 · 이 업체 실측 요청 중 · 남은 칸 */
  pick?: { locked: boolean; left: number; live: boolean };
  mock: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(shortlisted);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);
  const pid = encodeURIComponent(projectId);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (!mock) {
        if (on) await call("DELETE", `/projects/${pid}/shortlist/${encodeURIComponent(vendorId)}?trade=${trade}`);
        else await call("POST", `/projects/${pid}/shortlist`, trade === "dobae" ? { trade, vendor_id: vendorId, grade } : { trade, vendor_id: vendorId });
      }
      setOn(!on);
      setN((x) => Math.max(0, x + (on ? -1 : 1)));
      toast.show(`${eulReul(name)} ${on ? "뺐어요" : "담았어요"}`);
      if (!mock) router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already" && !on) { setOn(true); }
      toast.show(errorText(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  // 이 화면에서 담고 뺀 만큼 남은 칸을 맞춰요
  const left = pick ? pick.left - (n - count) : MAX - n;
  const can = pickRule({ vendor_id: vendorId, shortlisted: on }, { locked: !!pick?.locked, left, live: new Set(pick?.live ? [vendorId] : []) });
  const shut = pick?.live ? "실측 요청한 업체예요" : pick?.locked ? `${trade === "mokgong" ? "목공" : "도배"} 업체를 확정했어요` : !on && left <= 0 ? "3곳을 다 담았어요" : !on && !canPick ? "담을 수 없어요" : null;
  const blocked = on ? !can.remove : !(can.add && canPick);
  return (
    <>
      {blocked ? (
        <Button variant="weak" size="lg" disabled>{shut ?? "담을 수 없어요"}</Button>
      ) : (
        <Button variant="weak" size="lg" aria-pressed={on} busy={busy} onClick={() => void toggle()}>
          {on ? <>담음 <Icon name="check" size={18} strokeWidth={2.6} /></> : "담기"}
        </Button>
      )}
      <Button size="lg" href={`/projects/${pid}/visits/new`} disabled={n === 0}>실측 일정 잡기</Button>
    </>
  );
}
