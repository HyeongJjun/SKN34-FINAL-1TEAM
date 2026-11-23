// 예시: 공사 한 건(기본 정보 · 단계 띠 · 공정표 · 공사 전 할 일). 9판 상계동 공사 흐름(C07 → D06 → D19)을 옮겼어요.
import type { Schemas } from "@/lib/backend/client";
import { MOCK_PROJECT, type MockKey } from "./mode";
import { PART_INFO, SAMPLE_INFO } from "./standard";

type S = Schemas;

export type MockProject = {
  /** 공사 이름 '상계동 아파트 도배' */
  name: string;
  region: string;
  locked: boolean;
  home: S["HomeInfoOut"];
  /** 단계 띠 지금 단계(0부터) */
  current: number;
  todo: { label: string; href?: string }[];
  after?: number;
};

const home = (info: S["HomeInfoIn"], emd: string, sgg = info.sgg): S["HomeInfoOut"] => ({
  trade: "dobae", scope: info.scope, spaces: info.spaces, faces: info.faces, housing: "apt", sido: info.sido, sgg, emd,
  area_m2: String(info.area_m2), area_basis: info.area_basis, occupied: info.occupied, grade: info.grade,
  budget_won: info.budget_won ?? null, start_date: info.start_date ?? null,
});

export function mockProject(key: MockKey): MockProject {
  const id = MOCK_PROJECT[key];
  if (key === "zero") return { name: "수유동 아파트 도배", region: "서울 강북구", locked: false, home: home(SAMPLE_INFO, "수유동", "강북구"), current: 2, todo: [{ label: "업체 담기", href: `/projects/${id}/vendors` }] };
  if (key === "part") return { name: "하계동 아파트 도배", region: "서울 노원구", locked: false, home: home(PART_INFO, "하계동"), current: 1, todo: [{ label: "업체 보기", href: `/projects/${id}/vendors` }] };
  if (key === "final") return { name: "상계동 아파트 도배", region: "서울 노원구", locked: true, home: home(SAMPLE_INFO, "상계동"), current: 5, after: 3, todo: [{ label: "관리사무소에 공사 신고" }] };
  return { name: "상계동 아파트 도배", region: "서울 노원구", locked: false, home: home(SAMPLE_INFO, "상계동"), current: 2, todo: [{ label: "실측 일정 잡기 · 담은 업체 2곳", href: `/projects/${id}/visits/new` }] };
}

// ───── 공정표(C08 예상 · C36 · D19 확정)

const day = (d: string, kind: string, names: string[] = [], state: "expected" | "confirmed" = "expected", trade: string | null = null): S["PlanDayOut"] => ({ day: d, trade, kind, names, holiday: null, state });

export function mockPlan(key: MockKey): S["PlanOut"] {
  const pid = MOCK_PROJECT[key];
  if (key === "final") {
    return {
      project_id: pid, kind: "final", version: 1, project_rev: 2, start: "2027-01-04", end: "2027-01-08", work_days: 2, weekend_work: false,
      computed_at: "2026-12-17T10:20:00+09:00",
      blocks: [
        { trade: "dobae", kind: "work", label: "도배", start: "2027-01-04", end: "2027-01-05", days: 2, crew: 2, man_day: "4.0", state: "confirmed", deal_id: "a3a60000-0000-4000-8000-000000000001", vendor_name: "마루와벽" },
        { trade: null, kind: "dry", label: "자연 건조", start: "2027-01-06", end: "2027-01-07", days: 2, crew: null, man_day: null, state: "confirmed" },
        { trade: null, kind: "clean", label: "입주 청소", start: "2027-01-08", end: "2027-01-08", days: 1, crew: null, man_day: null, state: "confirmed" },
      ],
      days: [
        day("2027-01-04", "work", ["벽지 바르기"], "confirmed", "dobae"), day("2027-01-05", "work", ["벽지 바르기", "마감 · 확인 · 청소"], "confirmed", "dobae"),
        day("2027-01-06", "dry", ["창문을 닫고 자연 건조"], "confirmed"), day("2027-01-07", "dry", ["창문을 닫고 자연 건조"], "confirmed"), day("2027-01-08", "clean", ["입주 청소 · 고객이 직접"], "confirmed"),
      ],
      changes: [], extras: [],
      deals: [{
        id: "a3a60000-0000-4000-8000-000000000001", trade: "dobae", status: "working", vendor_id: "a3a10000-0000-4000-8000-000000000002", vendor_name: "마루와벽", owner_name: null,
        visit_id: "a3a70000-0000-4000-8000-000000000001",
        quote: { id: "a3a80000-0000-4000-8000-000000000001", code: "MJQ-2612-0001", version: 1, total: 3267000, days: 2, valid_until: "2026-12-30", sent_at: "2026-12-16T18:00:00+09:00" },
        confirmed_at: "2026-12-16T20:00:00+09:00", dates_due_at: "2026-12-18T18:00:00+09:00", overdue: false, start_date: "2027-01-04", end_date: "2027-01-05",
        work_done_on: null, contact_until: null, fixing_note: null, work_days: ["2027-01-04", "2027-01-05"], review_open: false, thread_id: null,
        done_photos: [], progress: [], grand_total: 3267000,
      }],
    };
  }
  const start = key === "part" ? "2027-01-11" : "2027-01-04";
  const one = key === "part";
  return {
    project_id: pid, kind: "expected", version: 1, project_rev: 1, start, end: one ? "2027-01-14" : "2027-01-08", work_days: one ? 1 : 2, weekend_work: false,
    computed_at: "2026-11-18T09:15:00+09:00",
    blocks: one
      ? [{ trade: "dobae", kind: "work", label: "도배", start: "2027-01-11", end: "2027-01-11", days: 1, crew: 2, man_day: "1.5", state: "expected" }]
      : [{ trade: "dobae", kind: "work", label: "도배", start: "2027-01-04", end: "2027-01-05", days: 2, crew: 2, man_day: "4.0", state: "expected" }],
    days: one
      ? [day("2027-01-11", "work", ["벽지 바르기"], "expected", "dobae"), day("2027-01-12", "dry"), day("2027-01-13", "dry"), day("2027-01-14", "clean")]
      : [day("2027-01-04", "work", ["벽지 바르기"], "expected", "dobae"), day("2027-01-05", "work", ["벽지 바르기"], "expected", "dobae"), day("2027-01-06", "dry"), day("2027-01-07", "dry"), day("2027-01-08", "clean"), day("2027-01-09", "off"), day("2027-01-10", "off")],
    changes: [], extras: [], deals: [],
  };
}

export const MOCK_CHECKS: S["ProjectCheckOut"][] = [{ key: "office_report", label: "관리사무소에 공사 신고하기", done: false, done_at: null }];

/** 홈 '진행 중' 띠 · 이어 하기 창의 예시(로그인한 고객처럼 보기 · 개발 미리 보기만) */
export const MOCK_ONGOING = { id: MOCK_PROJECT.full, name: "상계동 아파트 도배", status: "마루와벽 날짜 고를 차례", step: "업체 담기", href: `/projects/${MOCK_PROJECT.full}/vendors` };
