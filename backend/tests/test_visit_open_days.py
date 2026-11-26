"""실측 영업일 (2026-11-25 회의): 업체가 영업 요일 · 쉬는 날을 등록하고, 고객은 담은 업체의 빈 반나절을 골라
요청한다. 요청하면 바로 '업체 수락 기다림'(picked)이고 채팅이 열린다. 업체는 수락 · 다른 날 제안 · 못 받아요를 고른다."""

from datetime import timedelta

from app.calc import slots
from app.shared.clock import today_seoul
from tests.conftest import query
from tests.helpers import use
from tests.test_v3_visit_kit import (
    add,
    answer,
    ask,
    booked,
    choose,
    customer,
    pending_jobs,
    status,
    vendor,
    visit_of,
)
from tests.test_visit_inbox import login


def code(r) -> tuple[int, str]:
    return r.status_code, r.json().get("error", {}).get("code", "")


def open_days(api, pid: str, vid: str, start: int = 1, end: int = 20) -> dict[str, list[str]]:
    t = today_seoul()
    r = api.get(
        f"/projects/{pid}/vendors/{vid}/open-days",
        params={
            "start": (t + timedelta(days=start)).isoformat(),
            "end": (t + timedelta(days=end)).isoformat(),
        },
    )
    assert r.status_code == 200, r.text
    return {x["day"]: x["halves"] for x in r.json()["days"]}


def setup(api, email: str = "maru@mitjip.test") -> tuple[str, str, str]:
    vid = vendor(api, email, "마루와벽")
    token, pid = customer(api)
    assert add(api, pid, vid).status_code == 201
    return token, pid, vid


def test_is_open_day_calc():
    mon = today_seoul() + timedelta(days=(7 - today_seoul().weekday()) % 7 or 7)  # 다음 월요일
    assert slots.is_open_day(mon, (0, 1), set())
    assert not slots.is_open_day(mon + timedelta(days=6), (0, 1, 2, 3, 4, 5), set())  # 일요일
    assert not slots.is_open_day(mon, (0,), {mon})


def test_vendor_registers_open_days_and_customer_sees_only_them(api):
    token, pid, vid = setup(api)
    login(api, "maru@mitjip.test")
    assert api.get("/vendor/open-days").json()["open_weekdays"] == [0, 1, 2, 3, 4, 5]
    off = (today_seoul() + timedelta(days=3)).isoformat()
    past = (today_seoul() - timedelta(days=1)).isoformat()
    r = api.put("/vendor/open-days", json={"open_weekdays": [2, 0, 2], "off_days": [off, past]})
    assert r.status_code == 200, r.text
    assert r.json() == {"open_weekdays": [0, 2], "off_days": [off]}  # 겹침 · 지난 날은 빼요
    assert code(api.put("/vendor/open-days", json={"open_weekdays": [], "off_days": []}))[0] == 422

    use(api, token)
    days = open_days(api, pid, vid)
    assert days
    for d, halves in days.items():
        assert slots.is_open_day(
            today_seoul().fromisoformat(d), (0, 2), {today_seoul().fromisoformat(off)}
        )
        assert halves == ["am", "pm"]
    # 남의 공사는 404
    other, _ = signup_other(api)
    use(api, other)
    t = today_seoul()
    r = api.get(
        f"/projects/{pid}/vendors/{vid}/open-days",
        params={
            "start": (t + timedelta(days=1)).isoformat(),
            "end": (t + timedelta(days=5)).isoformat(),
        },
    )
    assert r.status_code == 404


def signup_other(api) -> tuple[str, str]:
    return customer(api, "other@mitjip.test")


def test_request_with_pick_goes_to_picked_and_opens_chat(api):
    _token, pid, vid = setup(api)
    day = next(iter(open_days(api, pid, vid)))
    r = api.post(
        f"/projects/{pid}/visits",
        json={
            "trade": "dobae",
            "vendor_ids": [vid],
            "picks": [{"vendor_id": vid, "day": day, "half": "pm"}],
        },
    )
    assert r.status_code == 201, r.text
    visit = visit_of(pid, vid)
    assert status(visit) == "picked"
    hold = query("select day::text, half, kind from visit_holds where visit_id = $1::uuid", visit)
    assert [dict(h) for h in hold] == [{"day": day, "half": "pm", "kind": "hold"}]
    # 채팅은 요청 때 열려요
    t = query("select status from threads where visit_id = $1::uuid", visit)
    assert [x["status"] for x in t] == ["open"]
    # 답 기한 일은 거두고 수락 기한 일만
    jobs = {
        x["kind"]
        for x in query(
            "select kind from jobs where ref_id = $1::uuid and status = 'pending'", visit
        )
    }
    assert "visit_reply_due" not in jobs and "visit_accept_due" in jobs
    # 업체가 수락하지 않아 offered로 돌아와도 끝나게 고르기 기한 일도 있어요(리뷰 1)
    assert "visit_pick_due" in jobs
    # 고른 반나절은 다시 고를 수 없어요(같은 집)
    assert open_days(api, pid, vid).get(day, []) == ["am"]

    # 업체는 현장 사정을 보고 못 받아요(picked에서도)
    login(api, "maru@mitjip.test")
    r = api.post(
        f"/vendor/visits/{visit}/decline", json={"code": "other", "note": "주차가 안 돼요"}
    )
    assert r.status_code == 200, r.text
    assert status(visit) == "declined"
    assert (
        query(
            "select count(*) as n from visit_holds where visit_id = $1::uuid and status = 'active'",
            visit,
        )[0]["n"]
        == 0
    )
    # 수락 기한 일은 거두고, 채팅은 읽기만(못 받아요)
    assert not pending_jobs(visit, "visit_accept_due")
    t = query("select status, ro_reason from threads where visit_id = $1::uuid", visit)
    assert [(x["status"], x["ro_reason"]) for x in t] == [("read_only", "declined")]


def test_pick_outside_open_days_is_refused(api):
    token, pid, vid = setup(api)
    login(api, "maru@mitjip.test")
    days = list(open_days_for_vendor(api))
    assert (
        api.put("/vendor/open-days", json={"open_weekdays": [0], "off_days": []}).status_code == 200
    )
    use(api, token)
    shut = next(d for d in days if today_seoul().fromisoformat(d).weekday() != 0)
    r = api.post(
        f"/projects/{pid}/visits",
        json={
            "trade": "dobae",
            "vendor_ids": [vid],
            "picks": [{"vendor_id": vid, "day": shut, "half": "am"}],
        },
    )
    assert code(r) == (409, "slot_taken")
    assert query("select count(*) as n from visits where project_id = $1::uuid", pid)[0]["n"] == 0


def open_days_for_vendor(api):
    t = today_seoul()
    return [(t + timedelta(days=i)).isoformat() for i in range(2, 9)]


def test_vendor_accepts_picked_request(api):
    _token, pid, vid = setup(api)
    day = next(iter(open_days(api, pid, vid)))
    r = api.post(
        f"/projects/{pid}/visits",
        json={
            "trade": "dobae",
            "vendor_ids": [vid],
            "picks": [{"vendor_id": vid, "day": day, "half": "am"}],
        },
    )
    assert r.status_code == 201, r.text
    visit = visit_of(pid, vid)
    login(api, "maru@mitjip.test")
    r = api.post(f"/vendor/visits/{visit}/accept")
    assert r.status_code == 200, r.text
    assert status(visit) == "booked"
    assert (
        len(query("select id from threads where visit_id = $1::uuid", visit)) == 1
    )  # 같은 채팅을 써요


def test_accept_due_never_after_picked_half():
    from datetime import UTC, datetime, time

    from app.calc import deadline
    from app.shared.clock import SEOUL

    now = datetime(2026, 11, 25, 5, 0, tzinfo=UTC)  # 서울 14:00
    tomorrow = now.astimezone(SEOUL).date() + timedelta(days=1)
    assert deadline.accept_due(now, tomorrow, "am") == datetime.combine(tomorrow, time(9), SEOUL)
    far = tomorrow + timedelta(days=10)
    assert deadline.accept_due(now, far, "pm") == now + timedelta(hours=48)
    assert deadline.accept_due(now) == now + timedelta(hours=48)


def test_same_half_for_two_vendors_is_409(api):
    """한 집에 같은 반나절 업체 둘은 안 돼요(리뷰 2): 한 요청 안에서 · 이미 잡아 둔 반나절과도"""
    token, pid, vid = setup(api)
    vid2 = vendor(api, "gyeol@mitjip.test", "결도배")
    use(api, token)
    assert add(api, pid, vid2).status_code == 201
    days = open_days(api, pid, vid)
    day = next(d for d in days if "am" in open_days(api, pid, vid2).get(d, []))
    body = {"trade": "dobae", "vendor_ids": [vid, vid2]}
    same = [
        {"vendor_id": vid, "day": day, "half": "am"},
        {"vendor_id": vid2, "day": day, "half": "am"},
    ]
    assert code(api.post(f"/projects/{pid}/visits", json={**body, "picks": same})) == (
        409,
        "slot_taken",
    )
    assert query("select count(*) as n from visits where project_id = $1::uuid", pid)[0]["n"] == 0
    # 하나 먼저 잡고, 다른 업체를 같은 반나절로 따로 요청해도 409
    one = {"trade": "dobae", "vendor_ids": [vid], "picks": same[:1]}
    assert api.post(f"/projects/{pid}/visits", json=one).status_code == 201
    two = {"trade": "dobae", "vendor_ids": [vid2], "picks": same[1:]}
    assert code(api.post(f"/projects/{pid}/visits", json=two)) == (409, "slot_taken")


def test_same_half_after_window_answer_is_409(api):
    """기간 답 뒤 고르기(원래 길)도 한 집 같은 반나절 업체 둘은 409예요(리뷰 3)"""
    f = booked(api)  # 마루와벽: 오늘 + 6일 오전 확정
    vid2 = vendor(api, "gyeol@mitjip.test", "결도배")
    use(api, f["token"])
    assert add(api, f["pid"], vid2).status_code == 201
    assert ask(api, f["pid"], [vid2]).status_code == 201
    visit2 = visit_of(f["pid"], vid2)
    login(api, "gyeol@mitjip.test")
    assert answer(api, visit2).status_code == 200
    use(api, f["token"])
    assert code(choose(api, f["pid"], visit2, 6, "am")) == (409, "slot_taken")
    assert status(visit2) == "offered"
    assert choose(api, f["pid"], visit2, 6, "pm").status_code == 200  # 다른 반나절은 돼요


def test_reply_due_expiry_makes_request_chat_read_only(api):
    """요청 때 연 채팅은 업체 답 기한이 지나 요청이 끝나면 읽기만(expired)이에요(리뷰 3)"""
    import asyncio
    import uuid
    from datetime import datetime

    from app.db import SessionLocal
    from app.jobs.models import Job
    from app.visit import jobs as visit_jobs

    _token, pid, vid = setup(api)
    r = api.post(f"/projects/{pid}/visits", json={"trade": "dobae", "vendor_ids": [vid], **wish()})
    assert r.status_code == 201, r.text
    visit = visit_of(pid, vid)
    assert [
        x["status"] for x in query("select status from threads where visit_id = $1::uuid", visit)
    ] == ["open"]
    due = query("select reply_due_at from visits where id = $1::uuid", visit)[0]["reply_due_at"]

    async def go(now: datetime):
        job = Job(
            id=uuid.uuid4(),
            kind="visit_reply_due",
            ref_id=uuid.UUID(visit),
            run_at=now,
            dedup_key="t",
            status="running",
        )
        async with SessionLocal() as s:
            out = await visit_jobs.HANDLERS["visit_reply_due"](s, job, now)
            await s.commit()
            return out

    asyncio.run(go(due + timedelta(minutes=1)))
    assert status(visit) == "expired"
    t = query("select status, ro_reason from threads where visit_id = $1::uuid", visit)
    assert [(x["status"], x["ro_reason"]) for x in t] == [("read_only", "expired")]


def wish() -> dict:
    t = today_seoul()
    return {
        "wish_start": (t + timedelta(days=2)).isoformat(),
        "wish_end": (t + timedelta(days=9)).isoformat(),
    }
