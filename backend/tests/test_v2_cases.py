"""v2 인테리어 한 건(/v2/cases): 고객 본인 것만, 금액 · 날짜는 서버가 다시 계산해 남긴다."""

from app.v2.case_service import MAX_CASES
from tests.helpers import signup, use, vendor_signup
from tests.test_v2_api import QUOTE

STATE = {
    "style": "modern",
    "info": {"pyeong": 32, "region": "서울 노원구"},
    "picks": {"a": "b"},
    "far": 6,
}
PLAN = {
    "quote": QUOTE,
    "move": "",
    "cons": {"weekendWork": False, "endBy": "", "startAfter": "", "avoid": []},
    "props": {},
    "accepted": {},
    "trial": None,
}


def test_case_flow(api):
    signup(api)
    assert api.get("/v2/cases").json() == []
    r = api.post("/v2/cases", json={"state": STATE})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["title"] == "인테리어 1" and c["quote"] is None and c["plan"] is None
    assert (c["style"], c["pyeong"], c["region"], c["picks"], c["far"]) == (
        "modern",
        32,
        "서울 노원구",
        1,
        6,
    )

    # 화면이 보낸 입력으로 서버가 견적 · 공정표를 계산해 남긴다
    r = api.put(f"/v2/cases/{c['id']}", json={"state": STATE, "quote_in": QUOTE, "plan_in": PLAN})
    assert r.status_code == 200, r.text
    item = r.json()
    q = api.post("/v2/quote", json=QUOTE).json()
    p = api.post("/v2/plan", json=PLAN).json()
    assert item["quote_total"] == q["total"] and item["quote_code"] == q["code"]
    assert (item["cost_lo"], item["cost_hi"]) == (q["all_lo"], q["all_hi"])  # 참고 공정이 있어 범위
    assert item["trades"] == len(q["precise"]) + len(q["ref"])
    assert (item["plan_start"], item["plan_end"], item["work_days"]) == (
        p["start"],
        p["end"],
        p["work_days"],
    )
    full = api.get(f"/v2/cases/{c['id']}").json()
    assert full["quote"]["total"] == q["total"] and full["plan"]["start"] == p["start"]
    assert full["state"] == STATE

    # 계산할 수 없는 입력이면 결과만 비우고 고른 값은 남긴다
    bad = QUOTE | {"plan": {"id": "nope"}}
    r = api.put(f"/v2/cases/{c['id']}", json={"state": STATE | {"far": 3}, "quote_in": bad})
    assert r.status_code == 200 and r.json()["quote_total"] is None and r.json()["far"] == 3

    r = api.patch(f"/v2/cases/{c['id']}", json={"title": "안방 도배"})
    assert r.status_code == 200 and r.json()["title"] == "안방 도배"
    assert api.patch(f"/v2/cases/{c['id']}", json={"title": ""}).status_code == 422
    assert [x["title"] for x in api.get("/v2/cases").json()] == ["안방 도배"]

    assert api.delete(f"/v2/cases/{c['id']}").status_code == 204
    assert api.get(f"/v2/cases/{c['id']}").status_code == 404
    assert api.get("/v2/cases").json() == []


def test_case_owner_and_role(api):
    a = signup(api, "a@mitjip.test")
    cid = api.post("/v2/cases", json={"state": STATE}).json()["id"]
    signup(api, "b@mitjip.test")
    # 남의 것은 있는지도 알리지 않는다
    assert api.get(f"/v2/cases/{cid}").status_code == 404
    assert api.put(f"/v2/cases/{cid}", json={"state": {}}).status_code == 404
    assert api.patch(f"/v2/cases/{cid}", json={"title": "x"}).status_code == 404
    assert api.delete(f"/v2/cases/{cid}").status_code == 404
    assert api.get("/v2/cases").json() == []
    use(api, a)
    assert api.get(f"/v2/cases/{cid}").status_code == 200

    vendor_signup(api)
    assert api.get("/v2/cases").status_code == 403
    assert api.post("/v2/cases", json={"state": STATE}).status_code == 403
    api.cookies.clear()
    assert api.get("/v2/cases").status_code == 401


def test_case_limits(api):
    signup(api)
    big = {"x": "가" * 200_001}
    assert api.post("/v2/cases", json={"state": big}).status_code == 413
    assert api.post("/v2/cases", json={"state": STATE, "title": "가" * 41}).status_code == 422
    for _ in range(MAX_CASES):
        assert api.post("/v2/cases", json={"state": STATE}).status_code == 201
    r = api.post("/v2/cases", json={"state": STATE})
    assert r.status_code == 409 and r.json()["error"]["code"] == "too_many"
