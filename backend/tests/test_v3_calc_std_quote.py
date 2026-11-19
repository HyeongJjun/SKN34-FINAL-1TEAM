"""v3 표준견적서 계산 엔진(C07 · C60 · D01): 도배지 줄만 벽지 평 × 시장 평균 가격, 부분 공사 공간 몫.
기대값은 손으로 검산했다(data-model 6장 · contract 4.8)."""

from dataclasses import replace
from decimal import Decimal

import pytest

from app.calc import dobae
from app.calc.common import COUNTED, FORMULA_VERSION, won
from app.calc.space_share import SPACE_SHARE_2026_11, SpaceShares, share_of
from app.refprice.book import DOBAE_2026H2
from app.refprice.house import HOUSE_2026H2
from app.refprice.wallpaper_market import paper_market

D = Decimal
C07 = dobae.HomeV3(
    D("69.4"), "supply", "basic", False
)  # 9판 C07: 공급 69.4㎡ · 실크 · 천장 · 빈 집


def std(h: dobae.HomeV3) -> dobae.StandardV3:
    return dobae.standard_v3(
        h, DOBAE_2026H2, paper_market(h.grade), SPACE_SHARE_2026_11, HOUSE_2026H2
    )


def rows(q) -> dict:
    return {
        ln.key: (ln.qty, ln.unit, ln.unit_price, ln.amount, ln.state, ln.basis) for ln in q.lines
    }


def test_c07_total_is_2060625():
    v = std(C07)
    q = v.quote
    assert rows(q) == {
        "wall": (D("130.1"), "㎡", 5_993, 779_689, "included", "public"),
        "ceiling": (D("43.4"), "㎡", 8_531, 370_245, "included", "public"),
        # 173.5㎡ × 1.2 = 208.2㎡ → ÷ 3.3058 = 62.98 → 63.0 벽지 평 × 10,749
        "paper": (D("63.0"), "벽지 평", 10_749, 677_187, "included", "market"),
        "primer": (D("190.8"), "㎡", 242, 46_174, "included", "public"),
        "removal": (D("173.5"), "㎡", 1_727, 299_635, "after_visit", "public"),  # 합계 밖
        "waste": (None, "식", None, None, "after_visit", "none"),
    }
    assert (q.subtotal, q.vat, q.total) == (1_873_295, 187_330, 2_060_625)
    paper = next(ln for ln in q.lines if ln.key == "paper")
    assert paper.name == "실크벽지 시장 평균 가격" and "paper-market-2026.11" in paper.source
    assert (q.man_days, q.days) == (D("5.0"), D("2.0"))
    assert (v.pyeong, v.share, v.share_ver, v.market_ver) == (
        D("21.0"),
        None,
        None,
        "paper-market-2026.11",
    )
    assert v.qty == dobae.QtyV3(D("21.0"), D("63.0"), D("5.0"))
    assert FORMULA_VERSION == "2026.11.2"


def test_old_engine_number_changes_only_by_the_paper_line():
    """옛 엔진(9판 그림 9,500원/평)이면 1,974,069원. 도배지 줄 하나만 바뀐다(리드 확인 +86,556원)."""
    q = std(C07).quote
    paper = next(ln for ln in q.lines if ln.key == "paper")
    supply_9500 = q.subtotal - paper.amount + won(paper.qty * 9_500)
    assert supply_9500 + won(D(supply_9500) * D("0.1")) == 1_974_069
    assert q.total - 1_974_069 == 86_556


def test_rounding_happens_once_per_amount():
    """줄 금액 = won(수량 × 단가), 부가세 = won(공급가 × 10%) 한 번씩만. C07 부가세 187,329.5 → 187,330"""
    q = std(C07).quote
    for ln in q.lines:
        if ln.amount is not None and ln.qty is not None:
            assert ln.amount == won(ln.qty * ln.unit_price), ln.key
    supply = sum(ln.amount for ln in q.lines if ln.state in COUNTED and ln.amount is not None)
    assert supply == q.subtotal and D(supply) * D("0.1") == D("187329.5")
    assert q.vat == 187_330 and q.total == q.subtotal + q.vat


def test_economy_paper_uses_hapji_market_average():
    q = std(replace(C07, grade="economy")).quote
    paper = next(ln for ln in q.lines if ln.key == "paper")
    assert (paper.name, paper.qty, paper.unit_price, paper.amount, paper.basis) == (
        "합지벽지 시장 평균 가격",
        D("63.0"),
        4_577,
        288_351,
        "market",
    )
    assert (q.subtotal, q.vat, q.total) == (1_484_459, 148_446, 1_632_905)


def test_exclusive_area_uses_basis_factor():
    """전용 59㎡: 도배 면적 = 59 × 3.0(전용 기준) = 177.0㎡, 내 집 평 = 59 × 1.2 ÷ 3.3058 = 21.4"""
    v = std(dobae.HomeV3(D("59"), "exclusive", "basic", False))
    q = v.quote
    r = rows(q)
    assert (r["wall"][0], r["ceiling"][0], r["paper"][0], r["primer"][0]) == (
        D("132.7"),
        D("44.3"),
        D("64.3"),  # 177.0 × 1.2 = 212.4㎡ ÷ 3.3058 = 64.25
        D("194.7"),
    )
    assert (r["wall"][3], r["ceiling"][3], r["paper"][3], r["primer"][3]) == (
        795_271,
        377_923,
        691_161,
        47_117,
    )
    assert (q.subtotal, q.vat, q.total) == (1_911_472, 191_147, 2_102_619)
    assert v.pyeong == D("21.4") and v.qty.floor_py == D("21.4")


def test_partial_living_kitchen_walls_only():
    """부분 공사: 거실 0.21 + 주방 0.11 = 0.32 몫 × 벽 130.1㎡ = 41.6㎡, 천장은 안 함"""
    v = std(
        dobae.HomeV3(
            D("69.4"), "supply", "basic", False, "partial", ("living", "kitchen"), ("wall",)
        )
    )
    q = v.quote
    r = rows(q)
    assert r["wall"] == (D("41.6"), "㎡", 5_993, 249_309, "included", "public")
    assert r["ceiling"] == (
        None,
        "㎡",
        8_531,
        None,
        "excluded",
        "public",
    )  # 고르지 않았어요 · 안 함
    assert r["paper"] == (D("15.1"), "벽지 평", 10_749, 162_310, "included", "market")
    assert r["primer"] == (D("49.9"), "㎡", 242, 12_076, "included", "public")
    assert r["removal"][:2] == (D("41.6"), "㎡")
    assert (q.subtotal, q.vat, q.total) == (423_695, 42_370, 466_065)
    assert (v.share, v.share_ver) == (D("0.32"), "space-share-2026.11")
    assert v.qty == dobae.QtyV3(D("6.7"), D("15.1"), D("1.0"))  # 21.0평 × 0.32 = 6.72
    assert q.steps[0].name == "벽지 바르기 (벽)"
    assert q.assumptions[0].startswith("부분 공사는 고른 공간의 넓이를 어림해")
    assert q.total < std(C07).quote.total


def test_partial_with_every_space_caps_at_whole_house():
    every = ("living", "kitchen", "master", "room1", "room2", "hall", "entry", "dress")
    assert share_of(every, SPACE_SHARE_2026_11) == D(1)  # 합 1.05 → 1
    v = std(dobae.HomeV3(D("69.4"), "supply", "basic", False, "partial", every))
    assert v.quote.total == std(C07).quote.total == 2_060_625
    assert v.share_ver == "space-share-2026.11"


def test_space_share_table_and_checks():
    t = SPACE_SHARE_2026_11
    assert len(t.version) <= 20  # standard_quotes.share_ver varchar(20)
    assert set(t.share) == {
        "living",
        "kitchen",
        "master",
        "room1",
        "room2",
        "hall",
        "entry",
        "dress",
    }
    assert all(D(0) < x < D(1) for x in t.share.values())
    assert share_of(["living", "living"], t) == D("0.21")  # 같은 공간은 한 번
    with pytest.raises(ValueError):
        share_of([], t)
    with pytest.raises(KeyError):
        share_of(["bath"], t)
    small = SpaceShares("t", {"living": D("0.5")}, "시험")
    assert share_of(["living"], small) == D("0.5")


def test_quote_v3_rejects_bad_input():
    p, paper = DOBAE_2026H2, paper_market("basic")
    with pytest.raises(ValueError):
        dobae.quote_v3(dobae.DobaeV3Input(D(0), "supply", "basic", False), p, paper)
    with pytest.raises(ValueError):
        dobae.quote_v3(dobae.DobaeV3Input(D("69.4"), "supply", "basic", False, ()), p, paper)
    with pytest.raises(ValueError):
        dobae.quote_v3(
            dobae.DobaeV3Input(D("69.4"), "supply", "basic", False, share=D("1.5")), p, paper
        )


def test_occupied_house_adds_labor_surcharge_and_prep_day():
    q = std(replace(C07, occupied=True)).quote
    r = rows(q)
    # 할증 = (벽 779,689 + 천장 370,245) × 노무비 0.96 × (1 ÷ 0.85 − 1)
    assert r["occupied"][3] == won(D(779_689 + 370_245) * D("0.96") * (1 / D("0.85") - 1))
    assert r["moving"][4] == "after_visit" and q.steps[0].key == "prep"
    assert q.man_days == D("5.5")  # 4.6457 ÷ 0.85 = 5.47 → 5.5


def test_old_quote_function_is_unchanged():
    """옛 quote()(v2 단가표 예시 · 다른 계산이 씀)는 도배지 ㎡ × 공공 재료비 그대로"""
    q = dobae.quote(dobae.DobaeInput(D("69.4"), "supply", "basic", True, False), DOBAE_2026H2)
    paper = next(ln for ln in q.lines if ln.key == "paper")
    assert (paper.qty, paper.unit, paper.unit_price, paper.amount) == (
        D("208.2"),
        "㎡",
        3_325,
        692_265,
    )
    # v3 줄에서 다시 센 도배지 ㎡ 소요량이 옛 줄 수량과 같다(옛 v2 업체 단가 가견적에 씀)
    assert dobae.paper_m2_from_lines(std(C07).quote.lines, DOBAE_2026H2) == D("208.2")
