"""#193 인테리어 받기 공정 고르기: v3 기본 정보에 목공 할 곳(mokgong)을 같이 받으면 공사가 도배 · 목공 두 공정으로 만들어진다.
고치기에서 빼면 목공 공정이 없어지고, 손님 계산은 도배만 센다. 같은 항목 두 번 · 모르는 항목은 422."""

from tests.helpers import signup
from tests.test_v3_project_home import HOME, create

MOK = {**HOME, "mokgong": ["molding", "base"]}


def test_home_with_mokgong_makes_two_trades(api):
    signup(api)
    r = create(api, MOK)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["trades"]["mokgong"] == {"spaces": [], "items": ["molding", "base"]}
    assert p["trades"]["dobae"]["grade"] == "basic"
    assert p["home"]["mokgong"] == ["molding", "base"]

    st = api.get(f"/projects/{p['id']}/standard").json()
    assert [t["trade"] for t in st["trades"]] == ["mokgong", "dobae"]  # 공사 순서: 목공 → 도배
    dobae_only = api.get(f"/projects/{create(api, HOME).json()['id']}/standard").json()
    assert st["total"] > dobae_only["total"]


def test_patch_can_drop_mokgong(api):
    signup(api)
    p = create(api, MOK).json()
    r = api.patch(f"/projects/{p['id']}", json=HOME)
    assert r.status_code == 200, r.text
    assert r.json()["trades"]["mokgong"] is None and r.json()["home"]["mokgong"] == []
    st = api.get(f"/projects/{p['id']}/standard").json()
    assert [t["trade"] for t in st["trades"]] == ["dobae"]


def test_guest_standard_counts_dobae_only(api):
    a = api.post("/guest/standard", json=HOME)
    b = api.post("/guest/standard", json=MOK)
    assert a.status_code == b.status_code == 200, b.text
    assert a.json()["total"] == b.json()["total"]


def test_mokgong_errors(api):
    signup(api)
    for bad in (["molding", "molding"], ["window"]):
        r = create(api, {**HOME, "mokgong": bad})
        assert r.status_code == 422, (bad, r.text)


def test_guest_market_quote_matches_member_for_chosen_items(api):
    """손님 시장 단가(/v2/market-quote)도 고른 목공 할 곳만 세요: 문만 고르면 몰딩 · 걸레받이를 빼서 가입 뒤 금액과 같아요"""
    signup(api)
    p = create(api, {**HOME, "mokgong": ["door"]}).json()
    member = api.get(f"/v2/projects/{p['id']}/market-quote").json()
    body = {"area_m2": "69.4", "area_basis": "supply", "mokgong": True, "wallpaper": "silk"}
    guest = api.post(
        "/v2/market-quote", json={**body, "options": ["doors"], "molding": False, "skirting": False}
    )
    assert guest.status_code == 200, guest.text
    assert guest.json()["total"] == member["total"]
    full = api.post("/v2/market-quote", json={**body, "options": ["doors"]}).json()
    assert full["total"] > member["total"]  # 몰딩 · 걸레받이를 넣으면 더 커요
