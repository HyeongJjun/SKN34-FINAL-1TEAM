"""#193 인테리어 받기 공정 고르기: v3 기본 정보에 목공 할 곳(mokgong)을 같이 받으면 공사가 도배 · 목공 두 공정으로 만들어진다.
고치기에서 빼면 목공 공정이 없어지고, 손님 계산도 가입 뒤처럼 목공을 센다. 같은 항목 두 번 · 모르는 항목은 422."""

from tests.helpers import signup
from tests.test_v3_project_home import HOME, PART, create

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


def test_guest_standard_keeps_dobae_lines_and_adds_mokgong(api):
    """손님 계산: 도배 줄 · 금액은 그대로, 목공은 parts로 더하고 합계는 sum"""
    a = api.post("/guest/standard", json=HOME).json()
    b = api.post("/guest/standard", json=MOK).json()
    assert a["total"] == b["total"] and a["parts"] == [] and a["sum"] is None
    assert [x["trade"] for x in b["parts"]] == ["mokgong"]
    assert b["sum"]["total"] == b["total"] + b["parts"][0]["total"]


def test_guest_partial_with_mokgong_matches_member(api):
    """부분 도배 + 목공도 가입 전 합계 · 일수 = 가입 뒤 표준견적서 합계 · 일수(문은 방 1개로)"""
    signup(api)
    for mok in (["molding", "base"], ["door"], ["door", "flatten"]):
        home = {**PART, "start_date": None, "mokgong": mok}
        guest = api.post("/guest/standard", json=home)
        assert guest.status_code == 200, guest.text
        g = guest.json()
        p = create(api, home)
        assert p.status_code == 201, p.text
        st = api.get(f"/projects/{p.json()['id']}/standard").json()
        assert (g["sum"]["supply"], g["sum"]["vat"], g["sum"]["total"]) == (
            st["supply"],
            st["vat"],
            st["total"],
        ), mok
        assert g["days"] == st["days"], mok
        member_mok = next(t for t in st["trades"] if t["trade"] == "mokgong")
        assert g["parts"][0]["total"] == member_mok["total"], mok


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
