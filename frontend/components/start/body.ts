// 저장된 집 정보 → PATCH /projects/{id} 본문. 고치기는 몸통 전체를 다시 보내므로(공간 · 공정 · 파일을 통째로 바꿈)
// 바꾸지 않는 값도 그대로 채운다. 공간 이름표(key)는 저장된 공간 id를 쓴다.
import type { ApiProject } from "@/lib/api/project";
import type { Schemas } from "@/lib/backend/client";

export type ProjectBody = Schemas["ProjectCreate"];

export function bodyOf(p: ApiProject): ProjectBody {
  const { dobae, mokgong } = p.trades;
  return {
    sido: p.sido,
    sgg: p.sgg,
    house_type: "apt",
    built_year: p.built_year,
    size: p.size.band ? { band: p.size.band } : { basis: p.size.basis ?? "supply", m2: p.size.m2 ?? null },
    balcony_ext: p.balcony_ext,
    when: { kind: p.when.kind, start: p.when.start ?? null, end: p.when.end ?? null },
    occupied: p.occupied,
    budget: (p.budget as ProjectBody["budget"]) ?? null,
    spaces: p.spaces.map((sp) => ({ key: sp.id, name: sp.name })),
    trades: {
      dobae: dobae ? { spaces: dobae.spaces, grade: dobae.grade ?? "basic" } : null,
      mokgong: mokgong ? { spaces: mokgong.spaces, items: mokgong.items } : null,
    },
    photos: p.photos.map((ph) => ({ space: ph.space_id, file_id: ph.file_id })),
    plans: p.plans,
  };
}
