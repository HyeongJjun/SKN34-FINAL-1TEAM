"""다시 고르기: 확정 뒤(공사 날짜 수락 전) · 확정 전(견적 비교), 연락처 가림, 칸 다시 비움, 동시 요청 409, 권한."""

import asyncio
import uuid

import asyncpg

from app.auth.models import User
from app.db import SessionLocal
from app.schedule import service
from app.shared.errors import AppError
from tests.conftest import TEST_DSN, query
from tests.helpers import make_admin, no_surprises, signup, use
from tests.test_deal import confirm, setup
from tests.test_quote_compare import quote
from tests.test_visit_inbox import login
from tests.test_visit_request import SHARE, listed, send

AFTER_DATES = "공사 날짜를 수락한 뒤에는 업체를 다시 고를 수 없어요."
RESELECTED = "고객이 업체를 다시 고르기로 했어요"
SCHEDULED = (
    "update deals set status = 'scheduled',"
    " start_date = current_date + 7, end_date = current_date + 9"
)


def reselect(api, pid: str, did: str):
    return api.post(f"/projects/{pid}/deals/{did}/reselect")


def reselect_before(api, pid: str, trade: str = "dobae"):
    return api.post(f"/projects/{pid}/visits/reselect", json={"trade": trade})


def vendor_of(visit_id: str) -> str:
    return str(query("select vendor_id from visits where id = $1", uuid.UUID(visit_id))[0][0])


def open_visit(vendor: str) -> str:
    return str(
        query(
            "select id from visits where vendor_id = $1 and status = 'requested'",
            uuid.UUID(vendor),
        )[0]["id"]
    )


def notes(email: str, kind: str) -> list[dict]:
    uid = query("select id from users where email = $1", email)[0]["id"]
    rows = query(
        "select body, link, dedup_key from notifications where user_id = $1 and kind = $2",
        uid,
        kind,
    )
    return [dict(x) for x in rows]


def me() -> uuid.UUID:
    return query("select id from users where email = 'home@mitjip.test'")[0]["id"]


def test_reselect_after_confirm_closes_everything_and_frees_slots(api):
    customer, pid, va, vb, _ = setup(api)
    did = confirm(api, pid, va).json()["deal"]["id"]

    r = reselect(api, pid, did)
    assert r.status_code == 200, r.text
    assert r.json() == {"trade": "dobae", "closed": [va], "slots_left": 3}

    assert query("select status from deals")[0]["status"] == "reselected"
    events = query("select from_status, to_status, by_id from deal_events order by at")
    assert [(e["from_status"], e["to_status"]) for e in events] == [
        (None, "confirmed"),
        ("confirmed", "reselected"),
    ]
    assert events[1]["by_id"] == me()
    (v,) = query("select status, close_reason from visits where id = $1", uuid.UUID(va))
    assert (v["status"], v["close_reason"]) == ("closed", "reselected")
    (ve,) = query(
        "select from_status, code from visit_events where visit_id = $1 and to_status = 'closed'",
        uuid.UUID(va),
    )
    assert (ve["from_status"], ve["code"]) == ("chosen", "reselected")
    assert notes("maru@mitjip.test", "deal_reselected") == [
        {
            "body": RESELECTED,
            "link": f"/vendor/requests/{va}",
            "dedup_key": f"deal:{did}:reselected",
        }
    ]
    assert query("select count(*) n from vendor_quotes")[0]["n"] == 2  # 받은 견적서는 남는다

    # 고객 쪽: 연락처가 가려지고 칸 3개가 다시 빈다, 확정 · 비교에서 빠진다
    out = api.get(f"/projects/{pid}/visits").json()
    assert out["slots_left"]["dobae"] == 3
    mine = {x["id"]: x for x in out["visits"]}[va]
    assert (mine["status"], mine["close_reason"], mine["contact_visible"], mine["contact"]) == (
        "closed",
        "reselected",
        False,
        None,
    )
    assert mine["closed_at"] is not None
    board = api.get(f"/projects/{pid}/vendors", params={"trade": "dobae"}).json()
    assert board["slots_left"] == 3
    rows = {x["biz_name"]: x["visit"] for x in board["vendors"]}
    assert (rows["마루와벽"]["status"], rows["마루와벽"]["close_reason"]) == (
        "closed",
        "reselected",
    )
    assert (rows["결도배"]["status"], rows["결도배"]["close_reason"]) == ("closed", "other_chosen")
    assert api.get(f"/projects/{pid}/deals").json() == []
    cmp = api.get(f"/projects/{pid}/quotes", params={"trade": "dobae"}).json()
    assert cmp["deal"] is None and cmp["vendors"] == []

    # 업체 쪽: 고객 연락처가 가려지고 공사 탭에서 끝남 탭으로
    login(api, "maru@mitjip.test")
    assert api.get(f"/vendor/visits/{va}").json()["customer"] is None
    assert api.get("/vendor/visits", params={"tab": "jobs"}).json()["items"] == []
    (gone,) = api.get("/vendor/visits", params={"tab": "done"}).json()["items"]
    assert (gone["id"], gone["status"], gone["close_reason"], gone["customer"]) == (
        va,
        "closed",
        "reselected",
        None,
    )
    assert api.get("/vendor/visits/summary").json()["jobs"] == 0
    assert api.put(f"/vendor/visits/{va}/quote", json={}).status_code == 409

    # 같은 업체에 다시 요청하고 다시 확정할 수 있다
    use(api, customer)
    again = reselect(api, pid, did)
    assert again.status_code == 409 and again.json()["error"]["code"] == "invalid_state"
    maru, gyeol = vendor_of(va), vendor_of(vb)
    assert send(api, pid, [maru, gyeol], share_contact_ids=[maru], **SHARE).status_code == 201
    new_a = open_visit(maru)
    login(api, "maru@mitjip.test")
    assert api.get(f"/vendor/visits/{new_a}").json()["customer"]["phone"] == "01012345678"
    quote(api, new_a, 3_000_000)
    use(api, customer)
    ok = confirm(api, pid, new_a)
    assert ok.status_code == 200, ok.text
    assert [d["id"] for d in api.get(f"/projects/{pid}/deals").json()] == [ok.json()["deal"]["id"]]
    assert query("select count(*) n from deals")[0]["n"] == 2


def test_no_reselect_after_dates_are_accepted(api):
    _, pid, va, _, _ = setup(api)
    did = confirm(api, pid, va).json()["deal"]["id"]
    query(SCHEDULED)
    r = reselect(api, pid, did)
    assert r.status_code == 409 and r.json()["error"]["message"] == AFTER_DATES
    assert query("select status from visits where id = $1", uuid.UUID(va))[0][0] == "chosen"
    assert query("select count(*) n from deal_events")[0]["n"] == 1
    r = reselect_before(api, pid)
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_chosen"


def test_two_reselects_at_once_only_one_wins(api):
    _, pid, va, _, _ = setup(api)
    did = uuid.UUID(confirm(api, pid, va).json()["deal"]["id"])
    uid = me()

    async def go():
        async with SessionLocal() as s:
            return await service.reselect(s, await s.get(User, uid), uuid.UUID(pid), did)

    async def both():
        return await asyncio.gather(go(), go(), return_exceptions=True)

    results = no_surprises(asyncio.run(both()))
    errors = [r for r in results if isinstance(r, AppError)]
    assert len(errors) == 1 and errors[0].status == 409
    assert query("select count(*) n from deal_events where to_status = 'reselected'")[0]["n"] == 1
    assert len(query("select id from notifications where kind = 'deal_reselected'")) == 1


def test_date_acceptance_at_the_same_time_wins(api):
    """공사 날짜 수락이 먼저 행을 잡고 있으면 다시 고르기는 조건부 UPDATE에서 409"""
    _, pid, va, _, _ = setup(api)
    did = uuid.UUID(confirm(api, pid, va).json()["deal"]["id"])
    uid = me()

    async def run():
        conn = await asyncpg.connect(TEST_DSN)
        tx = conn.transaction()
        await tx.start()
        await conn.execute(SCHEDULED)

        async def go():
            async with SessionLocal() as s:
                return await service.reselect(s, await s.get(User, uid), uuid.UUID(pid), did)

        task = asyncio.create_task(go())
        await asyncio.sleep(0.5)
        await tx.commit()
        await conn.close()
        return (await asyncio.gather(task, return_exceptions=True))[0]

    (got,) = no_surprises([asyncio.run(run())])
    assert isinstance(got, AppError) and got.status == 409 and got.message == AFTER_DATES
    assert query("select status from deals")[0]["status"] == "scheduled"
    assert query("select status from visits where id = $1", uuid.UUID(va))[0][0] == "chosen"


def test_reselect_from_compare_before_confirming(api):
    customer, pid, va, vb, vc = setup(api)
    r = reselect_before(api, pid)
    assert r.status_code == 200, r.text
    assert r.json()["slots_left"] == 3 and set(r.json()["closed"]) == {va, vb, vc}
    rows = query("select id, status, close_reason from visits")
    assert {str(x["id"]): (x["status"], x["close_reason"]) for x in rows} == {
        va: ("closed", "reselected"),
        vb: ("closed", "reselected"),
        vc: ("closed", "reselected"),
    }
    events = query(
        "select visit_id, from_status, code from visit_events where to_status = 'closed'"
    )
    assert {(str(e["visit_id"]), e["from_status"], e["code"]) for e in events} == {
        (va, "quoted", "reselected"),
        (vb, "quoted", "reselected"),
        (vc, "requested", "reselected"),
    }
    for email, vid in (
        ("maru@mitjip.test", va),
        ("gyeol@mitjip.test", vb),
        ("hangyeol@mitjip.test", vc),
    ):
        assert notes(email, "visit_closed") == [
            {
                "body": RESELECTED,
                "link": f"/vendor/requests/{vid}",
                "dedup_key": f"visit:{vid}:closed",
            }
        ]
    assert query("select count(*) n from deals")[0]["n"] == 0
    assert all(v["contact"] is None for v in api.get(f"/projects/{pid}/visits").json()["visits"])
    assert api.get(f"/projects/{pid}/quotes", params={"trade": "dobae"}).json()["vendors"] == []
    login(api, "gyeol@mitjip.test")
    assert api.get(f"/vendor/visits/{vb}").json()["customer"] is None
    use(api, customer)
    again = reselect_before(api, pid)
    assert again.status_code == 409 and again.json()["error"]["code"] == "invalid_state"
    assert reselect_before(api, pid, "mokgong").status_code == 409  # 요청이 없는 공정
    assert send(api, pid, [vendor_of(va)]).status_code == 201  # 같은 업체에 다시


def test_no_new_request_while_a_deal_is_live(api):
    _, pid, va, _, _ = setup(api)
    assert confirm(api, pid, va).status_code == 200
    d = listed(api, "new@mitjip.test", "새도배")
    login(api, "home@mitjip.test")
    for ids in ([d], [vendor_of(va)]):
        r = send(api, pid, ids)
        assert r.status_code == 409 and r.json()["error"]["code"] == "already_chosen"
    r = reselect_before(api, pid)
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_chosen"
    assert query("select count(*) n from visits")[0]["n"] == 3


def test_only_the_owner_customer_can_reselect(api):
    customer, pid, va, _, _ = setup(api)
    did = confirm(api, pid, va).json()["deal"]["id"]
    calls = (lambda: reselect(api, pid, did), lambda: reselect_before(api, pid))
    signup(api, "other@mitjip.test")
    assert all(c().status_code == 404 for c in calls)  # 남의 집
    login(api, "maru@mitjip.test")
    assert all(c().status_code == 403 for c in calls)  # 업체
    make_admin(api)
    assert all(c().status_code == 403 for c in calls)  # 관리자
    use(api, customer)
    assert reselect(api, pid, str(uuid.uuid4())).status_code == 404
    assert query("select status from deals")[0]["status"] == "confirmed"
