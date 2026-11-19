"""v3 담기 · 실측 일정 테스트가 같이 쓰는 도우미 (합성 데이터, 실제 사람 · 업체 아님).

이 파일에는 테스트가 없다. test_v3_shortlist_* · test_v3_visit_*가 가져다 쓴다.
날짜는 오늘(서울) 기준 n일 뒤로 만든다. 고객 공사의 공사 시작 희망일은 오늘 + 30일(test_project.SOON).
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta

from app.auth.models import User
from app.db import SessionLocal
from app.jobs.models import Job
from app.shared.clock import today_seoul
from app.visit.jobs import HANDLERS
from tests.conftest import query
from tests.helpers import signup, use
from tests.test_project import body as project_body
from tests.test_visit_inbox import login
from tests.test_visit_vendors import NOWON_32, priced

CUSTOMER_NAME = "김믿집"  # 업체 응답에 나오면 안 되는 고객 이름 (합성)
PHONE = "01012345678"  # helpers.signup이 넣는 휴대폰 (합성)
WISH = (2, 16)  # 요청서 초안: 공사 시작(오늘 + 30일) − 28일 ~ − 14일


def day(n: int) -> date:
    return today_seoul() + timedelta(days=n)


def d(n: int) -> str:
    return day(n).isoformat()


def customer(api, email: str = "home@mitjip.test", sgg: str = "노원구") -> tuple[str, str]:
    """고객 가입 + 도배 공사 하나 (공급 105.8㎡ · 실크 · 빈 집). (세션 토큰, 공사 id)"""
    token = signup(api, email, name=CUSTOMER_NAME)
    r = api.post("/projects", json=project_body(**{**NOWON_32, "sgg": sgg}))
    assert r.status_code == 201, r.text
    return token, r.json()["id"]


def vendor(api, email: str, name: str, **profile) -> str:
    """승인 · 업체 정보 · 확인한 도배 단가까지 만든 업체 id (가견적 있음)"""
    return priced(api, email, name, **profile)


def v2_totals(api, pid: str) -> dict[str, int | None]:
    """지금 가견적(v2) 합계 (업체 id → 원). 표준견적서 산식이 바뀌어도 시험이 같은 값으로 견준다."""
    r = api.get(f"/projects/{pid}/vendors", params={"trade": "dobae"})
    assert r.status_code == 200, r.text
    return {x["vendor_id"]: x["estimate_total"] for x in r.json()["vendors"]}


def add(api, pid: str, vid: str, trade: str = "dobae"):
    return api.post(f"/projects/{pid}/shortlist", json={"trade": trade, "vendor_id": vid})


def ask(api, pid: str, vids: list[str], start: int = WISH[0], end: int = WISH[1], **body):
    return api.post(
        f"/projects/{pid}/visits",
        json={
            "trade": "dobae",
            "vendor_ids": vids,
            "wish_start": d(start),
            "wish_end": d(end),
            **body,
        },
    )


def visit_of(pid: str, vid: str) -> str:
    """그 공사 · 업체의 가장 마지막 시도 요청 id"""
    rows = query(
        "select id from visits where project_id = $1 and vendor_id = $2"
        " order by attempt desc limit 1",
        uuid.UUID(pid),
        uuid.UUID(vid),
    )
    return str(rows[0]["id"])


def answer(api, visit: str, start: int = 5, end: int = 12, excluded=(), instant: bool = True):
    body = {
        "start": d(start),
        "end": d(end),
        "excluded": [d(x) for x in excluded],
        "instant": instant,
    }
    return api.post(f"/vendor/visits/{visit}/window", json=body)


def choose(api, pid: str, visit: str, n: int = 6, half: str = "am"):
    return api.post(f"/projects/{pid}/visits/{visit}/pick", json={"day": d(n), "half": half})


def requested(
    api,
    *,
    email: str = "maru@mitjip.test",
    name: str = "마루와벽",
    customer_email: str = "home@mitjip.test",
    vid: str | None = None,
) -> dict:
    """업체 하나를 담고 요청까지 (고객으로 로그인한 채 끝난다)"""
    vid = vid or vendor(api, email, name)
    token, pid = customer(api, customer_email)
    assert add(api, pid, vid).status_code == 201
    r = ask(api, pid, [vid])
    assert r.status_code == 201, r.text
    return {"token": token, "pid": pid, "vendor": vid, "email": email, "visit": visit_of(pid, vid)}


def offered(api, *, instant: bool = True, **kw) -> dict:
    """요청 → 업체가 기간(오늘 + 5 ~ 12일)을 답함. 고객으로 로그인한 채 끝난다."""
    f = requested(api, **kw)
    login(api, f["email"])
    r = answer(api, f["visit"], instant=instant)
    assert r.status_code == 200, r.text
    use(api, f["token"])
    return f


def booked(api, **kw) -> dict:
    """바로 확정으로 오늘 + 6일 오전 실측 확정. 고객으로 로그인한 채 끝난다."""
    f = offered(api, instant=True, **kw)
    r = choose(api, f["pid"], f["visit"])
    assert r.status_code == 200 and r.json()["status"] == "booked", r.text
    return f


def picked(api, **kw) -> dict:
    """바로 확정 끔 → 고객이 오늘 + 6일 오전을 골라 업체 수락 기다림"""
    f = offered(api, instant=False, **kw)
    r = choose(api, f["pid"], f["visit"])
    assert r.status_code == 200 and r.json()["status"] == "picked", r.text
    return f


def status(visit: str) -> str:
    return query("select status from visits where id = $1", uuid.UUID(visit))[0]["status"]


def run(coro):
    return asyncio.run(coro)


def quiet(monkeypatch) -> None:
    """asyncio.run으로 worker.sweep_jobs를 바로 돌릴 때 commit 뒤 실시간 줄기 쓰기를 끈다 (앱의 Redis
    연결이 다른 이벤트 루프에 묶이지 않게). 실측 service는 바로 부르면 줄기를 쓰지 않는다(router가 보냄)."""
    from app.realtime import service as realtime

    async def nothing(*_a, **_k) -> int:
        return 0

    monkeypatch.setattr(realtime, "push", nothing)


async def with_user(user_id, fn):
    """새 세션에서 그 사람으로 service 함수를 부른다: fn(s, user)"""
    async with SessionLocal() as s:
        user = await s.get(User, uuid.UUID(str(user_id)))
        return await fn(s, user)


def user_id(email: str) -> uuid.UUID:
    return query("select id from users where email = $1", email)[0]["id"]


def handle(kind: str, ref_id, now: datetime, run_at: datetime | None = None):
    """기한 일 처리 함수를 새 세션에서 한 번 돌리고 commit (worker.sweep_jobs와 같은 순서)"""

    async def go():
        async with SessionLocal() as s:
            job = Job(
                id=uuid.uuid4(), kind=kind, ref_id=uuid.UUID(str(ref_id)), run_at=run_at or now
            )
            out = await HANDLERS[kind](s, job, now)
            await s.commit()
            return out

    return run(go())


def changed(out) -> bool:
    """처리 함수 결과(bool 또는 Outcome)가 '바꿨음'인지"""
    return bool(getattr(out, "changed", out))


def notes(email: str, kind: str | None = None) -> list[dict]:
    rows = query(
        "select kind, body, link, dedup_key, project_id from notifications"
        " where user_id = $1 order by created_at",
        user_id(email),
    )
    return [dict(r) for r in rows if kind is None or r["kind"] == kind]


def pending_jobs(ref_id, kind: str | None = None) -> list[dict]:
    rows = query(
        "select kind, run_at, status from jobs where ref_id = $1 order by run_at",
        uuid.UUID(str(ref_id)),
    )
    return [
        dict(r) for r in rows if r["status"] == "pending" and (kind is None or r["kind"] == kind)
    ]
