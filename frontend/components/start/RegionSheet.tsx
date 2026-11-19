"use client";
// 지역 고르기(C02 '서울 노원구 ▾'): 지역 두 칸 목록(components/ui/RegionPicker)에서 하나. 폰 아래 시트 · 웹 가운데 창.
// 동은 받지 않아요. 표준견적서는 모든 시 · 군 · 구에서 나오고, 업체는 업체 고르기에서 시공 지역으로 걸러요.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RegionPicker, regionKey } from "@/components/ui/RegionPicker";
import { Sheet } from "@/components/ui/Sheet";
import type { Region } from "@/lib/api/project";

type Place = { sido: string; sgg: string };

export function RegionSheet({ open, regions, value, onClose, onApply }: {
  open: boolean;
  regions: Region[];
  value: Place;
  onClose: () => void;
  onApply: (p: Place) => void;
}) {
  const [sido, setSido] = useState(value.sido);
  const [sgg, setSgg] = useState(value.sgg);
  // 열리는 그 그림에서 바로 지금 값으로 맞춰요(효과로 맞추면 목록이 빈 값으로 먼저 그려져 고른 줄로 못 옮겨요)
  const [shown, setShown] = useState(false);
  if (open !== shown) {
    setShown(open);
    if (open) { setSido(value.sido || regions[0]?.id || ""); setSgg(value.sgg); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="지역 고르기"
      actions={<Button size="lg" block disabled={!sido || !sgg} onClick={() => sido && sgg && onApply({ sido, sgg })}>선택</Button>}>
      <RegionPicker mode="one" label="지역" regions={regions}
        sido={sido} onSido={(v) => { if (v !== sido) { setSido(v); setSgg(""); } }}
        value={sido && sgg ? [regionKey(sido, sgg)] : []}
        onChange={(keys) => setSgg(keys[0]?.slice(sido.length + 1) ?? "")} />
    </Sheet>
  );
}
