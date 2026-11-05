"""업체 확정: 본 버전 확인, 다른 요청 닫기 · 이력 · 알림, 동시 확정 409, 연락처, 공사 탭, 권한, 제약."""

import asyncio
import uuid
from datetime import datetime

import asyncpg
import pytest

from app.auth.models import User
from app.calc.schedule import due_at
from app.db import SessionLocal
from app.schedule import service
from app.schedule.schemas import ConfirmIn
from app.shared.clock import today_seoul
from app.shared.errors import AppError
from tests.conftest import query
from tests.helpers import make_admin, no_surprises, signup, use, vendor_signup
from tests.test_quote_compare import quote
from tests.test_visit_inbox import login, visit_of
from tests.test_visit_request import SHARE, home, listed, send

TODAY = today_seoul()


def setup(api):
    """마루와벽 · 결도배(견적서 보냄, 연락처 보냄) · 한결인테리어(기다림)에 도배 실측을 요청한 집"""
    a = listed(api, "maru@mitjip.test", "마루와벽")
    b = listed(api, "gyeol@mitjip.test", "결도배")
    c = listed(api, "hangyeol@mitjip.test", "한결인테리어")
    customer, p = home(api)
    assert send(api, p["id"], [a, b, c], share_contact_ids=[a, b], **SHARE).status_code == 201
    va, vb, vc = visit_of(a), visit_of(b), visit_of(c)
    login(api, "maru@mitjip.test")
    quote(api, va, 3_080_000)
    login(api, "gyeol@mitjip.test")
    quote(api, vb, 3_762_000, "included")
    use(api, customer)
    return customer, p["id"], va, vb, vc


def confirm(api, pid: str, vid: str, seen: int = 1):
    return api.post(f"/projects/{pid}/quotes/{vid}/confirm", json={"seen_ver": seen})


def test_confirm_makes_a_deal_and_closes_the_others(api):
    customer, pid, va, vb, vc = setup(api)
    seen = {
        x["visit_id"]: x["seen_ver"]
        for x in api.get(f"/projects/{pid}/quotes?trade=dobae").json()["vendors"]
    }
    r = confirm(api, pid, va, seen[va])
    assert r.status_code == 200, r.text
    out = r.json()
    d = out["deal"]
    assert (d["status"], d["vendor_name"], d["owner_name"]) == (
        "confirmed",
        "마루와벽",
        "예시 대표",
    )
    assert (d["quote"]["version"], d["quote"]["total"]) == (1, 3_388_000)
    confirmed_at = datetime.fromisoformat(d["confirmed_at"])
    assert datetime.fromisoformat(d["dates_due_at"]) == due_at(
        confirmed_at, 2
    )  # 2일 뒤 18:00 (서울)
    assert d["overdue"] is False and out["quote_expired"] is False
    assert set(out["closed"]) == {vb, vc}

    status = {
        str(r["id"]): (r["status"], r["close_reason"])
        for r in query("select id, status, close_reason from visits")
    }
    assert status == {
        va: ("chosen", None),
        vb: ("closed", "other_chosen"),
        vc: ("closed", "other_chosen"),
    }
    events = query(
        "select visit_id, from_status, to_status, code from visit_events where to_status in ('chosen', 'closed')"
    )
    assert {(str(e["visit_id"]), e["from_status"], e["to_status"], e["code"]) for e in events} == {
        (va, "quoted", "chosen", None),
        (vb, "quoted", "closed", "other_chosen"),
        (vc, "requested", "closed", "other_chosen"),
    }
    (de,) = query("select from_status, to_status from deal_events")
    assert (de["from_status"], de["to_status"]) == (None, "confirmed")

    def notes(email):
        uid = query("select id from users where email = $1", email)[0]["id"]
        rows = query(
            "select body, link, dedup_key from notifications where user_id = $1 and kind <> 'visit_requested'",
            uid,
        )
        return [dict(x) for x in rows]

    assert notes("maru@mitjip.test") == [
        {
            "body": "고객이 확정했어요 · 공사 날짜를 내 주세요",
            "link": f"/vendor/jobs/{d['id']}",
            "dedup_key": f"deal:{d['id']}",
        }
    ]
    for email, vid in (("gyeol@mitjip.test", vb), ("hangyeol@mitjip.test", vc)):
        assert notes(email) == [
            {
                "body": "고객이 다른 업체로 정했어요",
                "link": f"/vendor/requests/{vid}",
                "dedup_key": f"visit:{vid}:closed",
            }
        ]

    visits = {v["id"]: v for v in api.get(f"/projects/{pid}/visits").json()["visits"]}
    assert visits[va]["contact_visible"] is True and visits[va]["contact"]["phone"] == "01059372210"
    assert visits[vb]["contact"] is None and visits[vb]["status"] == "closed"
    cmp = api.get(f"/projects/{pid}/quotes", params={"trade": "dobae"}).json()
    assert cmp["deal"]["id"] == d["id"] and [x["visit_id"] for x in cmp["vendors"]] == [va]
    assert [x["id"] for x in api.get(f"/projects/{pid}/deals").json()] == [d["id"]]
    assert api.get(f"/projects/{pid}/deals", params={"trade": "mokgong"}).json() == []
    again = confirm(api, pid, va)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_chosen"
    assert confirm(api, pid, vb).json()["error"]["message"] == "이미 업체를 확정했어요."

    login(api, "maru@mitjip.test")
    assert (
        api.get(f"/vendor/visits/{va}").json()["customer"]["phone"] == "01012345678"
    )  # 확정: 계속 보인다
    (job,) = api.get("/vendor/visits", params={"tab": "jobs"}).json()["items"]
    assert (job["id"], job["deal_id"], job["deal_status"], job["overdue"]) == (
        va,
        d["id"],
        "confirmed",
        False,
    )
    assert job["customer"]["name"] == "고객" and job["dates_due_at"] == d["dates_due_at"]
    assert api.get("/vendor/visits", params={"tab": "waiting"}).json()["items"] == []
    summary = api.get("/vendor/visits/summary").json()
    assert (summary["jobs"], summary["waiting"], summary["recent"]["chosen"]) == (1, 0, 1)
    query("update deals set dates_due_at = now() - interval '1 hour'")
    assert api.get("/vendor/visits", params={"tab": "jobs"}).json()["items"][0]["overdue"] is True
    login(api, "gyeol@mitjip.test")
    assert api.get(f"/vendor/visits/{vb}").json()["customer"] is None  # 닫힘: 바로 가려진다
    (gone,) = api.get("/vendor/visits", params={"tab": "done"}).json()["items"]
    assert (gone["status"], gone["close_reason"]) == ("closed", "other_chosen")
    assert api.get("/vendor/visits/summary").json()["jobs"] == 0
    use(api, customer)
    assert api.get(f"/projects/{pid}/deals").json()[0]["overdue"] is True


def test_seen_version_must_be_the_latest(api):
    _, pid, va, _, _ = setup(api)
    login(api, "maru@mitjip.test")
    quote(api, va, 3_110_000, name="고침.pdf")  # 고객이 화면을 연 뒤 다시 올림
    login(api, "home@mitjip.test")
    r = confirm(api, pid, va, 1)
    assert r.status_code == 409 and r.json()["error"]["code"] == "quote_changed"
    assert (
        r.json()["error"]["message"]
        == "업체가 견적서를 다시 올렸어요. 새 견적서를 보고 다시 확정해 주세요."
    )
    assert query("select status from visits where id = $1", uuid.UUID(va))[0][0] == "quoted"
    ok = confirm(api, pid, va, 2)
    assert ok.status_code == 200 and ok.json()["deal"]["quote"]["version"] == 2
    login(api, "maru@mitjip.test")
    blocked = api.put(f"/vendor/visits/{va}/quote", json={})
    assert blocked.status_code == 409  # 확정한 버전은 바꾸지 않는다


def test_only_quoted_requests_can_be_chosen(api):
    _, pid, va, vb, vc = setup(api)
    r = confirm(api, pid, vc)
    assert r.status_code == 409 and r.json()["error"]["message"] == "아직 견적서가 오지 않았어요."
    query("update visits set status = 'cancelled' where id = $1", uuid.UUID(vb))
    r = confirm(api, pid, vb)
    assert (
        r.status_code == 409
        and r.json()["error"]["message"] == "취소된 실측의 견적서라 고를 수 없어요."
    )
    assert confirm(api, pid, str(uuid.uuid4())).status_code == 404
    assert api.post(f"/projects/{pid}/quotes/{va}/confirm", json={"seen_ver": 0}).status_code == 422
    assert query("select count(*) n from deals")[0]["n"] == 0
    assert query("select locked_at from projects")[0]["locked_at"] is not None


def test_two_confirms_at_once_only_one_wins(api):
    _, pid, va, vb, _ = setup(api)
    me = query("select id from users where email = 'home@mitjip.test'")[0]["id"]

    async def go(vid):
        async with SessionLocal() as s:
            user = await s.get(User, me)
            return await service.confirm(
                s, user, uuid.UUID(pid), uuid.UUID(vid), ConfirmIn(seen_ver=1), TODAY
            )

    async def both():
        return await asyncio.gather(go(va), go(vb), return_exceptions=True)

    results = no_surprises(asyncio.run(both()))
    errors = [r for r in results if isinstance(r, AppError)]
    assert len(errors) == 1 and errors[0].status == 409
    assert query("select count(*) n from deals")[0]["n"] == 1
    assert query("select count(*) n from visits where status = 'chosen'")[0]["n"] == 1
    assert len(query("select id from notifications where kind = 'deal_confirmed'")) == 1


def test_only_the_owner_customer(api):
    customer, pid, va, _, _ = setup(api)
    calls = (
        lambda: confirm(api, pid, va),
        lambda: api.get(f"/projects/{pid}/deals"),
        lambda: api.get(f"/projects/{pid}/quotes", params={"trade": "dobae"}),
    )
    signup(api, "other@mitjip.test")
    assert all(c().status_code == 404 for c in calls)  # 남의 집
    login(api, "maru@mitjip.test")
    assert all(c().status_code == 403 for c in calls)  # 업체
    make_admin(api)
    assert all(c().status_code == 403 for c in calls)  # 관리자
    vendor_signup(api, email="waiting@mitjip.test")
    r = api.get("/vendor/visits", params={"tab": "jobs"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "vendor_not_approved"
    use(api, customer)
    assert api.get("/vendor/visits", params={"tab": "jobs"}).status_code == 403  # 고객이 업체 API
    assert query("select count(*) n from deals")[0]["n"] == 0


NEW_DEAL = (
    "insert into deals (id, project_id, trade, vendor_name, visit_id, quote_id, dates_due_at)"
    " select gen_random_uuid(), project_id, trade, 'x', $1, quote_id, now() from deals"
)


@pytest.mark.parametrize(
    "sql",
    [
        "update deals set status = 'paused'",
        "update deals set date_request_count = 3",
        "update deals set start_date = current_date",  # 끝날 없음
        "update deals set start_date = current_date, end_date = current_date - 1",
        "update deals set status = 'scheduled'",  # 날짜 없이 수락
        "update deals set work_done_on = current_date",  # 확정인데 끝낸 날
        "update deals set status = 'checking', start_date = current_date, end_date = current_date",
        "insert into deal_events (id, deal_id, to_status, note) select gen_random_uuid(), id, 'confirmed', ' ' from deals",
        "insert into deal_events (id, deal_id, to_status) select gen_random_uuid(), id, 'paused' from deals",
    ],
)
def test_deal_checks(api, sql):
    _, pid, va, _, _ = setup(api)
    assert confirm(api, pid, va).status_code == 200
    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        query(sql)


def test_one_open_deal_per_trade_and_quote_is_kept(api):
    _, pid, va, vb, _ = setup(api)
    assert confirm(api, pid, va).status_code == 200
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):
        query(NEW_DEAL, uuid.UUID(vb))  # 같은 공정에 두 번째 확정
    with pytest.raises(asyncpg.exceptions.ForeignKeyViolationError):
        query("delete from vendor_quotes where id = (select quote_id from deals)")  # 확정한 버전
    query("update deals set status = 'reselected'")
    query(NEW_DEAL, uuid.UUID(vb))  # 다시 고른 뒤에는 새로 확정할 수 있다
    assert query("select count(*) n from deals")[0]["n"] == 2
