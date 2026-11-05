"""업체 기능 권한: 업체 역할이고 관리자가 승인한 업체만."""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.auth.models import User
from app.db import get_session
from app.shared.errors import AppError
from app.vendor import repository as repo


async def approved_vendor(
    user: User = Depends(require_role("vendor")), s: AsyncSession = Depends(get_session)
) -> User:
    review = await repo.review_of(s, user.id)
    if review is None or review[0] != "approved":
        raise AppError(403, "vendor_not_approved", "승인된 업체만 쓸 수 있어요.")
    return user
