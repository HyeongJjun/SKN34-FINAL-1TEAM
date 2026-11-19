"""사용자별 실시간 줄기 (dev-02): 쓰기 push() · 읽기 stream() (GET /stream).

- 원본은 언제나 DB다. 줄기에는 '깨우는 신호'(kind · id)만 넣고 본문 · 연락처 · 이름은 넣지 않는다.
- 상태를 바꾼 service가 **commit 뒤에** push()를 부른다. Redis가 안 되면 버리고 로그만 남긴다(예외를 올리지 않음).
- 키: `{REALTIME_PREFIX 또는 mj:{app_env}}:ev:{user_id}` (Redis Stream, MAXLEN ~500, 7일 뒤 지움).
- 줄기 항목 칸: `e`(이벤트 이름) · `d`(JSON 몸통). SSE `id:`는 Stream id를 그대로 쓴다.
- 읽기: 줄기마다 Redis 연결을 따로 열고(queue.redis는 1초 안에 포기해서 오래 기다리는 읽기에 못 씀) 끝나면 닫는다.
  연결 때 마지막 id를 잡아 두고(`$`를 고리 안에서 다시 쓰지 않음) XREAD BLOCK으로 기다린다.
  60초마다 세션 · 정지를 다시 보고 자리(ratelimit 줄기 자리)를 늘린다. 잘린 것이 있으면 resync.
"""

import json
import logging
import time
import uuid
from collections.abc import AsyncIterator, Iterable
from typing import Literal

import anyio
from fastapi.sse import KEEPALIVE_COMMENT, format_sse_event
from redis.asyncio import Redis
from redis.exceptions import RedisError, ResponseError
from sqlalchemy.exc import SQLAlchemyError

from app import queue
from app.auth import service as auth_service
from app.auth.models import User
from app.config import settings
from app.db import SessionLocal
from app.shared import ratelimit

log = logging.getLogger(__name__)

Event = Literal["msg", "read", "notif", "state", "resync"]
StateKind = Literal["visit", "deal", "quote", "extra", "review", "vendor_app", "thread"]
EVENTS: tuple[str, ...] = ("msg", "read", "notif", "state", "resync")
MAXLEN = 500
TTL_SECONDS = 7 * 86400

# ---- 읽기 줄기 (GET /stream) ----
PING_SECONDS = 15.0  # 할 말이 없을 때 ': ping' 간격 (Cloudflare 125초보다 훨씬 짧게)
RECHECK_SECONDS = 60.0  # 세션 · 정지 다시 보기 + 줄기 자리 늘리기
RETRY_MS = 5000  # 끊기면 브라우저가 다시 잇기까지
BATCH = 100
# 줄기 하나의 최대 길이. 끝나면 브라우저가 retry 뒤 Last-Event-ID로 다시 잇는다(놓치는 것 없음).
# 테스트에서는 끝까지 읽는 요청(예: 계약 테스트의 GET /stream)이 멈추지 않게 짧게 둔다
MAX_SECONDS = 2.0 if settings.app_env == "test" else 1800.0
CLOSE_SECONDS = 3.0  # 끝낼 때 자리 비우기 · 연결 닫기에 쓰는 시간 (끊긴 뒤에도 마저 한다)
CLIENT_NAME = "mj-stream"


def prefix() -> str:
    return settings.realtime_prefix or f"mj:{settings.app_env}"


def stream_key(user_id: uuid.UUID) -> str:
    return f"{prefix()}:ev:{user_id}"


async def push(user_ids: Iterable[uuid.UUID | None], event: Event, data: dict) -> int:
    """사람마다 줄기에 이벤트 하나를 더한다. 돌려주는 값: 넣은 사람 수 (Redis가 안 되면 0).

    data 예: msg {"thread_id", "seq"} · read {"thread_id", "seq"} · notif {"unread"} ·
    state {"kind", "project_id", "id"} · resync {}. 값은 JSON으로 바뀌는 것(문자열 id · 정수)만.
    """
    if event not in EVENTS:
        raise ValueError(f"알 수 없는 이벤트: {event}")
    targets = {u for u in user_ids if u is not None}
    if not targets:
        return 0
    body = json.dumps(data, ensure_ascii=False, default=str)
    try:
        pipe = queue.redis.pipeline(transaction=False)
        for uid in targets:
            key = stream_key(uid)
            pipe.xadd(key, {"e": event, "d": body}, maxlen=MAXLEN, approximate=True)
            pipe.expire(key, TTL_SECONDS)
        await pipe.execute()
    except (RedisError, OSError) as exc:  # 줄기는 지워져도 되는 것: 화면은 다시 읽어 맞춘다
        log.warning("realtime push 실패: %s", type(exc).__name__)
        return 0
    return len(targets)


async def push_state(
    user_ids: Iterable[uuid.UUID | None],
    kind: StateKind,
    ref_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> int:
    """화면이 다시 읽을 신호 (state). 화면은 받으면 router.refresh()로 다시 읽는다."""
    data = {"kind": kind, "project_id": str(project_id) if project_id else None, "id": str(ref_id)}
    return await push(user_ids, "state", data)


async def who(token: str | None) -> User | None:
    """쿠키 토큰의 사용자 (없거나 만료 · 정지면 None). DB 세션은 짧게 열고 바로 닫는다 —
    줄기가 열려 있는 동안 DB 연결을 쥐지 않으려고 router 의존성(get_session)을 쓰지 않는다."""
    if not token:
        return None
    async with SessionLocal() as s:
        return await auth_service.user_from_token(s, token)


def _parse(event_id: str | None) -> tuple[int, int] | None:
    """Stream id 'ms-seq' → (ms, seq). 꼴이 틀리면 None"""
    if not event_id:
        return None
    ms, _, seq = event_id.strip().partition("-")
    if not (ms.isdigit() and seq.isdigit()) or len(ms) > 15 or len(seq) > 15:
        return None
    return int(ms), int(seq)


async def _start(r: Redis, key: str, last_event_id: str | None) -> tuple[str, bool]:
    """어디부터 읽을지 (id, resync 할지).
    - Last-Event-ID가 없으면 지금 마지막 id부터 (새 것만).
    - 있으면 그 뒤부터. 다만 꼴이 틀림 · 7일보다 오래됨 · 그 뒤 것이 잘림(max-deleted-entry-id) ·
      줄기가 지워짐(Redis 비움)이면 resync를 보내고 지금 마지막 id부터."""
    try:
        info = await r.xinfo_stream(key)
    except ResponseError:  # 줄기가 아직 없음
        info = None
    last = _parse(_text(info.get("last-generated-id"))) if info else None
    now_id = f"{last[0]}-{last[1]}" if last else "0-0"
    if last_event_id is None:
        return now_id, False
    seen = _parse(last_event_id)
    if seen is None:
        return now_id, True
    if (
        info is None
    ):  # 줄기가 없음: 처음부터 비었으면(0-0) 그대로, 아니면 지워진 것(7일 · Redis 비움)
        return "0-0", seen != (0, 0)
    # 0-0은 '연결 때 비어 있었음'이라 날짜를 보지 않는다
    if seen != (0, 0) and seen[0] < time.time() * 1000 - TTL_SECONDS * 1000:
        return now_id, True
    deleted = _parse(_text(info.get("max-deleted-entry-id"))) or (0, 0)
    if seen < deleted or (last is not None and seen > last):
        return now_id, True
    return f"{seen[0]}-{seen[1]}", False


def _text(v) -> str | None:
    return v.decode() if isinstance(v, bytes) else v


def _sse(event: str, data: str, event_id: str | None = None, retry: int | None = None) -> bytes:
    return format_sse_event(data_str=data, event=event, id=event_id, retry=retry)


async def _still_ok(user_id: uuid.UUID, token: str) -> bool:
    """60초마다: 로그아웃 · 세션 만료 · 정지 · 탈퇴면 False"""
    try:
        user = await who(token)
    except (SQLAlchemyError, OSError):  # DB를 못 보면 닫는다(다시 이을 때 다시 본다)
        log.warning("실시간 줄기 세션을 다시 보지 못해 닫아요")
        return False
    return user is not None and user.id == user_id


async def stream(
    user_id: uuid.UUID, token: str, conn: str, last_event_id: str | None
) -> AsyncIterator[bytes]:
    """내 줄기를 SSE 바이트로. 연결 자리(conn)는 router가 잡아 두고, 끝날 때 여기서 비운다."""
    r = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
        client_name=CLIENT_NAME,
    )
    key = stream_key(user_id)
    subject = str(user_id)
    started = time.monotonic()
    next_check = started + RECHECK_SECONDS
    try:
        cur, resync = await _start(r, key, last_event_id)
        yield _sse("ready", "{}", cur, RETRY_MS)
        if resync:
            yield _sse("resync", "{}", cur)
        while True:
            now = time.monotonic()
            if now - started >= MAX_SECONDS:
                break
            if now >= next_check:
                if not await _still_ok(user_id, token):
                    break
                if not await ratelimit.keep_slot(subject, conn):
                    break
                next_check = now + RECHECK_SECONDS
            wait = min(PING_SECONDS, next_check - now, MAX_SECONDS - (now - started))
            got = await r.xread({key: cur}, block=max(int(wait * 1000), 1), count=BATCH)
            if not got:
                yield KEEPALIVE_COMMENT
                continue
            for _key, entries in got:
                for eid, fields in entries:
                    cur = eid
                    event = fields.get("e")
                    if event in EVENTS:
                        yield _sse(event, fields.get("d") or "{}", eid)
    except (RedisError, OSError) as exc:  # 줄기를 닫으면 브라우저가 다시 잇는다
        log.warning("실시간 줄기 읽기 실패: %s", type(exc).__name__)
    finally:
        # 끊긴 뒤(취소된 뒤)에도 자리 비우기 · 연결 닫기는 마저 한다
        with anyio.move_on_after(CLOSE_SECONDS, shield=True):
            await ratelimit.free_slot(subject, conn)
            await r.aclose()
