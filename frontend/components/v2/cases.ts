// 인테리어 한 건 저장 (서버 /v2/cases). 고른 값은 건마다 서버에 남기고, 견적서 · 공정표 금액 · 날짜는 서버가 다시 계산한다.
// 상담 화면이 바뀔 때마다(touch) 잠깐 모았다가 한 번에 보낸다. 보내기는 한 번에 하나씩 차례로 한다.
import { ApiError, call } from "@/lib/backend/client";
import { CAT } from "./data";
import { planBody, quoteBody } from "./doc/api";
import { DATA, loadSaved, S, saveHook, snapshot, store, saveCfg, touch, V3, type State } from "./store";

export type CaseItem = {
  id: string;
  title: string;
  style: string | null;
  pyeong: number | null;
  region: string;
  picks: number;
  far: number;
  quote_total: number | null;
  quote_code: string | null;
  /** 예상 공사비 (부가세 포함, 견적서 요약과 같은 값) */
  cost_lo: number | null;
  cost_hi: number | null;
  trades: number;
  plan_start: string | null;
  plan_end: string | null;
  work_days: number | null;
  created_at: string;
  updated_at: string;
};
type Saved = Partial<State> & { v3?: Partial<typeof V3> };
export type CaseFull = CaseItem & { state: Saved; quote: unknown; plan: unknown };

/** 지금 상담 중인 건. id가 없으면 처음 진행할 때 새로 만든다 */
export const cur = { id: null as string | null, title: "" };

const QUOTE_FAR = 6; // 견적서 단계까지 왔으면 견적을 같이 남긴다
const PLAN_FAR = 7;
const WAIT_MS = 1200;

let dirty = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<void> = Promise.resolve();

const started = () => S.far > 0 || Object.keys(S.picks).length > 0;
function body(withCalc = true) {
  return {
    state: snapshot(),
    quote_in: withCalc && S.far >= QUOTE_FAR ? quoteBody() : null,
    plan_in: withCalc && S.far >= PLAN_FAR ? planBody() : null,
  };
}

async function send() {
  if (!dirty) return;
  dirty = false;
  if (!cur.id && !started()) return; // 아직 고른 게 없으면 건을 만들지 않는다
  const put = (b: ReturnType<typeof body>) => (cur.id ? call("PUT", `/v2/cases/${cur.id}`, b) : call<CaseFull>("POST", "/v2/cases", b));
  try {
    let r: unknown;
    try {
      r = await put(body());
    } catch (e) {
      // 견적 입력 모양이 맞지 않으면 고른 값만이라도 남긴다
      if (e instanceof ApiError && e.status === 422) r = await put(body(false));
      else throw e;
    }
    if (!cur.id && r && typeof r === "object" && "id" in r) {
      cur.id = (r as CaseFull).id;
      cur.title = (r as CaseFull).title;
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) cur.id = null; // 다른 곳에서 지운 건이면 다음에 새로 만든다
    if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 404) dirty = true; // 다음에 다시 보낸다
  }
}

/** 곧 저장한다 (touch마다 부른다) */
function later() {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), WAIT_MS);
}
saveHook.fn = later;

/** 모아 둔 저장을 바로 보낸다. 다른 건을 열거나 새로 시작하기 전에 부른다 */
export function flush(): Promise<void> {
  clearTimeout(timer);
  chain = chain.then(send, send);
  return chain;
}

/** 창을 닫을 때: 남은 저장을 keepalive로 보낸다 */
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    if (!dirty || !cur.id) return;
    try {
      void fetch(`/api/v2/cases/${cur.id}`, { method: "PUT", keepalive: true, credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body(false)) });
      dirty = false;
    } catch {}
  });

/** 새 건으로: 다음 진행 때 새로 만든다 */
export function newCase() {
  clearTimeout(timer);
  dirty = false;
  cur.id = null;
  cur.title = "";
}

export const listCases = () => call<CaseItem[]>("GET", "/v2/cases");
export const getCase = (id: string) => call<CaseFull>("GET", `/v2/cases/${encodeURIComponent(id)}`);
export const renameCase = (id: string, title: string) => call<CaseItem>("PATCH", `/v2/cases/${encodeURIComponent(id)}`, { title });
export async function deleteCase(id: string) {
  await call("DELETE", `/v2/cases/${encodeURIComponent(id)}`);
  if (cur.id === id) newCase();
}

/** 저장된 고른 값을 지금 상담에 넣는다. 지금 자료에 없는 공정 · 자재는 뺀다 */
export function applySaved(v: Saved) {
  const { v3, ...st } = v as Saved & { savedAt?: number };
  delete (st as { savedAt?: number }).savedAt;
  Object.assign(S, st, { photos: [], refs: [], imgMode: S.imgMode });
  if (v3) Object.assign(V3, v3, { quote: null, plan: null });
  S.scope.cats = (S.scope.cats || []).filter((c) => CAT[c]);
  S.picks = Object.fromEntries(Object.entries(S.picks || {}).filter(([c, id]) => CAT[c] && DATA.materials.some((m) => m.id === id && m.cat === c)));
  touch();
}

/** 한 건을 열어 지금 상담으로 */
export async function openCase(id: string) {
  await flush();
  const c = await getCase(id);
  newCase();
  applySaved(c.state);
  cur.id = c.id;
  cur.title = c.title;
  dirty = false; // 방금 불러온 값을 다시 보내지 않는다
  return c;
}

/** 예전에 이 브라우저에만 남긴 상담이 있으면 한 건으로 옮기고 지운다 (한 번만) */
let importing = false;
export async function importLocal() {
  const key = saveCfg.key;
  const old = loadSaved();
  if (!old || !key || importing) return;
  importing = true; // 화면이 두 번 그려져도 한 번만 옮긴다
  const raw = store.get(key) || "";
  store.del(key);
  const { savedAt: _at, ...state } = old as Saved & { savedAt?: number };
  try {
    await call("POST", "/v2/cases", { title: "지난 상담", state });
  } catch {
    store.set(key, raw); // 못 옮겼으면 다음에 다시
  } finally {
    importing = false;
  }
}
