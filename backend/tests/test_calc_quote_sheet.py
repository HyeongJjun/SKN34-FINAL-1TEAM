"""표준견적서 총괄표: 비용 종류 나누기 · 요율 · 단수 · 부가세."""

from decimal import Decimal

import pytest

from app.calc import quote_sheet


def _line(key, amount, state="included"):
    return {"key": key, "name": key, "qty": 1.0, "unit": "식", "amount": amount, "state": state}


DOBAE = {
    "trade": "dobae",
    "ko": "도배",
    "supply": 1_500_000,
    "days": 2.5,
    "lines": [
        _line("wall", 700_000),
        _line("ceiling", 300_000),
        _line("paper", 400_000),
        _line("primer", 100_000),
        _line("removal", 200_000, "after_visit"),
        _line("waste", None, "after_visit"),
    ],
}
MOK = {
    "trade": "mokgong",
    "ko": "목공",
    "supply": 500_000,
    "days": 1,
    "lines": [_line("molding", 300_000), _line("molding_mat", 200_000)],
}


def test_bucket_of():
    assert quote_sheet.bucket_of("paper") == "material"
    assert quote_sheet.bucket_of("door_mat") == "material"
    assert quote_sheet.bucket_of("waste") == "expense"
    assert quote_sheet.bucket_of("wall") == "labor"


def test_build_sheet():
    s = quote_sheet.build([MOK, DOBAE], Decimal(20))
    d, m = s.trades[1], s.trades[0]
    assert (d.material, d.labor, d.expense, d.total) == (500_000, 1_000_000, 0, 1_500_000)
    # 실측 후 줄은 합계 밖이고 금액이 있어도 더하지 않는다
    assert [ln.counted for ln in d.lines][-2:] == [False, False]
    assert s.net == 2_000_000 and (s.material, s.labor) == (700_000, 1_300_000)
    assert (d.share, m.share) == (Decimal("75.0"), Decimal("25.0"))
    assert (d.bar, m.bar) == (100, 33)
    assert s.mix == {"material": Decimal("35.0"), "labor": Decimal("65.0"), "expense": 0}
    # 이윤 5% · 공과잡비 2% · 산재 1.1% · 고용 0.42%
    assert [o.amount for o in s.overheads] == [100_000, 40_000, 22_000, 8_400]
    before = 2_000_000 + 170_400
    assert s.supply == 2_170_000 and s.cut == s.supply - before == -400
    assert (s.vat, s.total) == (217_000, 2_387_000)
    assert s.per_pyeong == 119_350


def test_build_rejects_mismatch_and_bad_pyeong():
    with pytest.raises(ValueError):
        quote_sheet.build([MOK | {"supply": 1}], Decimal(20))
    with pytest.raises(ValueError):
        quote_sheet.build([MOK], Decimal(0))
