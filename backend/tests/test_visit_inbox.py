"""실측 요청 취소 · 업체 못 받아요 · 업체 작업함: 전이와 동시 409, 칸 비우기, 연락처 가림, 권한, 탭 · 정렬 · seen."""

import asyncio
import uuid

from app.auth.models import User
from app.db import SessionLocal
from app.shared.clock import today_seoul
from app.shared.errors import AppError
from app.visit import service
from tests.conftest import query
from tests.helpers import no_surprises, signup, use, vendor_signup
from tests.test_project import body as project_body
from tests.test_visit_request import SHARE, home, listed, send
from tests.test_visit_vendors import NOWON_32

INBOX = "/vendor/visits"


def login(api, email: str) -> None:
    from tests.helpers import PASSWORD

    api.cookies.clear()
    assert api.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200


def visit_of(vid: str) -> str:
    return str(query("select id from visits where vendor_id = $1", uuid.UUID(vid))[0]["id"])


def notes(user_id) -> list[dict]:
    rows = query(
        "select body, link, project_id, dedup_key from notifications where user_id = $1"
        " order by created_at",
        uuid.UUID(str(user_id)),
    )
    return [dict(r) for r in rows]


def test_cancel_frees_the_slot_and_hides_contacts(api):
    a = listed(api, "maru@mitjip.test", "마루와벽")
    b = listed(api, "gyeol@mitjip.test", "결도배")
    customer, p = home(api)
    pid = p["id"]
    assert send(api, pid, [a, b], share_contact_ids=[a], **SHARE).status_code == 201
    va, vb = visit_of(a), visit_of(b)

    login(api, "maru@mitjip.test")
    d = api.get(f"{INBOX}/{va}").json()
    assert d["customer"] == {
        "name": "고객",
        "phone": "01012345678",
        "address": "서울 노원구 상계주공 101동 1203호",
    }
    (row,) = api.get(INBOX).json()["items"]
    assert row["customer"] == {"name": "고객", "phone": "01012345678", "address": None}
    login(api, "gyeol@mitjip.test")
    assert api.get(f"{INBOX}/{vb}").json()["customer"] is None  # 연락처를 안 보낸 요청

    use(api, customer)
    r = api.post(f"/projects/{pid}/visits/{va}/cancel")
    assert r.status_code == 200, r.text
    got = r.json()
    assert got["status"] == "cancelled" and got["contact_visible"] is False
    assert got["contact"] is None and got["closed_at"]
    again = api.post(f"/projects/{pid}/visits/{va}/cancel")
    assert again.status_code == 409 and again.json()["error"]["code"] == "invalid_state"
    listing = api.get(f"/projects/{pid}/visits").json()
    assert listing["slots_left"] == {"dobae": 2}  # 칸이 비었다
    mine = {v["id"]: v for v in listing["visits"]}
    assert mine[va]["closed_at"] and mine[vb]["closed_at"] is None
    assert send(api, pid, [a]).status_code == 201  # 같은 업체에 다시 요청할 수 있다

    login(api, "maru@mitjip.test")
    assert api.get(f"{INBOX}/{va}").json()["customer"] is None  # 업체 쪽도 바로 가려진다
    done = api.get(INBOX, params={"tab": "done"}).json()["items"]
    assert [x["id"] for x in done] == [va] and done[0]["closed_at"]
    bodies = [n["body"] for n in notes(a)]
    assert bodies == ["새 실측 요청이 왔어요 · 도배", "고객이 실측 요청을 취소했어요 · 도배"] + [
        "새 실측 요청이 왔어요 · 도배"
    ]
    events = query(
        "select from_status, to_status from visit_events where visit_id = $1 order by at",
        uuid.UUID(va),
    )
    assert [(e["from_status"], e["to_status"]) for e in events] == [
        (None, "requested"),
        ("requested", "cancelled"),
    ]


def test_vendor_declines_and_customer_sees_why(api):
    a = listed(api, "maru@mitjip.test", "마루와벽")
    b = listed(api, "gyeol@mitjip.test", "결도배")
    customer, p = home(api)
    pid = p["id"]
    send(api, pid, [a, b], share_contact_ids=[a], **SHARE)
    va, vb = visit_of(a), visit_of(b)
    login(api, "maru@mitjip.test")
    assert api.post(f"{INBOX}/{va}/decline", json={"code": "busy"}).status_code == 422
    r = api.post(f"{INBOX}/{va}/decline", json={"code": "full"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "declined" and r.json()["customer"] is None
    assert r.json()["decline_code"] == "full" and r.json()["closed_at"]
    assert api.post(f"{INBOX}/{va}/decline", json={"code": "other"}).status_code == 409
    login(api, "gyeol@mitjip.test")
    assert api.post(f"{INBOX}/{vb}/decline", json={"code": "out_of_area"}).status_code == 200

    use(api, customer)
    listing = api.get(f"/projects/{pid}/visits").json()
    got = {v["id"]: v for v in listing["visits"]}
    assert (got[va]["status"], got[va]["decline_code"]) == ("declined", "full")
    assert got[va]["contact_visible"] is False and got[va]["contact"] is None
    assert listing["slots_left"] == {"dobae": 3}
    me = query("select id from users where email = 'home@mitjip.test'")[0]["id"]
    assert notes(me) == [
        {
            "body": "마루와벽이 이번 요청을 받지 못해요 · 다른 업체를 담아 주세요",
            "link": f"/projects/{pid}/visits",
            "project_id": uuid.UUID(pid),
            "dedup_key": f"visit:{va}:declined",
        },
        {
            "body": "결도배가 이번 요청을 받지 못해요 · 다른 업체를 담아 주세요",
            "link": f"/projects/{pid}/visits",
            "project_id": uuid.UUID(pid),
            "dedup_key": f"visit:{vb}:declined",
        },
    ]
    assert send(api, pid, [a]).status_code == 201  # 못 받은 업체에도 다시 요청할 수 있다


def test_after_a_quote_neither_side_can_close_it(api):
    a = listed(api, "maru@mitjip.test", "마루와벽")
    customer, p = home(api)
    send(api, p["id"], [a], share_contact_ids=[a], **SHARE)
    va = visit_of(a)
    query("update visits set status = 'quoted'")
    r = api.post(f"/projects/{p['id']}/visits/{va}/cancel")
    assert (
        r.status_code == 409
        and r.json()["error"]["message"] == "견적서가 온 뒤에는 취소할 수 없어요."
    )
    login(api, "maru@mitjip.test")
    assert api.post(f"{INBOX}/{va}/decline", json={"code": "full"}).status_code == 409
    assert (
        api.get(f"{INBOX}/{va}").json()["customer"]["phone"] == "01012345678"
    )  # 견적서 옴: 보인다
    assert customer


def test_cancel_and_decline_at_once_only_one_wins(api):
    a = listed(api, "maru@mitjip.test", "마루와벽")
    _, p = home(api)
    send(api, p["id"], [a])
    va = uuid.UUID(visit_of(a))
    me = query("select id from users where email = 'home@mitjip.test'")[0]["id"]

    async def as_customer():
        async with SessionLocal() as s:
            user = await s.get(User, me)
            return await service.cancel(s, user, uuid.UUID(p["id"]), va, today_seoul())

    async def as_vendor():
        async with SessionLocal() as s:
            vendor = await s.get(User, uuid.UUID(a))
            return await service.decline(s, vendor, va, "full", today_seoul())

    async def both():
        return await asyncio.gather(as_customer(), as_vendor(), return_exceptions=True)

    results = no_surprises(asyncio.run(both()))
    errors = [r for r in results if isinstance(r, AppError)]
    assert len(errors) == 1 and errors[0].status == 409
    assert len(query("select id from visit_events where from_status = 'requested'")) == 1
    me_notes = len(notes(me))
    vendor_notes = len([n for n in notes(a) if n["dedup_key"].endswith("cancelled")])
    assert me_notes + vendor_notes == 1  # 이긴 쪽 알림만 한 번


def test_permissions(api):
    a = listed(api, "maru@mitjip.test", "마루와벽")
    listed(api, "other@mitjip.test", "다른도배")
    customer, p = home(api)
    send(api, p["id"], [a])
    va = visit_of(a)
    other_project = api.post("/projects", json=project_body(**NOWON_32)).json()["id"]
    assert api.post(f"/projects/{other_project}/visits/{va}/cancel").status_code == 404  # 다른 집
    assert api.get(INBOX).status_code == 403  # 고객이 업체 API
    assert api.post(f"{INBOX}/{va}/decline", json={"code": "full"}).status_code == 403

    signup(api, "stranger@mitjip.test")
    assert api.post(f"/projects/{p['id']}/visits/{va}/cancel").status_code == 404  # 남의 집

    login(api, "other@mitjip.test")  # 다른 업체
    assert api.get(f"{INBOX}/{va}").status_code == 404
    assert api.post(f"{INBOX}/{va}/decline", json={"code": "full"}).status_code == 404
    assert api.post(f"{INBOX}/{va}/seen").status_code == 404
    assert api.get(INBOX).json()["items"] == []
    assert api.post(f"/projects/{p['id']}/visits/{va}/cancel").status_code == 403  # 업체가 고객 API

    vendor_signup(api, email="waiting@mitjip.test")  # 승인 전
    for r in (api.get(INBOX), api.get(f"{INBOX}/summary"), api.get(f"{INBOX}/{va}")):
        assert r.status_code == 403 and r.json()["error"]["code"] == "vendor_not_approved"
    assert query("select status from visits")[0]["status"] == "requested"
    assert customer


def test_inbox_tabs_order_and_seen(api):
    a = listed(api, "maru@mitjip.test", "마루와벽")
    customer, first = home(api)
    projects = [first] + [
        api.post("/projects", json=project_body(**NOWON_32)).json() for _ in (1, 2)
    ]
    for days, p in zip((3, 2, 1), projects, strict=True):
        send(api, p["id"], [a])
        query(
            "update visits set created_at = now() - make_interval(days => $1)"
            " where project_id = $2",
            days,
            uuid.UUID(p["id"]),
        )
    ids = [
        str(query("select id from visits where project_id = $1", uuid.UUID(p["id"]))[0]["id"])
        for p in projects
    ]
    v1, v2, v3 = ids

    login(api, "maru@mitjip.test")
    assert api.post(f"{INBOX}/{v2}/seen").status_code == 204
    seen = query("select vendor_seen_at from visits where id = $1", uuid.UUID(v2))[0][0]
    assert api.post(f"{INBOX}/{v2}/seen").status_code == 204  # 두 번 불러도 처음 시각 그대로
    assert query("select vendor_seen_at from visits where id = $1", uuid.UUID(v2))[0][0] == seen
    todo = api.get(INBOX, params={"tab": "todo"}).json()["items"]
    assert [(x["id"], x["new"]) for x in todo] == [(v1, True), (v3, True), (v2, False)]
    row = todo[0]
    assert (row["code"], row["trade"], row["grade"], row["area_name"], row["pyeong"]) == (
        projects[0]["code"],
        "dobae",
        "basic",
        "노원구",
        "32.0",
    )
    assert row["customer"] is None and row["share_contact"] is False  # 연락처 안 보냄: 요청 번호로
    d = api.get(f"{INBOX}/{v1}").json()
    assert d["home_text"] == "노원구 · 32평 · 빈 집" and d["when_text"].count("~") == 1
    assert d["area_m2"] == "105.8" and d["area_basis"] == "supply" and d["occupied"] is False

    query("update visits set status = 'quoted' where id = $1", uuid.UUID(v2))
    query(  # 요청은 그보다 먼저 받았다
        "update visit_events set at = now() - interval '3 days' where visit_id = $1",
        uuid.UUID(v2),
    )
    query(
        "insert into visit_events (id, visit_id, from_status, to_status, at)"
        " values (gen_random_uuid(), $1, 'requested', 'quoted', now() - interval '2 days')",
        uuid.UUID(v2),
    )
    waiting = api.get(INBOX, params={"tab": "waiting"}).json()["items"]
    assert [(x["id"], x["waiting_days"]) for x in waiting] == [(v2, 2)]
    use(api, customer)
    api.post(f"/projects/{projects[0]['id']}/visits/{v1}/cancel")
    login(api, "maru@mitjip.test")
    api.post(f"{INBOX}/{v3}/decline", json={"code": "other"})
    page = api.get(INBOX, params={"tab": "done", "limit": 1}).json()
    assert [x["id"] for x in page["items"]] == [v3] and page["next_before"]  # 최근에 닫힌 것부터
    more = api.get(INBOX, params={"tab": "done", "limit": 1, "before": page["next_before"]}).json()
    assert [x["id"] for x in more["items"]] == [v1]
    assert more["items"][0]["status"] == "cancelled" and more["items"][0]["closed_at"]
    assert (
        api.get(INBOX, params={"tab": "done", "before": "2026-11-01T00:00:00"}).status_code == 422
    )
    assert api.get(INBOX, params={"tab": "work"}).status_code == 422
    assert api.get(f"{INBOX}/summary").json() == {
        "todo": 0,
        "waiting": 1,
        "done": 2,
        "jobs": 0,
        "recent": {"requested": 3, "quoted": 1, "chosen": 0},
    }
