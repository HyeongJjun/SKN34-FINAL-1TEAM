"""v3 실측 일정 동시 요청 (data-model 5장 · D29 A): 같은 반나절을 두 고객이 거의 같이 → 하나만 확정 ·
늦은 쪽 409 slot_taken (visit_holds 부분 UNIQUE + 칸 번호, L03: 받는 수 2면 둘까지) · 업체 기간 답 vs
고객 취소 → 늦은 쪽 409 stale."""

import asyncio
import uuid

from app.shared.clock import now_utc, today_seoul
from app.shared.errors import AppError
from app.visit import flow
from app.visit import service as visit_service
from app.visit.schemas import CancelIn, SlotIn, WindowIn
from tests.conftest import query
from tests.helpers import no_surprises, use
from tests.test_v3_visit_kit import (
    answer,
    choose,
    d,
    day,
    offered,
    quiet,
    requested,
    run,
    status,
    user_id,
    vendor,
    with_user,
)
from tests.test_visit_inbox import login


async def _pick(f: dict, uid: uuid.UUID, n: int = 6, half: str = "am"):
    data = SlotIn(day=day(n), half=half)
    return await with_user(
        uid,
        lambda s, u: flow.pick(s, u, uuid.UUID(f["pid"]), uuid.UUID(f["visit"]), data, now_utc()),
    )


def _errors(results: list) -> list[tuple[int, str]]:
    return [(e.status, e.code) for e in no_surprises(results) if isinstance(e, AppError)]


def test_same_half_two_customers_one_wins(api, monkeypatch):
    quiet(monkeypatch)
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    query("update vendors set visit_capacity = 1 where user_id = $1", uuid.UUID(a))
    one = offered(api, vid=a, customer_email="one@mitjip.test")
    two = offered(api, vid=a, customer_email="two@mitjip.test")

    u1, u2 = user_id("one@mitjip.test"), user_id("two@mitjip.test")

    async def both():
        return await asyncio.gather(_pick(one, u1), _pick(two, u2), return_exceptions=True)

    assert _errors(run(both())) == [(409, "slot_taken")]  # 방금 다른 고객이 골랐어요 (C16)
    assert sorted([status(one["visit"]), status(two["visit"])]) == ["booked", "offered"]
    holds = query("select seat, status from visit_holds")
    assert [(h["seat"], h["status"]) for h in holds] == [(1, "active")]
    loser = one if status(one["visit"]) == "offered" else two
    use(api, loser["token"])
    v = api.get(f"/projects/{loser['pid']}/visits/{loser['visit']}").json()
    assert {"day": d(6), "half": "am"} in v["full"]  # 마감
    assert {x["day"]: x for x in v["days"]}[d(6)]["am_left"] == 0
    r = choose(api, loser["pid"], loser["visit"], n=6, half="pm")  # 다른 반나절은 된다
    assert r.status_code == 200 and r.json()["status"] == "booked"


def test_capacity_two_takes_two_then_full(api, monkeypatch):
    quiet(monkeypatch)
    a = vendor(api, "maru@mitjip.test", "마루와벽")  # 반나절 받는 수 기본 2 (L03)
    fs = [offered(api, vid=a, customer_email=f"c{i}@mitjip.test") for i in range(3)]

    u0, u1 = user_id("c0@mitjip.test"), user_id("c1@mitjip.test")

    async def two():
        return await asyncio.gather(_pick(fs[0], u0), _pick(fs[1], u1), return_exceptions=True)

    assert _errors(run(two())) == []  # 둘 다 같은 반나절에 확정
    seats = query("select seat from visit_holds where status = 'active' order by seat")
    assert [r["seat"] for r in seats] == [1, 2]
    assert [status(f["visit"]) for f in fs[:2]] == ["booked", "booked"]
    use(api, fs[2]["token"])
    r = choose(api, fs[2]["pid"], fs[2]["visit"], n=6, half="am")
    assert r.status_code == 409 and r.json()["error"]["code"] == "slot_taken"
    login(api, "maru@mitjip.test")
    sched = api.get("/vendor/schedule", params={"from": d(1), "to": d(20)}).json()
    assert [(x["day"], x["half"], x["seat"]) for x in sched["items"]] == [
        (d(6), "am", 1),
        (d(6), "am", 2),
    ]


def test_vendor_answer_vs_customer_cancel(api, monkeypatch):
    quiet(monkeypatch)
    f = requested(api)
    # 고객 취소가 먼저면 늦은 업체 답은 409 stale
    r = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/cancel", json={"code": "changed"})
    assert r.status_code == 200
    login(api, f["email"])
    late = answer(api, f["visit"])
    assert late.status_code == 409 and late.json()["error"]["code"] == "stale"

    g = requested(api, customer_email="two@mitjip.test", vid=f["vendor"])
    me, vendor_id = user_id("two@mitjip.test"), uuid.UUID(f["vendor"])
    window = WindowIn(start=day(5), end=day(12), excluded=[], instant=True)

    async def vendor_answer():
        return await with_user(
            vendor_id,
            lambda s, u: flow.answer_window(s, u, uuid.UUID(g["visit"]), window, now_utc()),
        )

    async def customer_cancel():
        return await with_user(
            me,
            lambda s, u: visit_service.cancel(
                s,
                u,
                uuid.UUID(g["pid"]),
                uuid.UUID(g["visit"]),
                today_seoul(),
                CancelIn(code="changed"),
                now_utc(),
            ),
        )

    async def both():
        return await asyncio.gather(vendor_answer(), customer_cancel(), return_exceptions=True)

    errors = _errors(run(both()))
    assert status(g["visit"]) == "cancelled"  # 취소는 기간을 답한 뒤에도 된다(v3)
    assert errors in ([], [(409, "stale")])  # 업체 답이 늦으면 409 stale
    ev = query(
        "select from_status, to_status from visit_events where visit_id = $1 order by at",
        uuid.UUID(g["visit"]),
    )
    path = [(e["from_status"], e["to_status"]) for e in ev]
    assert path in (
        [(None, "requested"), ("requested", "cancelled")],
        [(None, "requested"), ("requested", "offered"), ("offered", "cancelled")],
    )


def test_v2_cancel_vs_answer_only_one_moves_requested(api, monkeypatch):
    """옛 몸통 없는 취소 · 업체 답은 둘 다 requested에서만 → 꼭 하나만 된다 (조건부 UPDATE)"""
    quiet(monkeypatch)
    f = requested(api)
    me, vendor_id = user_id("home@mitjip.test"), uuid.UUID(f["vendor"])
    window = WindowIn(start=day(5), end=day(12), excluded=[], instant=True)

    async def vendor_answer():
        return await with_user(
            vendor_id,
            lambda s, u: flow.answer_window(s, u, uuid.UUID(f["visit"]), window, now_utc()),
        )

    async def customer_cancel():
        return await with_user(
            me,
            lambda s, u: visit_service.cancel(
                s, u, uuid.UUID(f["pid"]), uuid.UUID(f["visit"]), today_seoul()
            ),
        )

    async def both():
        return await asyncio.gather(vendor_answer(), customer_cancel(), return_exceptions=True)

    errors = _errors(run(both()))
    assert len(errors) == 1 and errors[0][0] == 409
    assert status(f["visit"]) in ("offered", "cancelled")
    moved = query("select count(*) n from visit_events where from_status = 'requested'")[0]["n"]
    assert moved == 1
