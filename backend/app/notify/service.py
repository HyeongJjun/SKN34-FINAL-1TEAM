"""화면 알림. 다른 기능 service는 add()만 부르고 commit은 부르는 쪽이 한다."""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.notify.models import Notification
from app.notify.schemas import NotificationOut, NotificationPage
from app.shared.clock import now_utc
from app.shared.errors import AppError

PAGE = 50


async def add(
    s: AsyncSession,
    *,
    user_id: uuid.UUID,
    kind: str,
    body: str,
    link: str,
    dedup_key: str,
    project_id: uuid.UUID | None = None,
) -> None:
    """알림 한 줄을 쓴다. 같은 (user, dedup_key)가 이미 있으면 아무것도 하지 않는다."""
    await s.execute(
        insert(Notification)
        .values(
            user_id=user_id,
            kind=kind,
            project_id=project_id,
            body=body[:200],
            link=link,
            dedup_key=dedup_key,
        )
        .on_conflict_do_nothing(constraint="uq_notifications_user_dedup")
    )


async def unread_count(s: AsyncSession, user_id: uuid.UUID) -> int:
    n = await s.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
    )
    return int(n or 0)


async def page(
    s: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID | None = None
) -> NotificationPage:
    q = select(Notification).where(Notification.user_id == user_id)
    if project_id is not None:
        q = q.where(Notification.project_id == project_id)
    rows = (await s.scalars(q.order_by(Notification.created_at.desc()).limit(PAGE))).all()
    items = [
        NotificationOut(
            id=n.id,
            kind=n.kind,
            project_id=n.project_id,
            body=n.body,
            link=n.link,
            created_at=n.created_at,
            read=n.read_at is not None,
        )
        for n in rows
    ]
    return NotificationPage(items=items, unread=await unread_count(s, user_id))


async def mark_read(s: AsyncSession, user_id: uuid.UUID, nid: uuid.UUID) -> None:
    """내 알림만 읽음으로. 남의 알림이면 404."""
    res = await s.execute(
        update(Notification)
        .where(Notification.id == nid, Notification.user_id == user_id)
        .values(read_at=func.coalesce(Notification.read_at, now_utc()))
    )
    if res.rowcount != 1:
        raise AppError(404, "not_found", "알림을 찾지 못했어요.")
    await s.commit()


async def mark_all_read(s: AsyncSession, user_id: uuid.UUID) -> None:
    await s.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=now_utc())
    )
    await s.commit()
