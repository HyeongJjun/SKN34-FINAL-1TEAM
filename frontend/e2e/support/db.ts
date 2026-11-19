// 시험 DB 되돌리기 · 기한 당기기 (B8). 둘 다 리드 도구와 같은 접속 값(.claude/env.sh)을 써요.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { bashEnv, bashPath, FRONTEND_DIR, REPO_DIR } from "./env";

function bash(args: string[], what: string, timeoutMs: number): string {
  const r = spawnSync(bashPath(), args, { cwd: FRONTEND_DIR, encoding: "utf8", timeout: timeoutMs, env: Object.assign({}, process.env, bashEnv(), { PYTHONIOENCODING: "utf-8" }) });
  if (r.error) throw new Error(`${what}: 실행하지 못했어요 (${r.error.message})`);
  if (r.status !== 0) {
    // 오류 글에 접속 값이 들어가지 않게 끝 몇 줄만 남겨요
    const tail = `${r.stderr ?? ""}`.split("\n").filter(Boolean).slice(-6).join("\n");
    throw new Error(`${what}: 종료 코드 ${r.status}\n${tail}`);
  }
  return r.stdout ?? "";
}

const DB_SH = path.join(FRONTEND_DIR, "e2e", "tools", "db.sh");

/** 시연 DB → 기준 사본(시험 한 번에 처음 한 번) */
export function snapshotDemo(): void {
  bash([DB_SH, "snapshot"], "시연 DB 사본 뜨기", 180_000);
}

/** 시험 DB를 기준 사본으로 되돌려요(시험마다). 이야기마다 같은 시연 데이터에서 시작해요 */
export function resetDb(): void {
  bash([DB_SH, "reset"], "시험 DB 되돌리기", 120_000);
}

export function dropBase(): void {
  bash([DB_SH, "drop-base"], "기준 사본 지우기", 60_000);
}

/** 기한 당기기: 이 시각을 '지금'으로 보고 그때까지 기한이 된 일을 거둬요(복사본 DB만, 리드 도구) */
export function runDue(at: Date): string {
  const iso = at.toISOString().replace(/\.\d{3}Z$/, "+00:00");
  return bash([path.join(REPO_DIR, ".claude", "run-due-copy.sh"), "e2e", iso], `기한 당기기(${iso})`, 180_000);
}
