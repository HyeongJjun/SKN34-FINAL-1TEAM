"""v2 인테리어 한 건: 만들기 · 목록 · 열기 · 저장 · 이름 바꾸기 · 지우기.

금액 · 날짜는 저장할 때 계산 엔진(service.quote · service.plan)으로 다시 만든다. 화면이 보낸 숫자는 받지 않는다.
"""

import json
import uuid
from datetime import date

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.shared.errors import AppError
from app.v2 import case_repository as repo
from app.v2 import service
from app.v2.case_schemas import V2CaseItemOut, V2CaseOut, V2CaseSaveIn
from app.v2.models import V2Case

MAX_CASES = 30  # 사람마다 남길 수 있는 건 수
MAX_STATE = 200_000  # 고른 값 JSON 글자 수 한도


def _num(v: object) -> float | None:
    return float(v) if isinstance(v, int | float) and not isinstance(v, bool) else None


def _cost(c: V2Case) -> tuple[int | None, int | None, int]:
    """목록에 보일 예상 공사비: 참고 공정이 있으면 전체 범위, 없으면 표준견적서 합계 (견적서 화면 요약과 같다)."""
    q = c.quote or {}
    n = len(q.get("precise") or []) + len(q.get("ref") or [])
    if c.quote_total is None:
        return None, None, 0
    if q.get("ref"):
        lo, hi = q.get("all_lo"), q.get("all_hi")
        if isinstance(lo, int) and isinstance(hi, int):
            return lo, hi, n
    return c.quote_total, c.quote_total, n


def _item(c: V2Case) -> dict:
    cost_lo, cost_hi, trades = _cost(c)
    st = c.state or {}
    info = st.get("info") if isinstance(st.get("info"), dict) else {}
    picks = st.get("picks") if isinstance(st.get("picks"), dict) else {}
    style = st.get("style")
    far = st.get("far")
    return {
        "id": c.id,
        "title": c.title,
        "style": style[:40] if isinstance(style, str) else None,
        "pyeong": _num(info.get("pyeong")),
        "region": str(info.get("region") or "")[:30],
        "picks": len(picks),
        "far": far if isinstance(far, int) and not isinstance(far, bool) else 0,
        "quote_total": c.quote_total,
        "quote_code": c.quote_code,
        "cost_lo": cost_lo,
        "cost_hi": cost_hi,
        "trades": trades,
        "plan_start": c.plan_start,
        "plan_end": c.plan_end,
        "work_days": c.work_days,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def _out(c: V2Case) -> V2CaseOut:
    return V2CaseOut(**_item(c), state=c.state, quote=c.quote, plan=c.plan)


def _day(v: str) -> date | None:
    try:
        return date.fromisoformat(v) if v else None
    except ValueError:
        return None


def _apply(c: V2Case, b: V2CaseSaveIn, today: date) -> None:
    """고른 값을 넣고 견적서 · 공정표를 다시 계산한다. 계산할 수 없는 입력이면 그 결과는 비운다."""
    if len(json.dumps(b.state, ensure_ascii=False)) > MAX_STATE:
        raise AppError(413, "too_large", "저장할 내용이 너무 커요.")
    c.state = b.state
    q = p = None
    if b.quote_in is not None:
        try:
            q = service.quote(b.quote_in, today)
        except AppError:
            q = None
    if b.plan_in is not None:
        try:
            p = service.plan(b.plan_in, today)
        except AppError:
            p = None
    c.quote = q.model_dump(mode="json") if q else None
    c.quote_total = q.total if q else None
    c.quote_code = q.code[:40] if q else None
    c.plan = p.model_dump(mode="json") if p else None
    start, end = (_day(p.start), _day(p.end)) if p else (None, None)
    ok = start is not None and end is not None and end >= start
    c.plan_start, c.plan_end = (start, end) if ok else (None, None)
    c.work_days = p.work_days if p and ok else None


async def _owned(s: AsyncSession, user: User, case_id: uuid.UUID) -> V2Case:
    c = await repo.get(s, case_id)
    if c is None or c.owner_id != user.id:
        raise AppError(404, "not_found", "인테리어를 찾지 못했어요.")
    return c


async def list_mine(s: AsyncSession, user: User) -> list[V2CaseItemOut]:
    return [V2CaseItemOut(**_item(c)) for c in await repo.list_for(s, user.id)]


async def get(s: AsyncSession, user: User, case_id: uuid.UUID) -> V2CaseOut:
    return _out(await _owned(s, user, case_id))


async def create(s: AsyncSession, user: User, b: V2CaseSaveIn, today: date) -> V2CaseOut:
    n = await repo.count_for(s, user.id)
    if n >= MAX_CASES:
        raise AppError(
            409,
            "too_many",
            f"인테리어는 {MAX_CASES}건까지 남길 수 있어요. 안 쓰는 건을 지워 주세요.",
        )
    c = V2Case(owner_id=user.id, title=b.title or f"인테리어 {n + 1}")
    _apply(c, b, today)
    s.add(c)
    await s.commit()
    await s.refresh(c)
    return _out(c)


async def save(
    s: AsyncSession, user: User, case_id: uuid.UUID, b: V2CaseSaveIn, today: date
) -> V2CaseItemOut:
    c = await _owned(s, user, case_id)
    _apply(c, b, today)
    if b.title:
        c.title = b.title
    c.updated_at = func.now()
    await s.commit()
    await s.refresh(c)
    return V2CaseItemOut(**_item(c))


async def rename(s: AsyncSession, user: User, case_id: uuid.UUID, title: str) -> V2CaseItemOut:
    c = await _owned(s, user, case_id)
    c.title = title.strip() or c.title
    c.updated_at = func.now()
    await s.commit()
    await s.refresh(c)
    return V2CaseItemOut(**_item(c))


async def delete(s: AsyncSession, user: User, case_id: uuid.UUID) -> None:
    c = await _owned(s, user, case_id)
    await s.delete(c)
    await s.commit()
