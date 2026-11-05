import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.visit.models import LIVE, Visit, VisitEvent


async def of_project(s: AsyncSession, project_id: uuid.UUID, trade: str | None) -> list[Visit]:
    """이 집 실측 요청 (최근 순, 닫힌 것 포함)"""
    q = select(Visit).where(Visit.project_id == project_id)
    if trade:
        q = q.where(Visit.trade == trade)
    q = q.order_by(Visit.created_at.desc(), Visit.id.desc())
    return list((await s.execute(q)).scalars().all())


async def live(s: AsyncSession, project_id: uuid.UUID, trade: str) -> list[Visit]:
    """칸을 차지하는 요청 (요청함 · 견적서 옴 · 확정)"""
    q = select(Visit).where(
        Visit.project_id == project_id, Visit.trade == trade, Visit.status.in_(LIVE)
    )
    return list((await s.execute(q)).scalars().all())


async def latest_by_vendor(
    s: AsyncSession, project_id: uuid.UUID, trade: str, vendor_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Visit]:
    """업체마다 이 집 · 이 공정의 가장 최근 요청"""
    q = (
        select(Visit)
        .where(
            Visit.project_id == project_id,
            Visit.trade == trade,
            Visit.vendor_id.in_(vendor_ids),
        )
        .order_by(Visit.vendor_id, Visit.created_at.desc(), Visit.id.desc())
        .ext(distinct_on(Visit.vendor_id))
    )
    return {v.vendor_id: v for v in (await s.execute(q)).scalars()}


async def get(s: AsyncSession, visit_id: uuid.UUID) -> Visit | None:
    return await s.get(Visit, visit_id, populate_existing=True)


async def set_status(
    s: AsyncSession, visit_id: uuid.UUID, *, allowed_from: tuple[str, ...], values: dict
) -> bool:
    """지금 상태가 allowed_from일 때만 바꾼다 (동시에 두 번 눌러도 한 번만 바뀜)."""
    res = await s.execute(
        update(Visit)
        .where(Visit.id == visit_id, Visit.status.in_(allowed_from))
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    return res.rowcount == 1


async def mark_seen(s: AsyncSession, visit_id: uuid.UUID, at: datetime) -> None:
    """처음 열었을 때만 찍는다 (두 번 불러도 처음 시각 그대로)."""
    await s.execute(
        update(Visit)
        .where(Visit.id == visit_id, Visit.vendor_seen_at.is_(None))
        .values(vendor_seen_at=at)
        .execution_options(synchronize_session=False)
    )


def _last_event():
    return (
        select(VisitEvent.visit_id, func.max(VisitEvent.at).label("at"))
        .group_by(VisitEvent.visit_id)
        .subquery()
    )


async def last_events(s: AsyncSession, visit_ids: list[uuid.UUID]) -> dict[uuid.UUID, datetime]:
    """요청마다 마지막 상태가 바뀐 때 (닫힌 날 · 견적서를 보낸 날)"""
    if not visit_ids:
        return {}
    q = select(VisitEvent.visit_id, func.max(VisitEvent.at)).where(
        VisitEvent.visit_id.in_(visit_ids)
    )
    return {vid: at for vid, at in (await s.execute(q.group_by(VisitEvent.visit_id))).all()}


async def of_vendor(
    s: AsyncSession,
    vendor_id: uuid.UUID,
    statuses: tuple[str, ...],
    before: datetime | None = None,
    limit: int | None = None,
) -> list[tuple[Visit, datetime]]:
    """업체가 받은 요청과 마지막으로 상태가 바뀐 때 (마지막 이벤트가 최근인 순)"""
    last = _last_event()
    q = (
        select(Visit, last.c.at)
        .join(last, last.c.visit_id == Visit.id)
        .where(Visit.vendor_id == vendor_id, Visit.status.in_(statuses))
    )
    if before is not None:
        q = q.where(last.c.at < before)
    q = q.order_by(last.c.at.desc(), Visit.id.desc())
    if limit is not None:
        q = q.limit(limit)
    return [(v, at) for v, at in (await s.execute(q)).all()]


async def counts_of_vendor(s: AsyncSession, vendor_id: uuid.UUID) -> dict[str, int]:
    q = select(Visit.status, func.count()).where(Visit.vendor_id == vendor_id)
    return {st: n for st, n in (await s.execute(q.group_by(Visit.status))).all()}


async def recent_moves(s: AsyncSession, vendor_id: uuid.UUID, since: datetime) -> dict[str, int]:
    """그 업체 요청이 since 뒤에 어떤 상태로 몇 번 바뀌었나 (받음 · 견적서 보냄 · 확정)"""
    q = (
        select(VisitEvent.to_status, func.count())
        .join(Visit, Visit.id == VisitEvent.visit_id)
        .where(Visit.vendor_id == vendor_id, VisitEvent.at >= since)
        .group_by(VisitEvent.to_status)
    )
    return {st: n for st, n in (await s.execute(q)).all()}


async def lock(s: AsyncSession, visit_id: uuid.UUID) -> Visit | None:
    """같은 요청의 견적서 저장 · 보내기가 줄 서게 요청 행을 잠그고 다시 읽는다."""
    q = select(Visit).where(Visit.id == visit_id).with_for_update()
    return (await s.execute(q.execution_options(populate_existing=True))).scalar_one_or_none()


async def set_quote_ver(
    s: AsyncSession, visit_id: uuid.UUID, *, again: bool, seen: int | None, new: int
) -> bool:
    """첫 보내기: requested → quoted. 다시 올리기: quoted이고 quote_ver가 본 버전일 때만 새 버전으로."""
    cond = (
        [Visit.status == "quoted", Visit.quote_ver == seen]
        if again
        else [Visit.status == "requested"]
    )
    res = await s.execute(
        update(Visit)
        .where(Visit.id == visit_id, *cond)
        .values(status="quoted", quote_ver=new)
        .execution_options(synchronize_session=False)
    )
    return res.rowcount == 1


async def choose(s: AsyncSession, visit_id: uuid.UUID, seen: int) -> bool:
    """견적서 옴이고 고객이 본 버전이 지금 버전일 때만 확정으로 바꾼다."""
    res = await s.execute(
        update(Visit)
        .where(Visit.id == visit_id, Visit.status == "quoted", Visit.quote_ver == seen)
        .values(status="chosen")
        .execution_options(synchronize_session=False)
    )
    return res.rowcount == 1


async def by_ids(s: AsyncSession, visit_ids: list[uuid.UUID]) -> dict[uuid.UUID, Visit]:
    if not visit_ids:
        return {}
    q = select(Visit).where(Visit.id.in_(visit_ids)).execution_options(populate_existing=True)
    return {v.id: v for v in (await s.execute(q)).scalars()}
