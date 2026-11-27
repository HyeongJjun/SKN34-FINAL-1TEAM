// 재재 대화 → 오른쪽 보드 연동(#197): AI 답과 물은 말을 보고 보드 어느 칸을 보여 줄지, 어떤 업체를 강조할지 골라요.
// 화면에서만 써요(API · AI 카드 모양은 그대로). 금액 · 날짜를 만들지 않아요.
// 1) 물은 말 · 답 글 · 표 · 초안에 이 공사 업체 이름이 나오면 그 업체를 강조하고 업체 칸(견적서가 왔으면 비교 칸)
//    (무료 모드 답은 업체 이름을 거의 안 꺼내서 물은 말도 봐요)
// 2) 이름이 없으면 낱말로: 일정 말(실측 날짜 · 반나절 · 공사 날짜 · 공정표 · 일정)이면 일정 칸, 업체 말이면 업체 칸
// 3) 둘 다 없으면 그대로

export type BoardAnswer = {
  lead?: string; notice: string; vendor?: string[];
  sections: { title: string; sentences: string[]; caution: string; tip: string }[];
  cards: { title: string; text: string; draft?: { vendors: string[]; recommend?: { vendor: string } | null } | null; table?: { cols: string[]; rows: { cells: string[] }[] } | null }[];
};
export type BoardVendor = { vendor_id: string; name: string; trade: "dobae" | "mokgong" };
export type BoardState = { quoted: boolean; deal: boolean };
export type BoardTarget = { tab: number; hi: string[]; trade: "dobae" | "mokgong" | null } | null;

export const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();

export function answerText(a: BoardAnswer): string {
  const parts = [a.lead ?? "", a.notice, ...(a.vendor ?? []), ...a.sections.flatMap((x) => [x.title, ...x.sentences, x.caution, x.tip])];
  for (const c of a.cards) parts.push(c.title, c.text, ...(c.draft?.vendors ?? []), c.draft?.recommend?.vendor ?? "", ...(c.table?.cols ?? []), ...(c.table?.rows.flatMap((r) => r.cells) ?? []));
  return parts.join(" ");
}

const SCHEDULE = /실측\s*(날짜|일정|날)|반나절|공사\s*(날짜|일정)|공정표|일정|언제\s*(와|오|해|시작)/;
const VENDOR = /업체|가견적|담기|담아/;

export function boardTarget(question: string, a: BoardAnswer, vendors: BoardVendor[], st: BoardState): BoardTarget {
  const t = norm(`${question} ${answerText(a)}`);
  const hit = vendors.filter((v) => norm(v.name).length >= 2 && t.includes(norm(v.name)));
  if (hit.length) {
    return { tab: st.quoted && !st.deal ? 4 : 2, hi: [...new Set(hit.map((v) => v.vendor_id))], trade: hit.some((v) => v.trade === "dobae") ? "dobae" : "mokgong" };
  }
  if (SCHEDULE.test(question)) return { tab: st.deal ? 5 : 3, hi: [], trade: null };
  if (VENDOR.test(question)) return { tab: st.quoted && !st.deal ? 4 : 2, hi: [], trade: null };
  return null;
}
