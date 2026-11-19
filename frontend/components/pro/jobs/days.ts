// 공사 날 목록 글(V11 · V23 · V13). 날을 새로 만들지 않고 API가 준 날만 모양을 바꿔요.
import { dateLong, dateShort } from "@/lib/format";

/** long: '1월 4일(월) · 5일(화)'(같은 달은 달을 한 번만) · 짧게: '1.4(월) · 1.5(화)' */
export function daysText(days: string[], long = false): string {
  const sorted = [...days].sort();
  if (!long) return sorted.map((d) => dateShort(d)).join(" · ");
  let month = "";
  return sorted.map((d) => {
    const full = dateLong(d);
    const m = d.slice(0, 7);
    const out = m === month ? full.replace(/^\d+월 /, "") : full;
    month = m;
    return out;
  }).join(" · ");
}
