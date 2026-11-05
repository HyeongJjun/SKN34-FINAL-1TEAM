// 예시 데이터. 관리자 회원 목록(회원 API가 생기면 lib/api/admin.ts 안에서 바꾼다). 회원은 모두 가상이다.
import type { Member } from "../types";

export const MEMBERS: Member[] = Array.from({ length: 8 }, (_, i) => ({
  id: `m${i + 1}`,
  name: `예시 회원 ${String(i + 1).padStart(2, "0")}`,
  email: `user${String(i + 1).padStart(2, "0")}@mitjip.test`,
  joinedAt: ["2026-09-03", "2026-09-11", "2026-09-20", "2026-10-02", "2026-10-09", "2026-10-15", "2026-10-21", "2026-10-28"][i],
  projects: [1, 0, 2, 1, 0, 1, 1, 0][i],
  status: i === 4 ? "suspended" : "active",
  role: "customer",
}));
