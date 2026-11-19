"use client";
// 평으로 넣기(C03): 폰 아래 시트 · 웹 가운데 창. 평은 넣을 때만 돕고, 칸에는 ㎡로 넣어요(저장 · 계산 · 견적서는 ㎡).
// 넣는 평이 분양 평형(공급)인지 전용 평인지 먼저 골라요(고객 대변인 F03 · 리드 바로 고칠 것). 고른 기준이 면적 칸 기준이 돼요.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CalcBox } from "@/components/ui/CalcBox";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { PYEONG_M2, pyeongToM2, type Basis } from "@/lib/guest/info";
import s from "./info.module.css";

export function PyeongSheet({ open, basis, onClose, onApply }: {
  open: boolean;
  /** 면적 칸에서 고른 기준(처음 값) */
  basis: Basis;
  onClose: () => void;
  onApply: (m2: string, basis: Basis) => void;
}) {
  const [p, setP] = useState("");
  const [b, setB] = useState<Basis>(basis);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const m2 = pyeongToM2(p);

  useEffect(() => {
    if (!open) return;
    setB(basis);
    setErr(null);
  }, [open, basis]);

  const apply = () => {
    if (!m2 || Number(m2) <= 10 || Number(m2) >= 400) {
      setErr(!p.trim() ? "평 숫자를 넣어 주세요. 예: 21" : "면적이 너무 작거나 커요. 평 숫자를 다시 확인해 주세요.");
      ref.current?.focus();
      return;
    }
    onApply(m2, b);
    setP("");
  };
  const word = b === "exclusive" ? "전용" : "공급";

  return (
    <Sheet open={open} onClose={onClose} title="평으로 넣기" actions={<Button size="lg" block onClick={apply}>{m2 ? `${word} ${m2}㎡로 넣기` : "㎡로 넣기"}</Button>}>
      <div className={s.sheetBody}>
        <Segmented
          legend="넣는 평"
          full
          options={[{ value: "supply", label: "공급 평(분양 평형)" }, { value: "exclusive", label: "전용 평" }]}
          value={b}
          onChange={(v) => setB(v === "exclusive" ? "exclusive" : "supply")}
        />
        <Field ref={ref} label="평" hideLabel unit="평" num value={p} error={err} onChange={(e) => { setP(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} />
        {m2 ? <CalcBox tone="form" lines={[{ terms: [{ n: p.trim(), unit: "평" }, "×", { n: String(PYEONG_M2) }], result: { n: m2, unit: "㎡" } }]} /> : null}
        <p className={s.help}>계산 · 견적서는 ㎡로 해요. 평은 넣을 때만 써요.</p>
      </div>
    </Sheet>
  );
}
