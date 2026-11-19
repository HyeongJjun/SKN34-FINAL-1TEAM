"""고객-업체 채팅 (api.md 7장). 고객 · 업체 같은 길, 역할로 응답 모양만 나눈다(업체에는 고객 이름 · 연락처 없음)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.auth.models import User
from app.db import get_session
from app.files import service as files_service
from app.shared import ratelimit
from app.thread import service
from app.thread.schemas import MessageIn, MessageOut, ReadIn, ThreadOut, ThreadRowOut

router = APIRouter(tags=["채팅"])
people = require_role("customer", "vendor")  # 고객 · 업체 같은 길, 역할로 모양만 나눈다
customer_only = require_role("customer")


@router.get("/threads", response_model=list[ThreadRowOut], summary="내 채팅 목록 (최근 순)")
async def threads(
    user: User = Depends(people), s: AsyncSession = Depends(get_session)
) -> list[ThreadRowOut]:
    return await service.rows(s, user)


@router.get("/threads/{thread_id}", response_model=ThreadOut, summary="대화 머리 (남의 대화 404)")
async def thread(
    thread_id: uuid.UUID, user: User = Depends(people), s: AsyncSession = Depends(get_session)
) -> ThreadOut:
    return await service.head(s, user, thread_id)


@router.get(
    "/threads/{thread_id}/messages",
    response_model=list[MessageOut],
    summary="글 목록 (after_seq · before_seq, 기본 50 · 최대 100, seq 오름차순)",
)
async def messages(
    thread_id: uuid.UUID,
    after_seq: Annotated[int | None, Query(ge=0)] = None,
    before_seq: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    user: User = Depends(people),
    s: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    return await service.messages(
        s, user, thread_id, after_seq=after_seq, before_seq=before_seq, limit=limit
    )


@router.post(
    "/threads/{thread_id}/messages",
    status_code=201,
    response_model=MessageOut,
    summary="글 보내기 (같은 client_key면 200 같은 글, 읽기만 409 read_only, 쓰기 막힘 403)",
    responses={200: {"model": MessageOut, "description": "같은 client_key로 이미 보낸 글"}},
)
async def post_message(
    thread_id: uuid.UUID,
    data: MessageIn,
    response: Response,
    user: User = Depends(people),
    s: AsyncSession = Depends(get_session),
) -> MessageOut:
    await ratelimit.check("chat_message", str(user.id))
    out, created = await service.post(s, user, thread_id, data)
    if not created:
        response.status_code = 200
    return out


@router.post(
    "/threads/{thread_id}/read",
    status_code=204,
    summary="여기까지 읽었어요 (줄지 않음, 내 다른 기기에 read 이벤트)",
)
async def read(
    thread_id: uuid.UUID,
    data: ReadIn,
    user: User = Depends(people),
    s: AsyncSession = Depends(get_session),
) -> Response:
    await service.read(s, user, thread_id, data.seq)
    return Response(status_code=204)


@router.get(
    "/threads/{thread_id}/files/{file_id}",
    summary="채팅 사진 (대화 두 사람만, 그 대화의 사진만, 아니면 404)",
)
async def thread_file(
    thread_id: uuid.UUID,
    file_id: uuid.UUID,
    user: User = Depends(people),
    s: AsyncSession = Depends(get_session),
) -> Response:
    f = await service.file_for(s, user, thread_id, file_id)
    return await files_service.respond(f)


@router.post(
    "/threads/{thread_id}/block",
    response_model=ThreadOut,
    summary="고객이 업체 차단 (대화 읽기만 blocked, 이미면 409 already)",
)
async def block(
    thread_id: uuid.UUID,
    user: User = Depends(customer_only),
    s: AsyncSession = Depends(get_session),
) -> ThreadOut:
    return await service.block(s, user, thread_id)


@router.delete(
    "/threads/{thread_id}/block",
    response_model=ThreadOut,
    summary="차단 풀기 (차단으로 닫힌 대화만 다시 열림, 차단 안 했으면 409 already)",
)
async def unblock(
    thread_id: uuid.UUID,
    user: User = Depends(customer_only),
    s: AsyncSession = Depends(get_session),
) -> ThreadOut:
    return await service.unblock(s, user, thread_id)
