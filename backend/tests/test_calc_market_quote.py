"""도배 · 목공 표준견적서 (업체 견적 235건 시장 단가)."""

from decimal import Decimal

import pytest

from app.calc import market_quote as mq
from app.v2.service import MARKET_BOOK


def _q(**kw) -> mq.Quote:
    return mq.build(
        mq.Input(Decimal(kw.pop("py", 32)), kw.pop("rooms", 3), kw.pop("baths", 2), **kw),
        MARKET_BOOK,
    )


def test_dobae_lines_follow_market_coefficients():
    d = _q(mokgong=False).trades[0]
    by = {ln.item: ln for ln in d.lines}
    paper = by["1203-comfort"]  # 실크 15,000원/평
    assert (paper.qty, paper.unit_price, paper.amount) == (Decimal(107), 15_000, 1_605_000)
    assert paper.qty_why.startswith("벽 + 천장 32평 × 3.33 = 107평")
    labor = by["1206"]  # 도배공 업체 중앙값 30만 원 × 32 × 0.208 → 7품
    assert (labor.qty, labor.unit_price, labor.kind) == (Decimal(7), 300_000, "labor")
    assert "235건 중 235건" in labor.price_why
    hapji = _q(mokgong=False, wallpaper="hapji").trades[0]
    assert hapji.total < d.total


def test_totals_follow_template_rates():
    q = _q()
    assert q.net == sum(t.total for t in q.trades) == q.material + q.labor + q.expense
    assert [o.amount for o in q.overheads] == [mq.won(Decimal(q.net) * r) for _k, _n, r in mq.RATES]
    before = q.net + sum(o.amount for o in q.overheads)
    assert q.supply == before + q.cut and q.supply % 10_000 == 0 and -10_000 < q.cut <= 0
    assert q.total == q.supply + q.vat
    assert q.doors == 5


def test_options_default_and_delta():
    q = _q()
    on = {o.key for o in q.options if o.on}
    assert (
        on
        == {o.key for o in q.options if o.common}
        == {"doors", "jungmun", "entry_hw", "board", "insulation"}
    )
    doors = next(o for o in q.options if o.key == "doors")
    without = _q(options=frozenset(on - {"doors"}))
    assert doors.delta == without.total - q.total < 0
    bath = next(o for o in q.options if o.key == "bath_board")
    assert bath.delta == _q(options=frozenset(on | {"bath_board"})).total - q.total > 0
    # 중문 종류를 바꾸면 그 줄만 바뀐다
    swing = _q(jungmun="swing")
    jm = lambda x: next(ln for t in x.trades for ln in t.lines if ln.group == "jungmun")
    assert jm(swing).unit_price > jm(q).unit_price


def test_inputs_rejected():
    with pytest.raises(ValueError):
        _q(dobae=False, mokgong=False)
    with pytest.raises(ValueError):
        _q(options=frozenset({"sauna"}))
    with pytest.raises(ValueError):
        _q(py=0)
    assert mq.pyeong_from_m2(Decimal(84), Decimal("1.2")) == Decimal("30.5")
    assert mq.default_rooms(Decimal(45)) == (4, 2)
