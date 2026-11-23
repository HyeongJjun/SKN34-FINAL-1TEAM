// 재재 첫 한 줄 읽기(규칙만, 서버에 묻지 않아요): "노원구 24평 전체 도배, 12월 5일부터, 지금 살고 있어요" → 폼 칸 값.
// 애매하면 칸을 채우지 않아요(빈 칸은 재재가 단추로 다시 물어요). 평 → ㎡ 바꾸기는 부르는 쪽이 넘겨요(시험에서 별칭 import를 피하려고).
import type { Region } from "@/lib/api/project";
import type { InfoDraft } from "@/lib/guest/info";

// 앞으로 살 거라는 말은 지금 사는지 알 수 없어서 비워요("거주 예정" · "들어가 살고 싶어요")
const LATER = /(?:거주|입주|이사|살)\S*\s*예정|살고\s*싶|살\s*거|들어갈|들어가\s*살/;
// 안 산다는 말이 먼저예요("살고 있지 않아요"에 '살고'가 들어 있어서)
const NOT_LIVE = /살고\s*있지\s*않|살지\s*않|안\s*살|거주하?고?\s*있지\s*않|거주하지\s*않|거주\s*(?:안|않)|살고\s*있진\s*않/;
const LIVE = /살고|사는\s*중|거주/;
const EMPTY = /비어|빈\s*집|이사\s*(?:전|하기\s*전)|입주\s*전/;
// 부분 공사: '5일부터'의 '일부'는 날짜예요
const PARTIAL = /부분|방\s*하나|(?<!\d\s*)일부(?!터)/;
const FULL = /전체|전부|집\s*전체|온\s*집|모든\s*방/;

export function readLine(text: string, regions: Region[], today: string, toM2: (pyeong: string) => string | null): Partial<InfoDraft> {
  const out: Partial<InfoDraft> = {};
  // 지역: 가장 긴 이름을 쓰고("강서구" ⊃ "서구"), 여러 시 · 도에 있는 이름이면 글에 적은 시 · 도로 골라요. 못 고르면 비워요
  const hits: { id: string; sgg: string; words: string[] }[] = [];
  for (const r of regions) {
    for (const g of r.groups) {
      for (const sgg of g.items) {
        if (sgg.length >= 2 && text.includes(sgg)) hits.push({ id: r.id, sgg, words: [r.name, r.full, g.prefix] });
      }
    }
  }
  const long = Math.max(0, ...hits.map((h) => h.sgg.length));
  const top = hits.filter((h) => h.sgg.length === long);
  if (new Set(top.map((h) => h.sgg)).size === 1) {
    const ids = new Set(top.map((h) => h.id));
    const said = ids.size === 1 ? top : top.filter((h) => h.words.some((w) => w && w.length >= 2 && text.includes(w)));
    if (new Set(said.map((h) => h.id)).size === 1) { out.sido = said[0].id; out.sgg = said[0].sgg; }
  }
  // 면적: 숫자가 하나일 때만. 전용은 숫자 바로 앞뒤에 붙을 때만("공급 112㎡ 전용 84㎡"는 비워요)
  const areas = [...text.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*(평|㎡|m2|제곱)/gi)];
  if (areas.length === 1) {
    const a = areas[0];
    const near = /전용\s*(?:면적)?\s*(?:은|는|이)?\s*$/.test(text.slice(Math.max(0, a.index - 8), a.index)) || /^(?:미터)?\s*전용/.test(text.slice(a.index + a[0].length));
    const v = a[2] === "평" ? toM2(a[1]) : a[1];
    if (v) { out.area = v; out.basis = near ? "exclusive" : "supply"; }
  }
  if (!LATER.test(text)) {
    if (NOT_LIVE.test(text)) out.occupied = false;
    else if (LIVE.test(text)) out.occupied = true;
    else if (EMPTY.test(text)) out.occupied = false;
  }
  // 실크 · 합지를 둘 다 말하면("실크 말고 합지로") 비워요
  const silk = /실크/.test(text), hapji = /합지/.test(text);
  if (silk && !hapji) out.grade = "basic";
  else if (hapji && !silk) out.grade = "economy";
  const full = FULL.test(text);
  const partial = PARTIAL.test(text);
  if (full && !partial) out.scope = "full";
  else if (partial && !full) out.scope = "partial"; // 둘 다 말하면 애매하니 채우지 않아요
  const won = text.match(/예산\D{0,6}(\d{2,5})\s*만/);
  if (won) out.budget = won[1];
  // 시작일: '부터 · 시작 · 에 · 쯤 · 경'이 붙을 때만("12월 20일까지 끝내야 해요" · "12/20 이사"는 시작일이 아니에요)
  const day = text.match(/(?<![\d./])(\d{1,2})\s*(?:월|\/)\s*(\d{1,2})\s*일?\s*(?:부터|시작|에|쯤|경)/);
  if (day) {
    const y = Number(today.slice(0, 4)), m = Number(day[1]), dd = Number(day[2]);
    const year = m < Number(today.slice(5, 7)) ? y + 1 : y;
    const iso = `${year}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (m >= 1 && m <= 12 && dd >= 1 && dd <= 31 && iso >= today) out.start = iso;
  }
  return out;
}
