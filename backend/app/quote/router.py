import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_user
from app.auth.models import User
from app.db import get_session
from app.quote import service
from app.quote.schemas import StandardOut

router = APIRouter(tags=["견적"])


@router.get(
    "/projects/{project_id}/standard",
    response_model=StandardOut,
    summary="표준견적서 (믿집 계산, 만든 사람 · 관리자)",
)
async def standard(
    project_id: uuid.UUID,
    user: User = Depends(current_user),
    s: AsyncSession = Depends(get_session),
) -> StandardOut:
    return await service.standard_for(s, user, project_id)
