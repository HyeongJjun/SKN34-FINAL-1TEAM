"""업체 멈춤 · 외부 링크 확인의 연결 (1단계 마무리): report가 vendor.service · visit.service를 부른다.

- 멈춤(all): 진행 중 실측 요청을 vendor_stopped로 닫고(0035) 고객에게 visit_vendor_stopped 알림, 대화는 읽기만
- 링크 확인: POST /admin/vendors/{id}/links/{sort}가 report에서 동작 — 본 주소 보호 · 같은 상태 409 · 기록 · 알림
"""

import uuid

from tests.conftest import query
from tests.helpers import make_admin, use
from tests.test_v3_schema_visit import migrate
from tests.test_v3_visit_kit import booked, notes, requested, status
from tests.test_vendor_profile import approved_vendor, vendor_id

BLOG = {"label": "블로그", "url": "https://blog.example.com/maru"}
PLACE = {"label": None, "url": "https://place.example.com/123"}


def test_suspend_all_closes_live_visits_as_vendor_stopped(api):
    f = booked(api)  # 실측 확정 + 대화 열림
    other = requested(api, customer_email="home2@mitjip.test", vid=f["vendor"])  # 요청만
    make_admin(api)
    r = api.post(
        f"/admin/vendors/{f['vendor']}/suspend", json={"scope": "all", "note": "신고 처리"}
    )
    assert r.status_code == 200, r.text
    assert (r.json()["suspend_scope"], r.json()["closed_visits"]) == ("all", 2)
    for v in (f["visit"], other["visit"]):
        row = query("select status, close_reason from visits where id = $1", uuid.UUID(v))[0]
        assert (row["status"], row["close_reason"]) == ("closed", "vendor_stopped")
    told = notes("home@mitjip.test", "visit_vendor_stopped")
    assert len(told) == 1 and told[0]["link"] == f"/projects/{f['pid']}/visits"
    assert "마루와벽" in told[0]["body"] and "다른 업체" in told[0]["body"]
    assert notes("home2@mitjip.test", "visit_vendor_stopped")
    ro = query("select status, ro_reason from threads where vendor_id = $1", uuid.UUID(f["vendor"]))
    assert ro and all(x["status"] == "read_only" for x in ro)  # 대화는 읽기만
    holds = query("select status from visit_holds where visit_id = $1", uuid.UUID(f["visit"]))
    assert holds and {h["status"] for h in holds} == {"released"}  # 잡은 반나절도 풀림
    # 다시 멈추면(같은 범위) 409, 닫힌 요청은 다시 닫지 않는다
    again = api.post(f"/admin/vendors/{f['vendor']}/suspend", json={"scope": "all", "note": "다시"})
    assert again.status_code == 409
    assert status(f["visit"]) == "closed"


def test_suspend_new_keeps_live_visits(api):
    f = requested(api)
    make_admin(api)
    r = api.post(f"/admin/vendors/{f['vendor']}/suspend", json={"scope": "new", "note": "확인"})
    assert (r.json()["suspend_scope"], r.json()["closed_visits"]) == ("new", 0)
    assert status(f["visit"]) == "requested"


def test_admin_link_check_route(api):
    token = approved_vendor(api)
    vid = vendor_id()
    assert api.put("/vendor/review-links", json={"links": [BLOG, PLACE]}).status_code == 200
    use(api, token)
    url = f"/admin/vendors/{vid}/links"
    assert api.post(f"{url}/0", json={"status": "shown"}).status_code == 403  # 업체
    make_admin(api)
    admin_id = query("select id from users where role = 'admin'")[0]["id"]
    r = api.post(f"{url}/0", json={"status": "shown", "url": BLOG["url"]})
    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["url"]) == ("shown", BLOG["url"])
    assert api.post(f"{url}/0", json={"status": "shown"}).json()["error"]["code"] == "already"
    # 관리자가 본 주소와 지금 주소가 다르면(그사이 업체가 고침) 바꾸지 않는다
    r = api.post(f"{url}/1", json={"status": "shown", "url": "https://place.example.com/old"})
    assert (r.status_code, r.json()["error"]["code"]) == (409, "stale")
    assert query("select status from vendor_review_links where sort = 1")[0]["status"] == "checking"
    r = api.post(f"{url}/1", json={"status": "hidden", "note": "광고 글이에요"})
    assert (r.json()["status"], r.json()["note"]) == ("hidden", "광고 글이에요")
    assert api.post(f"{url}/2", json={"status": "shown"}).status_code == 404  # 없는 링크
    assert (
        api.post(f"/admin/vendors/{uuid.uuid4()}/links/0", json={"status": "shown"}).status_code
        == 404
    )
    acts = query("select action, admin_id from admin_actions order by at")
    assert [a["action"] for a in acts] == ["link_shown", "link_hidden"]
    assert {a["admin_id"] for a in acts} == {admin_id}
    told = query("select kind from notifications where user_id = $1", uuid.UUID(str(vid)))
    assert [n["kind"] for n in told].count("link_checked") == 2


def test_0035_down_maps_vendor_stopped_to_reselected(api):
    f = requested(api)
    query(
        "update visits set status = 'closed', close_reason = 'vendor_stopped' where id = $1",
        uuid.UUID(f["visit"]),
    )
    try:
        migrate("0034_v3_stage1")
        row = query("select close_reason from visits where id = $1", uuid.UUID(f["visit"]))[0]
        assert row["close_reason"] == "reselected"
    finally:
        migrate("head")
