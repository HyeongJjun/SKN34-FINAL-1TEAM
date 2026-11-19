// 실측 견적서 비교(C33 · D18 · C34) 화면 말. 금액 · 차이 · 유효기간 지남은 계산 엔진 값을 모양만 바꿔요(lib/format).
import type { ApiCompare } from "@/lib/api/schedule";
import { dateSeoul, dateShort, won } from "@/lib/format";

export type CompareRow = ApiCompare["vendors"][number];
export type VendorQuote = NonNullable<CompareRow["latest"]>;
export type Chip = { text: string; spoken: string; tone?: "on" | "warn" };

/** 받은 날(카드 머리): '12.17 받음'(9판 C33) */
export function receivedText(sentAt: string | null | undefined): string | null {
  if (!sentAt) return null;
  const [, m, d] = dateSeoul(sentAt).split("-").map(Number);
  return `${m}.${d} 받음`;
}

/** 업체가 적은 금액의 부가세 방식 */
export function vatText(mode: string | null | undefined): string {
  if (mode === "excluded") return "부가세 빼고";
  if (mode === "exempt") return "면세";
  return "부가세 포함";
}

/** 하자 보수 기간: 12 → '1년' · 6 → '6개월' */
export function warrantyText(months: number): string {
  return months >= 12 && months % 12 === 0 ? `${months / 12}년` : `${months}개월`;
}

/** 포함됐나요?(D21 A) 칩 4개. 업체가 안 고른 칸은 '안 적음', 빠진 것은 '따로'(주의 모양). 읽는 글은 '포함: 철거'(CF-77) */
export function incChips(q: VendorQuote): Chip[] {
  const out: Chip[] = [];
  const yesNo = (v: boolean | null | undefined, name: string) => {
    if (v === true) out.push({ text: name, spoken: `포함: ${name}`, tone: "on" });
    else if (v === false) out.push({ text: `${name} 따로`, spoken: `따로: ${name}`, tone: "warn" });
    else out.push({ text: `${name} 안 적음`, spoken: `안 적음: ${name}`, tone: "warn" });
  };
  yesNo(q.incl_removal, "철거");
  yesNo(q.incl_waste, "폐기물");
  if (q.paper_spec) out.push({ text: q.paper_spec, spoken: `포함: 벽지 ${q.paper_spec}`, tone: "on" });
  else out.push({ text: "제조사 · 규격 안 적음", spoken: "안 적음: 제조사 · 규격", tone: "warn" });
  if (q.warranty_months != null && q.warranty_months > 0) out.push({ text: `하자 ${warrantyText(q.warranty_months)}`, spoken: `포함: 하자 보수 ${warrantyText(q.warranty_months)}`, tone: "on" });
  else out.push({ text: "하자 보수 안 적음", spoken: "안 적음: 하자 보수 기간", tone: "warn" });
  return out;
}

/** 가견적과 차이 한 줄: '가견적 277만 4,200원보다 8만 5,800원 많아요' — 차이는 엔진 값(diff_vs_estimate).
 *  웹 표는 줄 머리가 '가견적과 차이'라서 앞의 '가견적'을 빼요(named=false, 9판 D18). */
export function diffText(r: CompareRow, named = true): { lead: string; amount: string; tail: string } | null {
  if (r.diff_vs_estimate == null || r.estimate_total == null) return null;
  const d = r.diff_vs_estimate;
  const base = `${named ? "가견적 " : ""}${won(r.estimate_total)}`;
  if (d === 0) return { lead: `${base}과`, amount: "", tail: "같아요" };
  return { lead: `${base}보다`, amount: won(Math.abs(d)), tail: d > 0 ? "많아요" : "적어요" };
}

/** 견적서가 온 업체만, 합계 낮은 순(줄 세우기만 해요) */
export function quotedRows(c: ApiCompare): (CompareRow & { latest: VendorQuote })[] {
  return c.vendors
    .filter((r): r is CompareRow & { latest: VendorQuote } => r.latest != null && r.latest.total != null)
    .sort((a, b) => (a.latest.total ?? 0) - (b.latest.total ?? 0));
}

/** '공사 3일 · 12.31(목)까지 유효' */
export function termText(q: VendorQuote): string {
  return [q.days != null ? `공사 ${q.days}일` : null, q.valid_until ? `${dateShort(q.valid_until)}까지 유효` : null].filter(Boolean).join(" · ");
}

/** 견적서 파일 주소(고객, 같은 주소 API) */
export const quoteFileHref = (projectId: string, quoteId: string, fileId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(fileId)}`;
