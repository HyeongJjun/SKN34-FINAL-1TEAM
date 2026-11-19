"""T09 요청 제한 (security.md IN-03 · AU-03 · LG-06): Redis가 멈춰도 로그인 · 가입 · 손님 계산은 닫힌다."""

import asyncio

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient

from app.shared import ratelimit
from app.shared.errors import AppError
from tests.helpers import PASSWORD, PHONE, signup, upload
from tests.security.sec_util import DownRedis, mini_app, with_redis


@pytest.fixture
def redis_down(monkeypatch):
    monkeypatch.setattr(ratelimit, "redis", DownRedis())


def test_login_limit_holds_when_redis_is_down(api, redis_down):
    signup(api, "slow@mitjip.test")
    api.cookies.clear()
    for _ in range(10):
        bad = api.post("/auth/login", json={"email": "slow@mitjip.test", "password": "wrong-pass"})
        assert bad.status_code == 401
    r = api.post("/auth/login", json={"email": "slow@mitjip.test", "password": PASSWORD})
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0


def test_login_still_works_when_redis_is_down(api, redis_down):
    signup(api, "ok@mitjip.test")
    api.cookies.clear()
    r = api.post("/auth/login", json={"email": "ok@mitjip.test", "password": PASSWORD})
    assert r.status_code == 200  # 닫힘은 한도를 지킨다는 뜻이지 로그인을 막는다는 뜻이 아니다


def test_signup_limit_holds_when_redis_is_down(api, redis_down):
    for i in range(10):
        signup(api, f"many{i}@mitjip.test")
    api.cookies.clear()
    body = {"name": "고객", "email": "many10@mitjip.test", "password": PASSWORD, "phone": PHONE}
    r = api.post("/auth/signup", json=body)
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0


def test_logged_in_features_stay_open_when_redis_is_down(api, redis_down):
    signup(api)
    # 파일 · 채팅 같은 기능은 통과시킨다(원본은 DB, 크기 한도는 그대로)
    assert upload(api).status_code == 201


def test_local_counts_never_open_when_full(monkeypatch, redis_down):
    monkeypatch.setattr(ratelimit, "LOCAL_MAX_KEYS", 2)

    async def go():
        await ratelimit.hit("a", 5, 60, "많아요", fallback="local")
        await ratelimit.hit("b", 5, 60, "많아요", fallback="local")
        await ratelimit.hit("c", 5, 60, "많아요", fallback="local")  # 셀 자리가 없다

    with pytest.raises(AppError) as e:
        asyncio.run(go())
    assert e.value.status == 429


def test_local_window_ends(monkeypatch, redis_down):
    clock = [1000.0]
    monkeypatch.setattr(ratelimit, "_clock", lambda: clock[0])

    async def three():
        for _ in range(3):
            await ratelimit.hit("k", 3, 60, "많아요", fallback="local")

    asyncio.run(three())
    with pytest.raises(AppError):
        asyncio.run(ratelimit.hit("k", 3, 60, "많아요", fallback="local"))
    clock[0] += 61
    asyncio.run(ratelimit.hit("k", 3, 60, "많아요", fallback="local"))  # 창이 지나면 다시 센다


def test_policy_counts_every_window(monkeypatch):
    async def go():
        for _ in range(10):
            await ratelimit.check("report", "user-1")
        with pytest.raises(AppError) as e:
            await ratelimit.check("report", "user-1")
        await ratelimit.check("report", "user-2")  # 사람마다 따로 센다
        return e.value

    err = with_redis(monkeypatch, go)
    assert err.status == 429 and int(err.headers["Retry-After"]) > 0
    assert set(ratelimit.POLICY) >= {"chat_message", "guest", "report", "review", "visit_request"}


def test_guest_api_is_limited_by_ip(monkeypatch):
    app = mini_app(monkeypatch)

    @app.post("/guest/standard", dependencies=[Depends(ratelimit.guest)])
    async def standard() -> dict:
        return {"ok": True}

    with TestClient(app) as c:
        for _ in range(20):
            assert c.post("/guest/standard").status_code == 200
        r = c.post("/guest/standard")
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0
    assert r.json()["error"]["code"] == "too_many_attempts"


def test_guest_limit_holds_when_redis_is_down(monkeypatch):
    app = mini_app(monkeypatch)

    @app.post("/guest/standard", dependencies=[Depends(ratelimit.guest)])
    async def standard() -> dict:
        return {"ok": True}

    with TestClient(app) as c:
        monkeypatch.setattr(ratelimit, "redis", DownRedis())  # 앱이 뜬 뒤 Redis가 멈춤
        codes = [c.post("/guest/standard").status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429


def test_stream_slots_cap_connections_per_user(monkeypatch):
    async def go():
        got = [await ratelimit.take_slot("user-1", f"c{i}") for i in range(6)]
        other = await ratelimit.take_slot("user-2", "c0")
        await ratelimit.free_slot("user-1", "c0")
        again = await ratelimit.take_slot("user-1", "c6")
        kept, gone = (
            await ratelimit.keep_slot("user-1", "c1"),
            await ratelimit.keep_slot("user-1", "c0"),
        )
        return got, other, again, kept, gone

    got, other, again, kept, gone = with_redis(monkeypatch, go)
    assert got == [True] * 5 + [False] and other and again
    assert kept and not gone  # 놓은 자리는 늘리지 않는다 → 그 줄기는 닫는다


def test_dead_connections_free_their_slot(monkeypatch):
    async def go():
        for i in range(5):
            assert await ratelimit.take_slot("user-1", f"old{i}", ttl_s=-1)  # 이미 끝난 자리
        return await ratelimit.take_slot("user-1", "new")

    assert with_redis(monkeypatch, go)


def test_stream_slots_close_when_redis_is_down(monkeypatch, redis_down):
    assert asyncio.run(ratelimit.take_slot("user-1", "c0")) is False
    asyncio.run(ratelimit.free_slot("user-1", "c0"))  # 오류 없이 지나간다
