// API 돕기 (B8): 브라우저 문맥(BrowserContext)의 request로 같은 주소 /api/*를 불러요.
// 문맥과 쿠키를 같이 써서, 여기서 로그인하면 그 문맥의 화면도 로그인돼요. 금액 · 상태를 화면과 견줄 때 읽기에 써요.
import { expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { demoPassword } from "./env";

type Req = APIRequestContext;
const reqOf = (c: BrowserContext | Req): Req => ("request" in c ? (c as BrowserContext).request : (c as Req));

async function body(res: Awaited<ReturnType<Req["get"]>>, what: string): Promise<unknown> {
  const text = await res.text();
  if (!res.ok()) throw new Error(`${what} → ${res.status()} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function apiGet<T = unknown>(c: BrowserContext | Req, p: string): Promise<T> {
  return (await body(await reqOf(c).get(`/api${p}`), `GET ${p}`)) as T;
}

export async function apiSend<T = unknown>(c: BrowserContext | Req, method: "POST" | "PUT" | "PATCH" | "DELETE", p: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await reqOf(c).fetch(`/api${p}`, { method, data, headers });
  return (await body(res, `${method} ${p}`)) as T;
}

/** 시연 계정으로 로그인(시험 비밀번호는 시드 코드 값, 찍지 않아요) */
export async function loginApi(c: BrowserContext, email: string, password = demoPassword()): Promise<{ role: string; name: string }> {
  const res = await c.request.post("/api/auth/login", { data: { email, password } });
  expect(res.ok(), `로그인 ${email} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as { role: string; name: string };
}

export type MyProject = {
  id: string;
  phase: string;
  current: number;
  emd?: string | null;
  vendors: { visit_id: string; vendor_id: string | null; vendor_name: string; status: string; total?: number | null }[];
};

/** 이 고객의 공사 하나(시연 고객은 공사가 하나예요) */
export async function myProject(c: BrowserContext): Promise<MyProject> {
  const list = await apiGet<MyProject[]>(c, "/projects");
  expect(list.length, "시연 고객의 공사").toBeGreaterThan(0);
  return list[0];
}

export type BoardRow = {
  visit_id: string;
  vendor_id: string | null;
  vendor_name: string;
  status: string;
  estimate_total: number | null;
  thread_id: string | null;
  window: { start: string; end: string } | null;
  booked: { day: string; half: string } | null;
  quote: { total?: number | null } | null;
};

export async function board(c: BrowserContext, projectId: string): Promise<BoardRow[]> {
  const v = await apiGet<{ board: BoardRow[] }>(c, `/projects/${projectId}/visits`);
  return v.board;
}

export async function boardRow(c: BrowserContext, projectId: string, vendorName: string): Promise<BoardRow> {
  const row = (await board(c, projectId)).find((r) => r.vendor_name === vendorName);
  if (!row) throw new Error(`실측 일정에 ${vendorName} 줄이 없어요`);
  return row;
}
