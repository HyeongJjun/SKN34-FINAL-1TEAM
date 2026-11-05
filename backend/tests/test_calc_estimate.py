"""가견적 계산: 업체 단가 × 표준견적서 수량, 포함 줄 0원, 단가 없는 줄은 빼고 남긴다."""

from decimal import Decimal

import pytest

from app.calc import dobae, mokgong
from app.calc.estimate import PRICE_ROWS, StdLine, VendorPrice, estimate, price_key
from app.refprice.book import DOBAE_2026H2, MOKGONG_2026H2

MARU = {  # 시안 예시 업체의 도배 단가 (부가세 빼고)
    "wall": VendorPrice(6650),
    "ceiling": VendorPrice(6800),
    "paper_basic": VendorPrice(3400),
    "primer": VendorPrice(included_in="paper_basic"),
}


def dobae_lines(grade="basic", ceiling=True, occupied=False) -> list[StdLine]:
    inp = dobae.DobaeInput(Decimal("105.8"), "supply", grade, ceiling, occupied)  # 32평
    return [StdLine(ln.key, ln.qty, ln.state) for ln in dobae.quote(inp, DOBAE_2026H2).lines]


def test_board_example_32_pyeong():
    e = estimate(dobae_lines(), MARU, trade="dobae", grade="basic")
    got = {x.key: (x.unit_price, x.qty, x.amount) for x in e.lines}
    assert got == {
        "wall": (6650, Decimal("198.4"), 1_319_360),
        "ceiling": (6800, Decimal("66.1"), 449_480),
        "paper": (3400, Decimal("317.4"), 1_079_160),
        "primer": (None, Decimal("291.0"), 0),  # 도배지에 포함
    }
    assert (e.supply, e.vat, e.total) == (2_848_000, 284_800, 3_132_800)
    assert e.missing == () and e.left_out == ()  # 철거 · 폐기물(실측 후)은 처음부터 안 본다
    assert next(x for x in e.lines if x.key == "primer").included_in == "paper_basic"


def test_missing_prices_are_left_out_and_named():
    e = estimate(dobae_lines("economy"), MARU, trade="dobae", grade="economy")
    assert e.missing == ("paper", "primer")  # 합지 단가 없음 · 초배지의 포함 대상도 없음
    assert e.supply == 1_319_360 + 449_480
    no_ceiling = estimate(dobae_lines(ceiling=False), MARU, trade="dobae", grade="basic")
    assert "ceiling" not in {x.key for x in no_ceiling.lines}  # 천장을 안 하면 줄이 안 셈
    occupied = estimate(dobae_lines(occupied=True), MARU, trade="dobae", grade="basic")
    assert occupied.left_out == ("occupied",)  # 할증은 업체 단가 칸이 없다


def test_exempt_vendor_has_no_vat_and_empty_prices_give_zero():
    e = estimate(dobae_lines(), MARU, trade="dobae", grade="basic", exempt=True)
    assert (e.supply, e.vat, e.total) == (2_848_000, 0, 2_848_000)
    none = estimate(dobae_lines(), {}, trade="dobae", grade="basic")
    assert none.lines == () and none.total == 0
    assert none.missing == ("wall", "ceiling", "paper", "primer")


def test_vendor_price_is_price_or_included():
    with pytest.raises(ValueError):
        VendorPrice()
    with pytest.raises(ValueError):
        VendorPrice(100, "wall")
    with pytest.raises(ValueError):
        VendorPrice(-1)


@pytest.mark.parametrize("target_state", [None, "excluded", "optional", "bundled", "after_visit"])
def test_included_price_requires_a_counted_target(target_state):
    lines = [StdLine("molding", Decimal(20), "included")]
    if target_state is not None:
        lines.append(StdLine("door", Decimal(2), target_state))
    prices = {"molding": VendorPrice(included_in="door"), "door": VendorPrice(90_000)}
    e = estimate(lines, prices, trade="mokgong")
    assert e.missing == ("molding",)
    assert e.lines == ()


@pytest.mark.parametrize("state", ["included", "separate"])
def test_included_price_uses_counted_target_regardless_of_order(state):
    lines = [StdLine("molding", Decimal(20), "included"), StdLine("door", Decimal(2), state)]
    prices = {"molding": VendorPrice(included_in="door"), "door": VendorPrice(90_000)}
    e = estimate(lines, prices, trade="mokgong")
    assert e.missing == ()
    assert e.total == 198_000
    assert e.lines[0].included_in == "door" and e.lines[0].amount == 0


@pytest.mark.parametrize("quantity", [None, Decimal(0)])
def test_included_price_requires_target_quantity(quantity):
    lines = [
        StdLine("molding", Decimal(20), "included"),
        StdLine("door", quantity, "included"),
    ]
    prices = {"molding": VendorPrice(included_in="door"), "door": VendorPrice(90_000)}
    assert estimate(lines, prices, trade="mokgong").missing == ("molding",)


def test_price_rows_match_calc_lines():
    """단가를 받는 표준 행 키 · 이름 · 단위가 계산 엔진 줄과 어긋나지 않는다."""
    lines = []
    for g in ("basic", "economy"):
        inp = dobae.DobaeInput(Decimal("105.8"), "supply", g, True, True)
        lines += [("dobae", g, ln) for ln in dobae.quote(inp, DOBAE_2026H2).lines]
    items = ("molding", "base", "door", "flatten")
    m = mokgong.quote(
        mokgong.MokgongInput(Decimal("105.8"), "supply", items, True, 3), MOKGONG_2026H2
    )
    lines += [("mokgong", None, ln) for ln in m.lines]
    rows = {(t, r.key): r for t, rs in PRICE_ROWS.items() for r in rs}
    seen = set()
    for trade, grade, ln in lines:
        row = rows.get((trade, price_key(ln.key, grade)))
        if ln.state == "after_visit" or ln.qty is None:
            assert row is None  # 실측 후 · 수량 없는 줄은 단가를 받지 않는다
            continue
        assert (row.name, row.unit) == (ln.name, ln.unit), ln.key
        seen.add((trade, row.key))
    assert seen == set(rows)
