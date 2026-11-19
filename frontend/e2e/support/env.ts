// e2e 공통 값: 주소 · 시연 계정 · 시험 비밀번호 읽기 (B8).
// 시험 비밀번호는 시연 시드 코드(backend/app/demo.py)의 DEMO_PASSWORD(로컬 시험 값)를 읽어 써요.
// 환경변수 DEMO_PASSWORD가 있으면 시드와 같이 그 값을 써요. 값은 화면 · 기록 · 로그에 찍지 않고, localhost 밖에서는 쓰지 않아요.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const WEB_PORT = 3108;
export const API_PORT = 8018;
// 화면은 localhost로 열어요(API ALLOWED_ORIGINS에 http://localhost:3108가 있어요)
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://127.0.0.1:${API_PORT}`;

export const FRONTEND_DIR = path.resolve(__dirname, "..", "..");
export const REPO_DIR = path.resolve(FRONTEND_DIR, "..");
export const OUT_DIR = path.join(FRONTEND_DIR, "e2e", ".out");

/**
 * Windows에서 `bash`가 WSL로 가지 않게 Git Bash를 먼저 써요(E2E_BASH로 바꿀 수 있어요).
 * `Git\bin\bash.exe`(실행기)를 거치면 프로세스 줄이 끊겨 시험 끝에 서버가 남아서, `Git\usr\bin\bash.exe`를 바로 써요.
 */
export function bashPath(): string {
  if (process.env.E2E_BASH) return process.env.E2E_BASH;
  if (process.platform === "win32") {
    for (const p of ["C:\\Program Files\\Git\\usr\\bin\\bash.exe", "C:\\Program Files\\Git\\bin\\bash.exe"]) if (existsSync(p)) return p;
  }
  return "bash";
}

/** `usr\bin\bash.exe`를 바로 띄우면 PATH에 Git 도구(dirname 등)가 없어서 앞에 붙여요(Windows만) */
export function bashEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  if (process.platform === "win32" && !process.env.E2E_BASH) {
    const usr = "C:\\Program Files\\Git\\usr\\bin";
    const key = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
    if (existsSync(usr) && !(env[key] ?? "").toLowerCase().includes(usr.toLowerCase())) env[key] = `${usr};${env[key] ?? ""}`;
  }
  return env;
}

let cached: string | null = null;
/** 시연 계정 비밀번호(시험 값). 시드와 같은 규칙: 환경변수 → demo.py 상수 */
export function demoPassword(): string {
  if (cached) return cached;
  const fromEnv = process.env.DEMO_PASSWORD;
  if (fromEnv) return (cached = fromEnv);
  const src = readFileSync(path.join(REPO_DIR, "backend", "app", "demo.py"), "utf8");
  const m = src.match(/^DEMO_PASSWORD = "([^"\n]+)"$/m);
  if (!m) throw new Error("backend/app/demo.py에서 DEMO_PASSWORD를 찾지 못했어요(시연 시드 코드가 바뀌었는지 확인해요).");
  return (cached = m[1]);
}

/** 시연 계정(verification/b6.md '시연 계정 · 공사 목록') */
export const DEMO = {
  admin: "v3-admin@mitjip.test",
  maru: "v3-maru@mitjip.test",
  gyeol: "v3-gyeol@mitjip.test",
  hangyeol: "v3-hangyeol@mitjip.test",
  daon: "v3-daon@mitjip.test",
  bareun: "v3-bareun@mitjip.test",
  neulbom: "v3-neulbom@mitjip.test",
  /** 김처음: 기본 정보만 */
  c01: "v3-c01@mitjip.test",
  /** 이담기: 업체 2곳 담음 */
  c02: "v3-c02@mitjip.test",
  /** 박요청: 실측 요청 보냄(마루와벽 · 결도배 답 전) */
  c03: "v3-c03@mitjip.test",
  /** 최기간: 마루와벽이 기간 답함 */
  c04: "v3-c04@mitjip.test",
  /** 정확정: 마루와벽 실측 확정 · 채팅 */
  c05: "v3-c05@mitjip.test",
  /** 강실측: 마루와벽 실측 끝(견적서 기다림) */
  c06: "v3-c06@mitjip.test",
  /** 조견적: 실측 견적서 2곳 옴 */
  c07: "v3-c07@mitjip.test",
  /** 윤확정: 마루와벽 확정 · 공사 날짜 옴 */
  c08: "v3-c08@mitjip.test",
  /** 장공사: 공사 중(오늘이 마지막 공사일) */
  c09: "v3-c09@mitjip.test",
  /** 임끝남: 공사 끝 확인 기다림 */
  c10: "v3-c10@mitjip.test",
  /** 한리뷰: 리뷰 씀 */
  c11: "v3-c11@mitjip.test",
} as const;

export const VENDOR_NAME = { maru: "마루와벽", gyeol: "결도배", hangyeol: "한결인테리어" } as const;

/** 시험이 새로 만드는 계정 주소(실행마다 달라요). 도메인은 시험용(.test) */
export function freshEmail(tag: string, project: string): string {
  const stamp = Date.now().toString(36);
  return `e2e-${tag}-${project}-${stamp}@mitjip.test`;
}
