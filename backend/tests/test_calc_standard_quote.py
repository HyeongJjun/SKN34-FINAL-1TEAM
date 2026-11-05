"""집 크기 · 부가세 · 표준 대비 차이 · 공휴일."""

from datetime import date
from decimal import Decimal

import pytest

from app.calc.common import Money, add_money, from_entered, with_vat
from app.calc.quote_diff import budget_gap, percent_vs
from app.calc.standard_quote import house_area, house_pyeong
from app.refprice.holidays import HOLIDAYS, LAST_YEAR, days_off
from app.refprice.house import HOUSE_2026H2 as H


def test_band_becomes_its_common_pyeong():
    assert house_pyeong("30", None, None, H) == Decimal("34.0")
    assert house_pyeong("20", None, None, H) == Decimal("24.0")
    assert house_area("30", None, None, H) == (Decimal("112.4"), "supply")


def test_supply_and_exclusive_area():
    assert house_pyeong(None, Decimal("105.8"), "supply", H) == Decimal("32.0")
    # 84.9 × 1.2 = 101.88㎡ → 30.82평
    assert house_pyeong(None, Decimal("84.9"), "exclusive", H) == Decimal("30.8")
    assert house_area(None, Decimal("84.9"), "exclusive", H) == (Decimal("84.9"), "exclusive")


def test_house_needs_band_or_area():
    with pytest.raises(ValueError):
        house_pyeong(None, None, None, H)
    with pytest.raises(ValueError):
        house_area(None, Decimal("80.0"), None, H)


def test_vat_is_ten_percent_rounded_once():
    assert with_vat(3_080_000) == Money(3_080_000, 308_000, 3_388_000)
    assert with_vat(2_878_687) == Money(2_878_687, 287_869, 3_166_556)
    with pytest.raises(ValueError):
        with_vat(-1)


def test_entered_amount_by_vat_mode():
    # 업체가 '부가세 빼고 308만 원'으로 적으면 고객에게 338만 8,000원
    assert from_entered(3_080_000, "excluded") == Money(3_080_000, 308_000, 3_388_000)
    # '부가세 포함'으로 적은 금액은 그대로 합계다
    assert from_entered(3_388_000, "included") == Money(3_080_000, 308_000, 3_388_000)
    assert from_entered(3_762_000, "included").total == 3_762_000
    m = from_entered(1_000, "included")  # 909.09 → 909, 부가세 91
    assert m.supply + m.vat == m.total == 1_000
    assert from_entered(3_080_000, "exempt") == Money(3_080_000, 0, 3_080_000)
    with pytest.raises(ValueError):
        from_entered(-5, "excluded")
    with pytest.raises(ValueError):
        from_entered(5, "half")  # type: ignore[arg-type]


def test_add_money_sums_each_column():
    rows = [from_entered(150_000, "excluded"), from_entered(55_000, "included")]
    assert add_money(rows) == Money(200_000, 20_000, 220_000)
    assert add_money([]) == Money(0, 0, 0)


def test_percent_vs_standard():
    assert percent_vs(3_132_800, 3_166_556) == Decimal("-1.1")
    assert percent_vs(3_344_000, 3_166_556) == Decimal("5.6")
    with pytest.raises(ValueError):
        percent_vs(100, 0)


def test_holidays_cover_through_last_year_and_skip_weekends_only_by_calc():
    assert date(2026, 9, 25) in HOLIDAYS and date(LAST_YEAR, 12, 27) in HOLIDAYS
    assert max(HOLIDAYS).year == LAST_YEAR
    assert days_off(date(2026, 11, 1), date(2026, 11, 30)) == frozenset()
    assert days_off(date(2026, 9, 20), date(2026, 9, 30)) == {
        date(2026, 9, 24),
        date(2026, 9, 25),
        date(2026, 9, 26),
    }


def test_budget_gap():
    assert budget_gap(4_505_262, "300-500") == ("within", None)
    assert budget_gap(5_200_000, "300-500") == ("over", 200_000)
    assert budget_gap(5_200_000, "o1000") == ("open", None)
    with pytest.raises(ValueError):
        budget_gap(1, "x")
