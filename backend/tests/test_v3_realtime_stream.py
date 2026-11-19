"""실시간 줄기 GET /stream (B1b, dev-02 · b7.md W5): 로그인 · 머리 · ready · 두 연결 · 남의 줄기 못 읽음 ·
끊고 다시 잇기(Last-Event-ID) · 잘렸으면 resync · 6번째 연결 429 · 끊으면 Redis 연결 닫힘 · 로그아웃 · 정지 뒤 닫힘.

줄기 읽기는 TestClient의 진짜 흐름(stream)으로 한다. 기다림이 길어지지 않게 ping · 다시 보기 간격을 줄인다.
"""

import contextlib
import json
import time
import uuid

import pytest
import redis

from app.realtime import service as rt
from app.shared import ratelimit
from tests.conftest import REDIS_URL, TEST_DB, query
from tests.helpers import make_admin, signup, use
from tests.test_v3_thread_api import pair, send

DB = int(REDIS_URL.rsplit("/", 1)[1])


@pytest.fixture(autouse=True)
def _quick(monkeypatch):
    monkeypatch.setattr(rt, "PING_SECONDS", 0.2)
    monkeypatch.setattr(rt, "MAX_SECONDS", 15.0)


class Reader:
    """SSE 줄을 이벤트로 묶어 읽는다. ': ping' 주석은 건너뛰고, 기다림 끝을 넘으면 None"""

    def __init__(self, resp):
        self.resp = resp
        self.lines = resp.iter_lines()

    def next(self, timeout: float = 5.0) -> dict | None:
        end = time.monotonic() + timeout
        ev: dict = {}
        for line in self.lines:
            if line == "":
                if ev:
                    return ev
                if time.monotonic() > end:
                    return None
                continue
            if line.startswith(":"):
                continue
            k, _, v = line.partition(": ")
            ev[k] = v
        return ev or None

    def until(self, event: str, timeout: float = 5.0) -> dict:
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            ev = self.next(max(end - time.monotonic(), 0.1))
            if ev is None:
                break
            if ev.get("event") == event:
                return ev
        raise AssertionError(f"{event} 이벤트가 오지 않았어요")

    def quiet(self, seconds: float = 0.8) -> list[dict]:
        """그동안 온 이벤트 (ping만 왔으면 빈 목록)"""
        got = []
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            ev = self.next(max(end - time.monotonic(), 0.05))
            if ev is None:
                break
            got.append(ev)
        return got


def stream_clients() -> int:
    """이 테스트 Redis db에 붙은 줄기 연결 수"""
    return sum(
        1
        for c in redis.Redis.from_url(REDIS_URL).client_list()
        if c.get("name") == rt.CLIENT_NAME and int(c.get("db", -1)) == DB
    )


def wait_for(cond, seconds: float = 3.0) -> bool:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.05)
    return cond()


def slots(user_id: uuid.UUID) -> int:
    return redis.Redis.from_url(REDIS_URL).zcard(ratelimit._slot_key(str(user_id)))


def test_needs_login_and_sends_ready_with_headers(api):
    api.cookies.clear()
    r = api.get("/stream")
    assert r.status_code == 401 and r.json()["error"]["code"] == "login_required"
    p = pair(api)
    use(api, p.customer)
    with api.stream("GET", "/stream") as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        assert r.headers["cache-control"] == "no-cache, no-transform"
        assert r.headers["x-accel-buffering"] == "no"
        reader = Reader(r)  # 줄기마다 Reader 하나 (버린 줄 읽개가 응답을 닫는다)
        first = reader.next()
        assert first["event"] == "ready" and first["retry"] == "5000" and first["data"] == "{}"
        assert first["id"] == "0-0"  # 아직 줄기가 비었다
        # 줄기가 열려 있는 동안 DB 연결(트랜잭션)을 쥐지 않는다
        idle = query(
            "select count(*) n from pg_stat_activity where datname = $1"
            " and state like 'idle in transaction%'",
            TEST_DB,
        )
        assert idle[0]["n"] == 0
        assert stream_clients() == 1 and slots(p.cid) == 1
    assert wait_for(lambda: stream_clients() == 0)  # 끊으면 Redis 연결이 닫힌다
    assert slots(p.cid) == 0  # 자리도 빈다


def test_two_connections_get_my_events_and_not_others(api):
    p = pair(api)
    q = pair(api, "c2@mitjip.test", "v2@mitjip.test", "결도배")
    use(api, p.customer)
    with api.stream("GET", "/stream") as a, api.stream("GET", "/stream") as b:
        ra, rb = Reader(a), Reader(b)
        assert ra.next()["event"] == "ready" and rb.next()["event"] == "ready"
        assert stream_clients() == 2
        use(api, p.vendor)
        assert send(api, p.tid, "15일 오전에 뵐게요").status_code == 201
        for reader in (ra, rb):
            ev = reader.until("msg")
            assert json.loads(ev["data"]) == {"thread_id": str(p.tid), "seq": 2}
            assert ev["id"].count("-") == 1  # 줄기 id
        # 남의 대화 글은 내 줄기에 오지 않는다 (줄기는 세션 주인 것만, 경로에 사용자를 받지 않음)
        use(api, q.vendor)
        assert send(api, q.tid, "다른 집 이야기").status_code == 201
        assert [e for e in ra.quiet() if e.get("event") == "msg"] == []
        # 읽음은 내 다른 기기에
        use(api, p.customer)
        assert api.post(f"/threads/{p.tid}/read", json={"seq": 2}).status_code == 204
        assert json.loads(rb.until("read")["data"]) == {"thread_id": str(p.tid), "seq": 2}
    assert wait_for(lambda: stream_clients() == 0)


def test_reconnect_with_last_event_id_gets_missed_events(api):
    p = pair(api)
    use(api, p.customer)
    with api.stream("GET", "/stream") as r:
        reader = Reader(r)
        reader.next()
        use(api, p.vendor)
        send(api, p.tid, "첫 글")
        last = reader.until("msg")["id"]
    # 끊긴 동안 두 글
    send(api, p.tid, "둘째 글")
    send(api, p.tid, "셋째 글")
    use(api, p.customer)
    with api.stream("GET", "/stream", headers={"Last-Event-ID": last}) as r:
        reader = Reader(r)
        ready = reader.next()
        assert ready["event"] == "ready" and ready["id"] == last
        seqs = [json.loads(reader.until("msg")["data"])["seq"] for _ in range(2)]
        assert seqs == [3, 4]
        assert [e for e in reader.quiet(0.5) if e.get("event") == "resync"] == []


def test_resync_when_history_was_cut_or_id_is_bad(api):
    p = pair(api)
    key = rt.stream_key(p.cid)
    r0 = redis.Redis.from_url(REDIS_URL)
    ids = [r0.xadd(key, {"e": "notif", "d": json.dumps({"unread": n})}).decode() for n in (1, 2, 3)]
    r0.xdel(key, ids[1])  # 둘째가 지워짐(잘림과 같다)
    use(api, p.customer)
    for bad in (ids[0], "abc", "1-0", "99999999999999-0"):
        with api.stream("GET", "/stream", headers={"Last-Event-ID": bad}) as r:
            reader = Reader(r)
            assert reader.next()["event"] == "ready"
            assert reader.next()["event"] == "resync", bad
    with api.stream("GET", "/stream", headers={"Last-Event-ID": ids[1]}) as r:
        reader = Reader(r)
        reader.next()  # 지워진 것 뒤부터는 이어진다
        ev = reader.next()
        assert (ev["event"], json.loads(ev["data"])) == ("notif", {"unread": 3})


def test_sixth_connection_is_refused_and_slot_comes_back(api):
    p = pair(api)
    use(api, p.customer)
    with contextlib.ExitStack() as stack:
        opened = [
            stack.enter_context(api.stream("GET", "/stream")) for _ in range(ratelimit.STREAM_SLOTS)
        ]
        readers = [Reader(x) for x in opened]
        assert all(x.next()["event"] == "ready" for x in readers)
        extra = api.get("/stream")
        assert extra.status_code == 429 and extra.json()["error"]["code"] == "too_many_attempts"
        assert int(extra.headers["retry-after"]) >= 1
        assert stream_clients() == ratelimit.STREAM_SLOTS
    assert wait_for(lambda: slots(p.cid) == 0 and stream_clients() == 0)
    with api.stream("GET", "/stream") as r:  # 닫으면 다시 열 수 있다
        reader = Reader(r)
        assert reader.next()["event"] == "ready"


def test_logout_or_suspension_closes_the_stream(api, monkeypatch):
    monkeypatch.setattr(rt, "RECHECK_SECONDS", 0.3)
    p = pair(api)
    use(api, p.customer)
    with api.stream("GET", "/stream") as r:
        reader = Reader(r)
        assert reader.next()["event"] == "ready"
        assert api.post("/auth/logout").status_code in (200, 204)
        started = time.monotonic()
        assert reader.quiet(5.0) == []  # 줄기가 끝난다(이벤트 없이)
        assert time.monotonic() - started < 4.0
    assert wait_for(lambda: slots(p.cid) == 0 and stream_clients() == 0)
    # 관리자가 정지해도 다음 확인 때 닫힌다
    token = signup(api, "later@mitjip.test")
    uid = query("select id from users where email = 'later@mitjip.test'")[0]["id"]
    admin = make_admin(api)
    use(api, token)
    with api.stream("GET", "/stream") as r:
        reader = Reader(r)
        assert reader.next()["event"] == "ready"
        use(api, admin)
        assert api.post(f"/admin/members/{uid}/suspend", json={}).status_code == 200
        started = time.monotonic()
        assert reader.quiet(5.0) == []
        assert time.monotonic() - started < 4.0
    assert wait_for(lambda: slots(uid) == 0)


def test_stream_has_a_max_length(api, monkeypatch):
    monkeypatch.setattr(rt, "MAX_SECONDS", 0.6)
    p = pair(api)
    use(api, p.customer)
    started = time.monotonic()
    with api.stream("GET", "/stream") as r:
        reader, events = Reader(r), []
        while (ev := reader.next(3.0)) is not None:
            events.append(ev.get("event"))
    assert events == ["ready"] and time.monotonic() - started < 3.0
    assert wait_for(lambda: stream_clients() == 0)
