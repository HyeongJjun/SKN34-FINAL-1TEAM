"""고객 실측 상태판: 공정 없이 부르면 이 공사 모든 공정의 업체가 온다(#234 리뷰 · 내 공사 목록)

합성 데이터(실제 사람 · 업체 아님).
"""

from tests.conftest import query
from tests.helpers import PDF, signup, upload
from tests.test_project import body as project_body
from tests.test_v3_visit_kit import add, ask, vendor
from tests.test_vendor_profile import URL as PROFILE
from tests.test_vendor_profile import approved_vendor, vendor_id
from tests.test_vendor_profile import body as profile_body
from tests.test_visit_vendors import NOWON_32

BOTH = {
    "dobae": {"spaces": ["a", "b", "c"], "grade": "basic"},
    "mokgong": {"spaces": ["a"], "items": ["molding"]},
}


def mok_vendor(api, email: str, name: str) -> str:
    """승인 · 확인한 목공 단가(몰딩)까지 만든 목공 업체 id (가견적 있음)"""
    approved_vendor(api, email)
    assert api.put(PROFILE, json=profile_body(trades=["mokgong"])).status_code == 200
    fid = upload(api, kind="price_doc", content=PDF, name="목공단가.pdf").json()["id"]
    assert (
        api.post("/vendor/price-files", json={"file_id": fid, "trade": "mokgong"}).status_code
        == 201
    )
    lines = [{"key": "molding", "unit_price": 15_000}, {"key": "molding_mat", "unit_price": 3_000}]
    assert api.put("/vendor/prices/mokgong", json={"lines": lines}).status_code == 200
    assert api.post("/vendor/prices/mokgong/confirm").status_code == 200
    query("update vendors set biz_name = $1 where user_id = $2", name, vendor_id(email))
    return str(vendor_id(email))


def names(api, pid: str, **params) -> set[str]:
    r = api.get(f"/projects/{pid}/visits", params=params)
    assert r.status_code == 200, r.text
    return {x["vendor_name"] for x in r.json()["board"]}


def test_board_without_trade_has_every_trade(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    b = mok_vendor(api, "hanbbeom@mitjip.test", "한뼘목공")
    signup(api, "home@mitjip.test")
    r = api.post("/projects", json=project_body(**{**NOWON_32, "trades": BOTH}))
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    for vid, t in ((a, "dobae"), (b, "mokgong")):
        r = add(api, pid, vid, t)
        assert r.status_code == 201, r.text
    r = ask(api, pid, [a])
    assert r.status_code == 201, r.text
    r = ask(api, pid, [b], trade="mokgong")
    assert r.status_code == 201, r.text

    assert names(api, pid) == {"마루와벽", "한뼘목공"}
    assert names(api, pid, trade="dobae") == {"마루와벽"}
    assert names(api, pid, trade="mokgong") == {"한뼘목공"}
