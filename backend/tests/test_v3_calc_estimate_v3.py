"""가견적 v3 계산 엔진(dobae_v3, 1201~1208): 업체 단가 × 계산 엔진 수량, 받는 법 3가지, 간이 · 면세 부가세 0,
표준견적서에 없는 줄(퍼티 · 식대 · 운송비)은 비교 %에서 뺀다. 기대값은 9판 C11 · D02와 손 검산."""

from decimal import Decimal

import pytest

from app.calc import dobae
from app.calc.estimate import (
    PRICE_KEYS,
    PRICE_ROWS,
    V3_BY_KEY,
    V3_ROWS,
    PriceV3,
    estimate_v3,
    row_amount,
)
from app.calc.space_share import SPACE_SHARE_2026_11
from app.refprice.book import DOBAE_2026H2
from app.refprice.house import HOUSE_2026H2
from app.refprice.vendor_baseline import vendor_base
from app.refprice.wallpaper_market import paper_market

D = Decimal
C07 = dobae.HomeV3(D("69.4"), "supply", "basic", False)
MARU = {  # 9판 C11 마루와벽 (합지 5,000원은 '합지 −31만 1,850원'이 나오는 값)
    "putty": PriceV3("price", 20_000),
    "paper_hapji": PriceV3("price", 5_000),
    "paper_silk": PriceV3("price", 9_500),
    "material": PriceV3("price", 13_000),
    "labor": PriceV3("price", 300_000),
    "meal": PriceV3("price", 11_000),
    "truck": PriceV3("price", 50_000),
}


def std(h=C07) -> dobae.StandardV3:
    return dobae.standard_v3(
        h, DOBAE_2026H2, paper_market(h.grade), SPACE_SHARE_2026_11, HOUSE_2026H2
    )


def test_rows_codes_units_match_baseline():
    assert PRICE_ROWS["dobae_v3"] == V3_ROWS
    assert PRICE_KEYS["dobae_v3"] == (
        "putty",
        "paper_hapji",
        "paper_silk",
        "material",
        "labor",
        "meal",
        "truck",
    )
    assert [r.code for r in V3_ROWS] == ["1201", "1203", "1204", "1205", "1206", "1207", "1208"]
    for r in V3_ROWS:  # 단위 · 키가 B6 기준값 표와 같다(L01 '단위를 분명히')
        b = vendor_base(r.code)
        assert (b.key, b.unit) == (r.key, r.unit), r.code
    assert [r.key for r in V3_ROWS if not r.in_standard] == ["putty", "meal", "truck"]


def test_c11_maru_total_and_compare_without_extra_lines():
    v = std()
    e = estimate_v3(MARU, v.qty, grade="basic", standard_total=v.quote.total)
    got = [(x.row.code, x.qty, x.unit_price, x.amount) for x in e.lines]
    assert got == [
        ("1201", D("21.0"), 20_000, 420_000),
        ("1204", D("63.0"), 9_500, 598_500),  # 실크를 고른 집: 합지 줄은 안 쓴다
        ("1205", D("21.0"), 13_000, 273_000),
        ("1206", D("5.0"), 300_000, 1_500_000),
        ("1207", D("5.0"), 11_000, 55_000),
        ("1208", D(1), 50_000, 50_000),
    ]
    assert (e.supply, e.vat, e.total) == (2_896_500, 289_650, 3_186_150)  # 9판 C11과 같음
    # 비교는 표준견적서에 있는 줄(실크 · 부자재 · 인건비)만: (598,500 + 273,000 + 1,500,000) × 1.1
    assert e.compare_total == 2_608_650
    assert e.vs_standard_pct == D("26.6")  # 퍼티 · 식대 · 운송비를 넣으면 54.6%로 부풀어요
    assert e.paper_ok is True


def test_grade_preview_diff_matches_c11():
    v_silk, v_hapji = std(), std(dobae.HomeV3(D("69.4"), "supply", "economy", False))
    silk = estimate_v3(MARU, v_silk.qty, grade="basic")
    hapji = estimate_v3(MARU, v_hapji.qty, grade="economy")
    assert [x.row.key for x in hapji.lines][1] == "paper_hapji"
    assert hapji.total - silk.total == -311_850  # C11 '합지 −31만 1,850원'
    assert silk.vs_standard_pct is None  # 표준을 안 주면 비움


def test_included_and_excluded_modes():
    prices = {**MARU, "meal": PriceV3("included", included_in="labor")}
    e = estimate_v3(prices, std().qty, grade="basic")
    meal = next(x for x in e.lines if x.row.key == "meal")
    assert (meal.mode, meal.amount, meal.included_in, meal.unit_price) == (
        "included",
        0,
        "labor",
        None,
    )
    assert e.supply == 2_896_500 - 55_000
    no_silk = estimate_v3({**MARU, "paper_silk": PriceV3("excluded")}, std().qty, grade="basic")
    assert no_silk.paper_ok is False  # '이 벽지는 안 해요'
    no_hapji = {**MARU, "paper_hapji": PriceV3("excluded")}  # 고르지 않은 벽지를 빼는 건 괜찮다
    assert estimate_v3(no_hapji, std().qty, grade="basic").paper_ok is True
    missing = {k: p for k, p in MARU.items() if k != "truck"}  # 안 넣은 줄은 '빼기'로 본다
    e2 = estimate_v3(missing, std().qty, grade="basic")
    truck = next(x for x in e2.lines if x.row.key == "truck")
    assert (truck.mode, truck.amount) == ("excluded", 0) and e2.supply == 2_896_500 - 50_000


def test_simplified_or_exempt_vendor_has_no_vat():
    v = std()
    e = estimate_v3(MARU, v.qty, grade="basic", exempt=True, standard_total=v.quote.total)
    assert (e.supply, e.vat, e.total) == (2_896_500, 0, 2_896_500)
    assert e.compare_total == 2_371_500 and e.vs_standard_pct == D("15.1")


def test_partial_quantities_shrink_by_share():
    v = std(
        dobae.HomeV3(
            D("69.4"), "supply", "basic", False, "partial", ("living", "kitchen"), ("wall",)
        )
    )
    e = estimate_v3(MARU, v.qty, grade="basic", standard_total=v.quote.total)
    got = {x.row.key: (x.qty, x.amount) for x in e.lines}
    assert got["putty"] == (D("6.7"), 134_000)  # 21.0평 × 0.32
    assert got["paper_silk"] == (D("15.1"), 143_450)
    assert got["labor"] == (D("1.0"), 300_000)
    assert e.vs_standard_pct is not None


def test_d02_example_column_amounts():
    """업체 단가표 '공급 69.4㎡ 집이면'(9판 D02 결도배): 15,000 → 315,000 · 9,000 → 567,000 …"""
    q = std().qty
    assert row_amount(V3_BY_KEY["putty"], PriceV3("price", 15_000), q) == (D("21.0"), 315_000)
    assert row_amount(V3_BY_KEY["paper_silk"], PriceV3("price", 9_000), q) == (D("63.0"), 567_000)
    assert row_amount(V3_BY_KEY["material"], PriceV3("price", 12_000), q) == (D("21.0"), 252_000)
    assert row_amount(V3_BY_KEY["labor"], PriceV3("price", 2_800_000), q) == (
        D("5.0"),
        14_000_000,
    )
    assert row_amount(V3_BY_KEY["meal"], PriceV3("included", included_in="labor"), q)[1] == 0
    assert row_amount(V3_BY_KEY["truck"], None, q) == (D(1), 0)


def test_price_v3_checks_its_mode():
    with pytest.raises(ValueError):
        PriceV3("price")
    with pytest.raises(ValueError):
        PriceV3("included")
    with pytest.raises(ValueError):
        PriceV3("excluded", 1_000)
    with pytest.raises(ValueError):
        PriceV3("price", -1)
