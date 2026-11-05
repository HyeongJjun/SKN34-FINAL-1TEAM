// 서버 쪽 읽기: 프로젝트(내 공사 목록 · 보기 · 지역 목록).
import { cache } from "react";
import { serverGet, type Schemas } from "@/lib/backend/server";

export type ApiProject = Schemas["ProjectOut"];
export type ApiProjectItem = Schemas["MyProjectOut"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** API가 받는 프로젝트 id 모양인지 (아니면 부르지 않고 없는 것으로 본다) */
export const isUuid = (id: string) => UUID.test(id);

export async function listMyProjects() { return (await serverGet<ApiProjectItem[]>("/projects")) ?? []; }
/** 내 프로젝트(또는 관리자). 없거나 남의 것이면 null. 한 요청 안에서는 한 번만 부른다(레이아웃과 화면이 같이 써도). */
export const getMyProject = cache(async (id: string) => (UUID.test(id) ? serverGet<ApiProject>(`/projects/${id}`) : null));

/** 견적 받기 지역 고르기: 시 · 도 → 시 · 군 · 구 (GET /regions) */
export type Region = { id: string; name: string; full: string; groups: { label: string; prefix: string; items: string[] }[] };
export async function listRegions() { return (await serverGet<Region[]>("/regions")) ?? []; }
