"""#207 표준견적서 기준 = 업체 견적서 시장 단가(2026-11-26 팀 결정): 비교 기준 금액이 화면의 시장 단가 견적과 같고,
목공을 고른 공사는 시장 단가 견적에 목공도 들어가요. 부분 공사는 시장 단가로 셀 수 없어 None."""

from decimal import Decimal

from app.quote.service import market_calc
from app.refprice.market_basis import basis_total
from tests.helpers import signup
from tests.test_project import body as v2_body
from tests.test_v3_project_home import HOME, create


def test_basis_is_the_market_quote_total():
    q, _ = market_calc(pyeong=None, area_m2=Decimal("69.4"), area_basis="supply", wallpaper="silk")
    assert basis_total("dobae", "69.4", "supply", "basic", "full") == q.total
    economy = basis_total("dobae", "69.4", "supply", "economy", "full")
    assert economy is not None and economy < q.total  # 합지가 더 싸요
    assert basis_total("dobae", "69.4", "supply", "basic", "partial") is None
    assert basis_total("mokgong", "69.4", "supply", None, "full")


def test_mokgong_project_market_quote_has_both_trades(api):
    signup(api)
    dobae = create(api, HOME).json()["id"]
    both = create(api, v2_body())  # 옛 몸통: 도배 + 목공
    assert both.status_code == 201, both.text
    a = api.get(f"/v2/projects/{dobae}/market-quote").json()
    b = api.get(f"/v2/projects/{both.json()['id']}/market-quote").json()
    assert [t["name"] for t in a["trades"]] == ["도배"]
    assert {t["name"] for t in b["trades"]} == {"도배", "목공 (문 포함)"} and b["total"] > a[
        "total"
    ]


def test_mokgong_options_follow_chosen_items(api):
    """고른 목공 할 곳만 시장 단가 선택 항목으로: 몰딩 · 걸레받이만이면 방문 교체 · 보드 보수는 꺼요"""
    signup(api)
    p = create(api, v2_body()).json()  # 목공 할 곳: 몰딩 · 걸레받이
    q = api.get(f"/v2/projects/{p['id']}/market-quote").json()
    on = {o["key"] for o in q["options"] if o["on"]}
    assert "doors" not in on and "board" not in on


def test_mokgong_basis_counts_only_chosen_items():
    """목공 비교 기준도 고른 목공 할 곳만: 몰딩 · 걸레받이만이면 문 · 중문 · 단열을 넣지 않아요(넣으면 4배쯤 커져요)"""
    only, _ = market_calc(
        pyeong=None,
        area_m2=Decimal(84),
        area_basis="exclusive",
        dobae=False,
        mokgong=True,
        options=frozenset(),
    )
    got = basis_total("mokgong", "84", "exclusive", None, "full", ["molding", "base"])
    assert got == only.total
    assert got < basis_total("mokgong", "84", "exclusive", None, "full")  # 모르면 흔한 것
    with_door = basis_total("mokgong", "84", "exclusive", None, "full", ["molding", "door"])
    assert with_door is not None and with_door > got
