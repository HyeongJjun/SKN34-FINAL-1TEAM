"use client";
// 업체 자세히(오른쪽 창 · 전체 화면)의 '실측 요청에 담기' (시안 WVendorsPanel). 업체 고르기 목록과 같은 담은 업체 목록을 쓴다(pick.ts).
// 요청은 업체 고르기의 '실측 요청 보내기' 하나로만 보낸다. 담을 수 있는 수(slotsLeft)는 서버가 정한다(공정마다 3곳까지).
import { Picked, Plus } from "./icons";
import { usePick, writePick } from "./pick";
import type { VTrade } from "./text";
import s from "./VendorBoard.module.css";

type Props = { projectId: string; trade: VTrade; vendorId: string; name: string; slotsLeft: number; again?: boolean; hintId: string };

export function PickButton({ projectId, trade, vendorId, name, slotsLeft, again = false, hintId }: Props) {
  const { ids, msg } = usePick(projectId, trade);
  const on = ids.includes(vendorId);
  const taken = Math.min(ids.length, Math.max(0, slotsLeft));
  const full = !on && taken >= slotsLeft;
  function toggle() {
    if (on) writePick(projectId, trade, { ids: ids.filter((x) => x !== vendorId), msg });
    else if (!full) writePick(projectId, trade, { ids: [...ids, vendorId], msg });
  }
  const hint = slotsLeft <= 0
    ? "이미 3곳에 요청했어요. 요청을 취소하거나 업체가 못 받으면 칸이 비어요."
    : full ? "3곳까지 담았어요. 하나를 빼면 담을 수 있어요." : `${taken}곳 담음 · 3곳까지`;
  return (
    <>
      <button type="button" className={`${s.pick} ${s.pickWide}`} aria-pressed={on} aria-disabled={full || undefined} aria-describedby={hintId} onClick={toggle}>
        {on ? <Picked /> : <Plus />}{on ? "담았어요" : again ? "다시 담기" : "실측 요청에 담기"}<span className="mj-sr">, {name}</span>
      </button>
      <p id={hintId} className="mj-small mj-num">{hint}</p>
    </>
  );
}
