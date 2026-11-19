"""v3 실측 일정 규칙 더: 기한이 지난 뒤의 업체 답 · 수락(409 expired), 제안한 날이 그사이 찼을 때(409
slot_taken), 확정 전 캘린더 파일(404), 실측 일정 경로 권한(남의 공사 · 남의 요청 404 · 역할 다름 403 ·
로그인 없음 401)."""

import uuid

from tests.conftest import query
from tests.helpers import make_admin, signup, use
from tests.test_v3_visit_kit import (
    answer,
    booked,
    choose,
    d,
    offered,
    picked,
    requested,
    status,
    vendor,
)
from tests.test_visit_inbox import login


def code(r) -> tuple[int, str]:
    return r.status_code, r.json().get("error", {}).get("code", "")


def test_late_vendor_answers_are_expired(api):
    f = requested(api)
    query("update visits set reply_due_at = now() - interval '1 minute'")  # worker가 아직 안 돎
    login(api, f["email"])
    assert code(answer(api, f["visit"])) == (409, "expired")
    assert status(f["visit"]) == "requested"

    g = picked(api, customer_email="two@mitjip.test", vid=f["vendor"])
    query(
        "update visit_holds set until = now() - interval '1 minute' where visit_id = $1",
        uuid.UUID(g["visit"]),
    )
    login(api, f["email"])
    assert code(api.post(f"/vendor/visits/{g['visit']}/accept")) == (409, "expired")
    assert status(g["visit"]) == "picked"


def test_proposed_half_taken_by_another_customer(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    query("update vendors set visit_capacity = 1 where user_id = $1", uuid.UUID(a))
    one = picked(api, vid=a, customer_email="one@mitjip.test")
    login(api, "maru@mitjip.test")
    body = {"reason_code": "other_site", "slots": [{"day": d(9), "half": "am"}]}
    assert api.post(f"/vendor/visits/{one['visit']}/propose", json=body).status_code == 200
    two = offered(api, vid=a, customer_email="two@mitjip.test")  # 바로 확정 켬
    assert choose(api, two["pid"], two["visit"], n=9, half="am").json()["status"] == "booked"
    use(api, one["token"])
    url = f"/projects/{one['pid']}/visits/{one['visit']}/proposal/pick"
    assert code(api.post(url, json={"day": d(9), "half": "am"})) == (409, "slot_taken")
    assert status(one["visit"]) == "proposed"  # 그대로: 다시 고르기를 누를 수 있다
    assert query("select status from visit_proposals")[0]["status"] == "open"


def test_ics_only_after_booking(api):
    f = requested(api)
    assert api.get(f"/projects/{f['pid']}/visits/{f['visit']}/ics").status_code == 404


def test_visit_routes_permissions(api):
    f = booked(api)
    other = vendor(api, "other@mitjip.test", "다른도배")
    p, v = f["pid"], f["visit"]
    customer_calls = (
        ("get", f"/projects/{p}/visits/{v}", None),
        ("get", f"/projects/{p}/visits/{v}/ics", None),
        ("get", f"/projects/{p}/visits/draft?trade=dobae", None),
        ("post", f"/projects/{p}/visits/{v}/pick", {"day": d(7), "half": "am"}),
        ("post", f"/projects/{p}/visits/{v}/cancel", {"code": "changed"}),
        ("post", f"/projects/{p}/visits/{v}/visited", {"result": "visited"}),
        ("post", f"/projects/{p}/visits/{v}/changes", {"day": d(8), "half": "am"}),
        ("post", f"/projects/{p}/visits/{v}/again", None),
        ("post", f"/projects/{p}/visits/{v}/requote", None),
    )
    vendor_calls = (
        ("get", f"/vendor/visits/{v}", None),
        ("post", f"/vendor/visits/{v}/window", {"start": d(5), "end": d(9), "excluded": []}),
        ("post", f"/vendor/visits/{v}/accept", None),
        (
            "post",
            f"/vendor/visits/{v}/propose",
            {"reason_code": "other", "slots": [{"day": d(7), "half": "am"}]},
        ),
        ("post", f"/vendor/visits/{v}/decline", {"code": "full"}),
    )

    def hit(calls) -> list[int]:
        out = []
        for method, url, body in calls:
            r = (
                api.request(method.upper(), url, json=body)
                if body is not None
                else api.request(method.upper(), url)
            )
            out.append(r.status_code)
        return out

    signup(api, "stranger@mitjip.test")
    assert hit(customer_calls) == [404] * len(customer_calls)  # 남의 공사 · 남의 요청
    login(api, "other@mitjip.test")
    assert hit(vendor_calls) == [404] * len(vendor_calls)  # 다른 업체가 받은 요청
    assert hit(customer_calls) == [403] * len(customer_calls)  # 업체가 고객 길
    use(api, f["token"])
    assert hit(vendor_calls) == [403] * len(vendor_calls)  # 고객이 업체 길
    make_admin(api)
    assert hit(customer_calls) == [403] * len(customer_calls)
    api.cookies.clear()
    assert hit(customer_calls + vendor_calls) == [401] * (len(customer_calls) + len(vendor_calls))
    assert status(v) == "booked" and other
