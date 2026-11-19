"use client";
// 가견적 벽지 나눔 칸(C11 · D07 '실크 | 합지 −31만 1,850원'). 고르면 주소 ?grade=를 바꿔 그 벽지의 가견적을 서버에서 다시 받아요.
// 다른 칸 아래 금액은 API grade_diff(다른 벽지 − 보이는 벽지) 그대로예요. 화면에서 빼거나 더하지 않아요.
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/Segmented";
import { wonDelta } from "@/lib/format";

type Grade = "basic" | "economy";

export function GradeToggle({ grade, diff }: { grade: Grade; diff: number | null }) {
  const router = useRouter();
  const path = usePathname();
  const [want, setWant] = useState<Grade | null>(null);
  const [pending, start] = useTransition();
  const shown = pending && want ? want : grade;
  const sub = (g: Grade) => (g !== grade && diff != null && !pending ? wonDelta(diff) : undefined);
  const pick = (v: string) => {
    const g = v === "economy" ? "economy" : "basic";
    if (g === grade) return;
    setWant(g);
    start(() => router.replace(`${path}?grade=${g}`, { scroll: false }));
  };
  return (
    <div aria-busy={pending || undefined}>
      <Segmented
        legend="벽지"
        hideLegend
        value={shown}
        onChange={pick}
        options={[
          { value: "basic", label: "실크", sub: sub("basic") },
          { value: "economy", label: "합지", sub: sub("economy") },
        ]}
      />
    </div>
  );
}
