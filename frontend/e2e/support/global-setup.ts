// 시험 한 번 돌리기 전에 (B8): 시연 DB(mitjip_v3)를 기준 사본으로 한 번 떠 두고, 시연 계정으로 로그인되는지 봐요.
// 시연 데이터가 없거나 바뀌었으면 여기서 멈춰서 '데이터' 문제로 바로 알 수 있어요.
import { mkdirSync } from "node:fs";
import { request } from "@playwright/test";
import { snapshotDemo, resetDb } from "./db";
import { DEMO, OUT_DIR, WEB_URL, demoPassword } from "./env";

export default async function globalSetup(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  snapshotDemo();
  resetDb();
  const api = await request.newContext({ baseURL: WEB_URL });
  try {
    for (const email of [DEMO.admin, DEMO.maru, DEMO.c01]) {
      const res = await api.post("/api/auth/login", { data: { email, password: demoPassword() } });
      if (!res.ok()) throw new Error(`시연 계정 ${email}로 로그인하지 못했어요(${res.status()}). 시연 데이터(mitjip_v3)를 확인해요.`);
    }
  } finally {
    await api.dispose();
  }
}
