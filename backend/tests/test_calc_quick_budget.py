"""빠른 예산: 모르는 칸 기본값 · 다른 유형 범위 · '더 정확히' 순서 · 집 카드 · API."""

from decimal import Decimal

import pytest

from app.calc.common import pyeong_to_m2
from app.calc.quick_budget import QuickIn, quick
from app.refprice.market import MARKET_2026_11 as BOOK
from tests.helpers import signup

PY32 = pyeong_to_m2(Decimal(32))


def test_unknowns_use_common_values_and_show_other_grade():
    r = quick(QuickIn(area_m2=PY32, molding=True, base=True), BOOK)
    assert (r.lo, r.hi) == (3_710_000, 5_450_000)  # 부가세 포함 · 만 원 단위
    assert [t.trade for t in r.trades] == ["dobae", "mokgong"]
    assert (r.lo, r.hi) == (sum(t.lo for t in r.trades), sum(t.hi for t in r.trades))
    assert r.alt is not None and (r.alt.lo, r.alt.hi) == (2_480_000, 3_570_000)
    assert "도배는 기본형(실크)으로 계산" in r.assumed and "천장 도배 포함" in r.assumed


def test_asks_go_from_biggest_spread():
    r = quick(QuickIn(area_m2=PY32, molding=True, base=True), BOOK)
    assert [a.key for a in r.asks] == ["door", "grade", "ceiling", "occupied"]
    assert [a.spread for a in r.asks] == sorted((a.spread for a in r.asks), reverse=True)
    door = {c.value: (c.lo, c.hi) for c in r.asks[0].choices}
    assert door["none"] == (r.lo, r.hi) and door["frame"] == (5_470_000, 8_200_000)
    ceiling = {c.value: (c.lo, c.hi) for c in r.asks[2].choices}
    assert ceiling["false"] == (2_720_000, 4_040_000)


def test_answered_fields_leave_asks_and_alt():
    r = quick(
        QuickIn(area_m2=PY32, grade="economy", ceiling=True, occupied=False, door="none"), BOOK
    )
    assert r.alt is None and r.asks == ()
    assert (r.lo, r.hi) == (1_300_000, 1_730_000)


def test_nothing_to_change_is_rejected():
    with pytest.raises(ValueError):
        quick(QuickIn(area_m2=PY32, dobae=False), BOOK)


def test_quick_budget_api(api):
    assert api.post("/v2/quick-budget", json={"pyeong": 32}).status_code == 401
    signup(api)
    r = api.post("/v2/quick-budget", json={"pyeong": 32, "molding": True, "base": True})
    assert r.status_code == 200, r.text
    assert (r.json()["lo"], r.json()["hi"]) == (3_710_000, 5_450_000)
    assert api.post("/v2/quick-budget", json={}).status_code == 422
    assert api.post("/v2/quick-budget", json={"pyeong": 32, "dobae": False}).status_code == 422
    whole = api.post("/v2/quick-budget", json={"plan": {"id": "fp04"}}).json()
    part = api.post("/v2/quick-budget", json={"plan": {"id": "fp04", "kinds": ["living"]}}).json()
    assert part["hi"] < whole["hi"] and "고른 공간만" in part["assumed"][0]
    assert api.post("/v2/quick-budget", json={"plan": {"id": "nope"}}).status_code == 404


def test_quote_grade_reaches_dobae_amount(api):
    signup(api)
    q = {"pyeong": 32, "cats": ["wallpaper"], "tier": "basic"}
    basic = api.post("/v2/quote", json=q | {"grade": "basic"}).json()["precise"][0]["total"]
    economy = api.post("/v2/quote", json=q | {"grade": "economy"}).json()["precise"][0]["total"]
    assert economy < basic
