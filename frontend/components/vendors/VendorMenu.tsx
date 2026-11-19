"use client";
// 업체 자세히 머리 ⋯ '업체 메뉴'(C11 · CF-68): '업체 신고' 하나. 신고 창은 채팅 신고와 같은 ReportSheet(C31)를 써요.
// 폰에서는 메뉴가 아래 시트라 기록 한 칸을 쓰고 닫혀요. 그 칸이 걷힌 다음에 신고 창을 열어야 뒤로 가기가 한 번에 하나씩 닫혀요.
import { useState } from "react";
import { ReportSheet } from "@/components/report/ReportSheet";
import { Menu } from "@/components/ui/Menu";

/** 메뉴 시트(폰)가 쓴 기록 칸이 걷힌 뒤에 열어요 */
export function afterMenu(fn: () => void) {
  if (!history.state?.mjModal) { fn(); return; }
  const once = () => { window.removeEventListener("popstate", once); fn(); };
  window.addEventListener("popstate", once);
}

export function VendorMenu({ vendorId, name, className }: { vendorId: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu label="업체 메뉴" icon="more" className={className} items={[{ label: "업체 신고", onSelect: () => afterMenu(() => setOpen(true)) }]} />
      <ReportSheet open={open} onClose={() => setOpen(false)} kind="vendor" targetName={name} vendorId={vendorId} />
    </>
  );
}
