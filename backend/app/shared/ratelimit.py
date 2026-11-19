"""요청 횟수 제한 (Redis). 로그인 · 회원가입 · 파일 올리기 · 프로젝트 만들기 · 손님 계산이 같이 쓴다.

세는 것과 만료 설정을 한 번에(MULTI) 해서, 동시에 몰려도 한도를 넘지 못하고 키가 영원히 남지 않는다.
Redis가 안 될 때(fallback)
- "open": 막지 않고 통과시킨다. 원본 데이터는 DB에 있어 서비스는 계속된다(파일 · 채팅 같은 로그인 뒤 기능).
- "local": 프로세스 안에서 같은 한도로 센다(로그인 · 가입 · 손님 계산, security.md AU-03).
  프로세스마다 따로 세서 한도는 프로세스 수만큼 느슨해지지만 열리지는 않는다(fail-closed).
"""

import hashlib
import logging
import math
import sys
import time
from typing import Literal

from redis.exceptions import RedisError
from starlette.requests import Request

from app.queue import redis
from app.shared.errors import AppError

log = logging.getLogger(__name__)
Fallback = Literal["open", "local"]

# 프로세스 안 셈: 키가 이만큼 차면 지난 것부터 비우고, 그래도 차 있으면 막는다(열지 않음)
LOCAL_MAX_KEYS = 50_000
_local: dict[str, tuple[int, float]] = {}  # 키 → (센 수, 끝나는 때(_clock 기준))
_clock = time.monotonic


def key(*parts: str) -> str:
    """이메일 · IP 같은 원문을 Redis에 두지 않게 해시로 만든다."""
    return "rl:" + hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


def _local_hit(k: str, window_s: int) -> tuple[int, int]:
    """(센 수, 남은 초). 셀 자리가 없으면 한도를 넘은 것으로 친다."""
    now = _clock()
    got = _local.get(k)
    if got is None or got[1] <= now:
        if got is None and len(_local) >= LOCAL_MAX_KEYS:
            for old in [x for x, (_, until) in _local.items() if until <= now]:
                del _local[old]
            if len(_local) >= LOCAL_MAX_KEYS:
                return sys.maxsize, window_s
        got = (0, now + window_s)
    count = got[0] + 1
    _local[k] = (count, got[1])
    return count, max(math.ceil(got[1] - now), 1)


async def hit(
    k: str, limit: int, window_s: int, message: str, *, fallback: Fallback = "open"
) -> None:
    """한 번 센다. 한도를 넘으면 429와 Retry-After를 낸다."""
    try:
        async with redis.pipeline(transaction=True) as p:
            p.incr(k)
            p.expire(k, window_s, nx=True)
            p.ttl(k)
            count, _, ttl = await p.execute()
    except RedisError:
        if fallback == "open":
            log.warning("요청 제한을 확인하지 못해 통과시켜요 (Redis 연결 안 됨)")
            return
        log.warning("요청 제한을 Redis 대신 이 프로세스 안에서 셌어요 (Redis 연결 안 됨)")
        count, ttl = _local_hit(k, window_s)
    if count > limit:
        raise AppError(
            429, "too_many_attempts", message, headers={"Retry-After": str(max(int(ttl), 1))}
        )


async def reset(k: str) -> None:
    _local.pop(k, None)
    try:
        await redis.delete(k)
    except RedisError:
        pass


def client_ip(request) -> str:
    """요청 보낸 곳. 운영에서는 Caddy가 X-Forwarded-For를 덮어쓰고 uvicorn --proxy-headers가 읽는다."""
    return request.client.host if request.client else "unknown"


TOO_MANY = "요청이 너무 많아요. 잠시 뒤에 다시 해 주세요."
# security.md 6.3 요청 제한 표 (숫자는 팀 확인). 이름: ((한도, 창(초)), ...), Redis가 안 될 때
POLICY: dict[str, tuple[tuple[tuple[int, int], ...], Fallback]] = {
    "chat_message": (((30, 60), (1000, 86400)), "open"),  # 채팅 글: 사용자 분당 30 · 하루 1,000
    "guest": (((20, 60), (300, 86400)), "local"),  # 손님 계산: IP 분당 20 · 하루 300 (api.md 1장)
    "report": (((10, 86400),), "open"),  # 신고: 사용자 하루 10
    "review": (((5, 86400),), "open"),  # 리뷰: 사용자 하루 5
    "visit_request": (((20, 86400),), "open"),  # 실측 요청: 사용자 하루 20
}


async def check(name: str, *subject: str, message: str = TOO_MANY) -> None:
    """표(POLICY)의 한도를 모두 센다. subject는 사용자 id나 IP."""
    rules, fallback = POLICY[name]
    for limit, window_s in rules:
        await hit(key(name, str(window_s), *subject), limit, window_s, message, fallback=fallback)


async def guest(request: Request) -> None:
    """손님(로그인 없는) API의 IP 한도. router에 dependencies=[Depends(ratelimit.guest)]로 붙인다."""
    await check("guest", client_ip(request))


# 실시간 줄기 동시 연결 수 (사용자마다 5, api.md 8장). 연결이 제대로 닫히지 않아도 SLOT_TTL이 지나면 자리가 빈다.
STREAM_SLOTS = 5
SLOT_TTL = 150  # 초. 줄기는 60초마다 세션을 다시 보면서 keep_slot으로 늘린다


def _slot_key(subject: str) -> str:
    return "rl:slots:" + hashlib.sha256(subject.encode()).hexdigest()[:32]


async def take_slot(
    subject: str, conn: str, *, limit: int = STREAM_SLOTS, ttl_s: int = SLOT_TTL
) -> bool:
    """연결 자리를 하나 잡는다. 이미 limit개면 False(연결을 받지 않음). Redis가 안 되면 False(줄기도 못 씀)."""
    k, now = _slot_key(subject), time.time()
    try:
        async with redis.pipeline(transaction=True) as p:
            p.zremrangebyscore(k, "-inf", now)
            p.zadd(k, {conn: now + ttl_s})
            p.zcard(k)
            p.expire(k, max(ttl_s, 1))
            _, _, n, _ = await p.execute()
        if int(n) <= limit:
            return True
        await redis.zrem(k, conn)
    except RedisError:
        log.warning("실시간 연결 자리를 확인하지 못해 연결을 받지 않아요 (Redis 연결 안 됨)")
    return False


async def keep_slot(subject: str, conn: str, *, ttl_s: int = SLOT_TTL) -> bool:
    """잡은 자리의 끝나는 때를 늘린다. 자리가 이미 없어졌으면(또는 Redis가 안 되면) False → 연결을 닫는다."""
    k, now = _slot_key(subject), time.time()
    try:
        async with redis.pipeline(transaction=True) as p:
            p.zadd(k, {conn: now + ttl_s}, xx=True)
            p.zscore(k, conn)
            p.expire(k, max(ttl_s, 1))
            _, score, _ = await p.execute()
    except RedisError:
        return False
    return score is not None


async def free_slot(subject: str, conn: str) -> None:
    try:
        await redis.zrem(_slot_key(subject), conn)
    except RedisError:
        pass  # 끝나는 때가 지나면 저절로 빈다
