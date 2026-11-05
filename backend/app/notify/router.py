import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_user
from app.auth.models import User
from app.db import get_session
from app.notify import service
from app.notify.schemas import NotificationPage

router = APIRouter(tags=["알림"])


@router.get("/notifications", response_model=NotificationPage, summary="내 알림 (최근 50개)")
async def list_notifications(
    project_id: uuid.UUID | None = None,
    user: User = Depends(current_user),
    s: AsyncSession = Depends(get_session),
) -> NotificationPage:
    return await service.page(s, user.id, project_id)


@router.get("/notifications/unread", summary="안 읽은 알림 수 (머리 종 배지)")
async def unread(
    user: User = Depends(current_user), s: AsyncSession = Depends(get_session)
) -> dict:
    return {"unread": await service.unread_count(s, user.id)}


@router.post("/notifications/{nid}/read", status_code=204, summary="알림 읽음")
async def read_one(
    nid: uuid.UUID, user: User = Depends(current_user), s: AsyncSession = Depends(get_session)
) -> Response:
    await service.mark_read(s, user.id, nid)
    return Response(status_code=204)


@router.post("/notifications/read-all", status_code=204, summary="알림 모두 읽음")
async def read_all(
    user: User = Depends(current_user), s: AsyncSession = Depends(get_session)
) -> Response:
    await service.mark_all_read(s, user.id)
    return Response(status_code=204)
