import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v2.models import V2Case


async def list_for(s: AsyncSession, owner_id: uuid.UUID) -> list[V2Case]:
    q = select(V2Case).where(V2Case.owner_id == owner_id).order_by(V2Case.updated_at.desc())
    return list((await s.scalars(q)).all())


async def count_for(s: AsyncSession, owner_id: uuid.UUID) -> int:
    q = select(func.count()).select_from(V2Case).where(V2Case.owner_id == owner_id)
    return int(await s.scalar(q) or 0)


async def get(s: AsyncSession, case_id: uuid.UUID) -> V2Case | None:
    return await s.get(V2Case, case_id)
