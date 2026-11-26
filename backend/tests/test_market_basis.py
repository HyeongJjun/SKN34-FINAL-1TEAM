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
