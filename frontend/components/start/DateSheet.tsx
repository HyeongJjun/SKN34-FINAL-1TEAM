"use client";
// 공사 시작 희망일 고르기(C02 '2027.1.4(월) ▾'): 폰 아래 시트 · 웹 가운데 창. 오늘 전 날은 고를 수 없어요(오늘은 서버가 준 서울 날짜).
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { Sheet } from "@/components/ui/Sheet";

export function DateSheet({ open, value, today, onClose, onApply }: {
  open: boolean;
  value: string | null;
  today: string;
  onClose: () => void;
  onApply: (day: string) => void;
}) {
  const [day, setDay] = useState<string | null>(value);
  useEffect(() => { if (open) setDay(value); }, [open, value]);
  return (
    <Sheet open={open} onClose={onClose} title="공사 시작 희망일" actions={<Button size="lg" block disabled={!day} onClick={() => day && onApply(day)}>선택</Button>}>
      <Calendar mode="single" label="공사 시작 희망일" today={today} month={value ?? today} value={day} onChange={setDay} />
    </Sheet>
  );
}
