"""대화 DB 읽기 · 쓰기. 남의 대화는 찾지 못하게 늘 (대화 id, 내 쪽 칸)으로 찾는다.

실측 · 공사 정보(띠 이름 · 단추 · 링크)는 visit · schedule 표를 읽기 조인으로만 본다(쓰지 않음).
"""

import uuid
from datetime import datetime

from sqlalchemy import and_, func, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.files.models import File
from app.schedule.models import Deal
from app.thread.models import Thread, ThreadMessage, ThreadRead
from app.visit.models import Visit, VisitChange

LIST_MAX = 200  # 채팅 목록 한 번에 (사람마다 대화는 공사 · 업체 수만큼이라 적다)


def side_col(side: str):
    return Thread.customer_id if side == "customer" else Thread.vendor_id


async def thread_of(
    s: AsyncSession, side: str, user_id: uuid.UUID, thread_id: uuid.UUID
) -> Thread | None:
    # 같은 세션에서 UPDATE(synchronize_session=False) 뒤에 다시 읽어도 새 값이 보이게
    q = (
        select(Thread)
        .where(Thread.id == thread_id, side_col(side) == user_id)
        .execution_options(populate_existing=True)
    )
    return (await s.execute(q)).scalar_one_or_none()


async def rows(s: AsyncSession, side: str, user_id: uuid.UUID) -> list[tuple]:
    """(대화, 내가 읽은 seq, 실측 상태, 확정 날, 반나절) 최근 순"""
    q = (
        select(
            Thread,
            func.coalesce(ThreadRead.last_read_seq, 0),
            Visit.status,
            Visit.booked_day,
            Visit.booked_half,
        )
        .outerjoin(
            ThreadRead, and_(ThreadRead.thread_id == Thread.id, ThreadRead.user_id == user_id)
        )
        .outerjoin(Visit, Visit.id == Thread.visit_id)
        .where(side_col(side) == user_id)
        .order_by(func.coalesce(Thread.last_message_at, Thread.created_at).desc(), Thread.id.desc())
        .limit(LIST_MAX)
    )
    return [tuple(r) for r in (await s.execute(q)).all()]


async def last_messages(
    s: AsyncSession, pairs: list[tuple[uuid.UUID, int]]
) -> dict[uuid.UUID, ThreadMessage]:
    if not pairs:
        return {}
    q = select(ThreadMessage).where(tuple_(ThreadMessage.thread_id, ThreadMessage.seq).in_(pairs))
    return {m.thread_id: m for m in (await s.execute(q)).scalars()}


async def read_seq(s: AsyncSession, thread_id: uuid.UUID, user_id: uuid.UUID) -> int:
    q = select(ThreadRead.last_read_seq).where(
        ThreadRead.thread_id == thread_id, ThreadRead.user_id == user_id
    )
    return int((await s.execute(q)).scalar_one_or_none() or 0)


async def visit_state(s: AsyncSession, visit_id: uuid.UUID | None) -> tuple[str | None, bool]:
    """(실측 상태, 열린 일정 바꾸기가 있는지). 실측이 없으면 (None, False)"""
    if visit_id is None:
        return None, False
    status = (await s.execute(select(Visit.status).where(Visit.id == visit_id))).scalar()
    open_change = (
        await s.execute(
            select(func.count())
            .select_from(VisitChange)
            .where(VisitChange.visit_id == visit_id, VisitChange.status.in_(("open", "countered")))
        )
    ).scalar_one()
    return status, bool(open_change)


async def deal_of(s: AsyncSession, visit_id: uuid.UUID | None) -> uuid.UUID | None:
    if visit_id is None:
        return None
    q = select(Deal.id).where(Deal.visit_id == visit_id, Deal.status != "reselected")
    return (await s.execute(q)).scalar_one_or_none()


async def messages(
    s: AsyncSession,
    thread_id: uuid.UUID,
    *,
    after_seq: int | None,
    before_seq: int | None,
    limit: int,
) -> list[ThreadMessage]:
    """seq 오름차순. after만 있으면 그 뒤 처음 limit개, 아니면 (before 앞의) 마지막 limit개"""
    q = select(ThreadMessage).where(ThreadMessage.thread_id == thread_id)
    if after_seq is not None:
        q = q.where(ThreadMessage.seq > after_seq)
    if before_seq is not None:
        q = q.where(ThreadMessage.seq < before_seq)
    if after_seq is not None and before_seq is None:
        return list((await s.execute(q.order_by(ThreadMessage.seq).limit(limit))).scalars())
    got = list((await s.execute(q.order_by(ThreadMessage.seq.desc()).limit(limit))).scalars())
    return got[::-1]


async def message_by_key(
    s: AsyncSession, thread_id: uuid.UUID, sender_id: uuid.UUID, client_key: uuid.UUID
) -> ThreadMessage | None:
    q = select(ThreadMessage).where(
        ThreadMessage.thread_id == thread_id,
        ThreadMessage.sender_id == sender_id,
        ThreadMessage.client_key == client_key,
    )
    return (await s.execute(q)).scalar_one_or_none()


async def has_file(s: AsyncSession, thread_id: uuid.UUID, file_id: uuid.UUID) -> bool:
    q = select(ThreadMessage.id).where(
        ThreadMessage.thread_id == thread_id, ThreadMessage.file_id == file_id
    )
    return (await s.execute(q.limit(1))).first() is not None


async def file_row(s: AsyncSession, file_id: uuid.UUID) -> File | None:
    return await s.get(File, file_id)


async def my_photo(s: AsyncSession, owner_id: uuid.UUID, file_id: uuid.UUID) -> bool:
    q = select(File.id).where(
        File.id == file_id, File.owner_id == owner_id, File.kind == "chat_photo"
    )
    return (await s.execute(q)).first() is not None


async def next_seq(
    s: AsyncSession, thread_id: uuid.UUID, side: str, user_id: uuid.UUID, at: datetime
) -> int | None:
    """대화 행을 잠그고 seq를 하나 올린다. 열린 대화 · 내 대화 · (업체면) 쓰기 막기 없음일 때만.
    조건이 안 맞으면 None (부르는 쪽이 409 · 403을 고른다)."""
    where = [Thread.id == thread_id, side_col(side) == user_id, Thread.status == "open"]
    if side == "vendor":
        where.append(Thread.vendor_muted_at.is_(None))
    q = (
        update(Thread)
        .where(*where)
        .values(last_seq=Thread.last_seq + 1, last_message_at=at)
        .returning(Thread.last_seq)
        .execution_options(synchronize_session=False)
    )
    return (await s.execute(q)).scalar_one_or_none()


async def mark_address(s: AsyncSession, thread_id: uuid.UUID, at: datetime) -> None:
    await s.execute(
        update(Thread)
        .where(Thread.id == thread_id, Thread.address_sent_at.is_(None))
        .values(address_sent_at=at)
        .execution_options(synchronize_session=False)
    )


async def mark_read(s: AsyncSession, thread_id: uuid.UUID, user_id: uuid.UUID, seq: int) -> int:
    """읽은 seq를 올린다(줄지 않음). 돌려주는 값: 저장된 값"""
    q = insert(ThreadRead).values(thread_id=thread_id, user_id=user_id, last_read_seq=seq)
    q = q.on_conflict_do_update(
        index_elements=[ThreadRead.thread_id, ThreadRead.user_id],
        set_={"last_read_seq": func.greatest(ThreadRead.last_read_seq, q.excluded.last_read_seq)},
    ).returning(ThreadRead.last_read_seq)
    return int((await s.execute(q)).scalar_one())


async def block(
    s: AsyncSession, thread_id: uuid.UUID, customer_id: uuid.UUID, at: datetime
) -> bool:
    """고객 차단. 열린 대화는 읽기만(blocked)으로, 이미 읽기만이면 사유는 두고 차단 표시만."""
    q = (
        update(Thread)
        .where(
            Thread.id == thread_id, Thread.customer_id == customer_id, Thread.blocked_at.is_(None)
        )
        .values(
            blocked_at=at,
            status="read_only",
            ro_reason=func.coalesce(Thread.ro_reason, "blocked"),
            closed_at=func.coalesce(Thread.closed_at, at),
        )
        .returning(Thread.id)
        .execution_options(synchronize_session=False)
    )
    return (await s.execute(q)).scalar_one_or_none() is not None


async def unblock(s: AsyncSession, thread_id: uuid.UUID, customer_id: uuid.UUID) -> bool:
    """차단 풀기. 차단 때문에 닫힌 대화만 다시 연다(다른 사유로 닫힌 것은 그대로)."""
    mine = (
        Thread.id == thread_id,
        Thread.customer_id == customer_id,
        Thread.blocked_at.is_not(None),
    )
    reopened = await s.execute(
        update(Thread)
        .where(*mine, Thread.ro_reason == "blocked")
        .values(blocked_at=None, status="open", ro_reason=None, closed_at=None)
        .returning(Thread.id)
        .execution_options(synchronize_session=False)
    )
    if reopened.scalar_one_or_none() is not None:
        return True
    kept = await s.execute(
        update(Thread)
        .where(*mine)
        .values(blocked_at=None)
        .returning(Thread.id)
        .execution_options(synchronize_session=False)
    )
    return kept.scalar_one_or_none() is not None
