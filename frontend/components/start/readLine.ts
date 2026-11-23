// 재재 첫 한 줄 읽기(규칙만, 서버에 묻지 않아요): "노원구 24평 전체 도배, 12월 5일부터, 지금 살고 있어요" → 폼 칸 값.
// 애매하면 칸을 채우지 않아요(빈 칸은 재재가 단추로 다시 물어요). 평 → ㎡ 바꾸기는 부르는 쪽이 넘겨요(시험에서 별칭 import를 피하려고).
import type { Region } from "@/lib/api/project";
import type { InfoDraft } from "@/lib/guest/info";

// 안 산다는 말이 먼저예요("살고 있지 않아요"에 '살고'가 들어 있어서)
const NOT_LIVE = /살고\s*있지\s*않|살지\s*않|안\s*살|거주하?고?\s*있지\s*않|거주하지\s*않|거주\s*(?:안|않)|살고\s*있진\s*않/;
const LIVE = /살고|사는\s*중|거주/;
const EMPTY = /비어|빈\s*집|이사\s*(?:전|하기\s*전)|입주\s*전/;
// 부분 공사: '5일부터'의 '일부'는 날짜예요
const PARTIAL = /부분|방\s*하나|(?<!\d\s*)일부(?!터)/;
const FULL = /전체|전부|집\s*전체|온\s*집|모든\s*방/;

export function readLine(text: string, regions: Region[], today: string, toM2: (pyeong: string) => string | null): Partial<InfoDraft> {
  const out: Partial<InfoDraft> = {};
  for (const r of regions) {
    for (const g of r.groups) {
      const hit = g.items.find((sgg) => sgg.length >= 2 && text.includes(sgg));
      if (hit) { out.sido = r.id; out.sgg = hit; break; }
    }
    if (out.sgg) break;
  }
  const py = text.match(/(\d{1,3}(?:\.\d)?)\s*평/);
  const m2 = text.match(/(\d{1,3}(?:\.\d)?)\s*(?:㎡|m2|제곱)/i);
  if (py) { const v = toM2(py[1]); if (v) { out.area = v; out.basis = "supply"; } }
  else if (m2) { out.area = m2[1]; out.basis = /전용/.test(text) ? "exclusive" : "supply"; }
  if (NOT_LIVE.test(text)) out.occupied = false;
  else if (LIVE.test(text)) out.occupied = true;
  else if (EMPTY.test(text)) out.occupied = false;
  if (/실크/.test(text)) out.grade = "basic";
  else if (/합지/.test(text)) out.grade = "economy";
  const full = FULL.test(text);
  const partial = PARTIAL.test(text);
  if (full && !partial) out.scope = "full";
  else if (partial && !full) out.scope = "partial"; // 둘 다 말하면 애매하니 채우지 않아요
  const won = text.match(/예산\D{0,6}(\d{2,5})\s*만/);
  if (won) out.budget = won[1];
  const day = text.match(/(\d{1,2})\s*(?:월|\/)\s*(\d{1,2})\s*일?/);
  if (day) {
    const y = Number(today.slice(0, 4)), m = Number(day[1]), dd = Number(day[2]);
    const year = m < Number(today.slice(5, 7)) ? y + 1 : y;
    const iso = `${year}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (m >= 1 && m <= 12 && dd >= 1 && dd <= 31 && iso >= today) out.start = iso;
  }
  return out;
}
