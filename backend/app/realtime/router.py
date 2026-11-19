"""실시간 줄기 GET /stream (dev-02, api.md 8장). 출처 확인은 입구의 OriginGuard가 먼저 한다(B7)."""

import uuid

import anyio
from fastapi import APIRouter, Header, Request
from fastapi.responses import Response, StreamingResponse
from starlette.types import Receive, Scope, Send

from app.config import settings
from app.realtime import service
from app.realtime.schemas import StreamEventsDoc
from app.shared import ratelimit
from app.shared.errors import AppError

router = APIRouter(tags=["실시간"])
HEADERS = {
    # Cloudflare · 프록시가 모으거나 압축하지 않게 (S18 · Caddy는 /api/stream*을 encode에서 뺌)
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
}


class EventStream(Response):
    """OpenAPI에 text/event-stream으로 보이게 하는 응답 종류 (머리 Cache-Control: no-cache, no-transform)"""

    media_type = "text/event-stream"


class ClosingStream(StreamingResponse):
    """끝나면(끊김 · 취소 포함) 줄기 생성기를 꼭 닫는다. 보내는 중(send)에 끊기면 생성기가 yield에 멈춘 채
    남아 finally(자리 비우기 · Redis 연결 닫기)가 돌지 않기 때문이다."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await super().__call__(scope, receive, send)
        finally:
            with anyio.CancelScope(shield=True):
                await self.body_iterator.aclose()


@router.get(
    "/stream",
    response_class=EventStream,
    responses={
        200: {
            "model": StreamEventsDoc,
            "description": "event 이름 → data 몸통은 StreamEventsDoc 칸과 같다",
        }
    },
    summary="내 실시간 줄기 (SSE, 로그인 필요, Last-Event-ID부터 이어 보냄, 사용자마다 5줄기)",
)
async def stream(
    request: Request,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID", max_length=40),
) -> Response:
    # 로그인 확인은 짧은 DB 세션으로만 (줄기가 열려 있는 동안 DB 연결을 쥐지 않게 get_session을 쓰지 않음)
    token = request.cookies.get(settings.session_cookie)
    user = await service.who(token)
    if user is None or token is None:
        raise AppError(401, "login_required", "로그인해 주세요.")
    conn = uuid.uuid4().hex
    if not await ratelimit.take_slot(str(user.id), conn):
        raise AppError(
            429,
            "too_many_attempts",
            "실시간 연결이 너무 많아요. 다른 창을 닫고 다시 해 주세요.",
            headers={"Retry-After": "30"},
        )
    return ClosingStream(
        service.stream(user.id, token, conn, last_event_id),
        media_type="text/event-stream",
        headers=HEADERS,
    )
