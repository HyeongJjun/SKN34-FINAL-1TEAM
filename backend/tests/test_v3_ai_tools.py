"""AI 칸 도구: 날짜 고르기 화면 값(pick_view) → 실측 초안 재료. 날짜는 계산 엔진 값 그대로 옮긴다 (DB 없음)."""

from datetime import date
from types import SimpleNamespace

from app.calc import slots
from app.chat.tools import pick_facts


def _pick(**kw):
    base = {
        "vendor_name": "마루와벽",
        "work_wish_on": date(2027, 1, 4),
        "window": SimpleNamespace(start=date(2026, 12, 13), end=date(2026, 12, 18)),
        "recommend": SimpleNamespace(
            day=date(2026, 12, 15), half="am", target=date(2026, 12, 15), basis="start_minus_20"
        ),
    }
    base.update(kw)
    return SimpleNamespace(**base)


def test_pick_view_becomes_range_and_calc_recommend():
    got = pick_facts(_pick())
    assert got is not None
    ranges, rec, wish = got
    assert [(r.vendor, r.start, r.end) for r in ranges] == [
        ("마루와벽", date(2026, 12, 13), date(2026, 12, 18))
    ]
    assert (rec.vendor, rec.day, rec.half, wish) == (
        "마루와벽",
        date(2026, 12, 15),
        "am",
        date(2027, 1, 4),
    )
    assert rec.basis == f"1.4(월) − {slots.RECOMMEND_BEFORE_DAYS}일 = 12.15(화)"


def test_earliest_pick_has_no_made_up_formula():
    got = pick_facts(
        _pick(
            work_wish_on=None,
            recommend=SimpleNamespace(
                day=date(2026, 12, 13), half="pm", target=date(2026, 12, 13), basis="earliest"
            ),
        )
    )
    assert got is not None
    assert not any(ch.isdigit() for ch in got[1].basis)


def test_no_vendor_answer_means_no_recommend():
    assert pick_facts(_pick(window=None)) is None
    assert pick_facts(_pick(recommend=None)) is None


# ---- 표준견적서: 화면과 AI 칸이 같은 시장 단가 견적을 쓴다 (PR #164 리뷰) ----
def _st(scope="full", grade="basic", trades=("dobae",)):
    from decimal import Decimal

    return SimpleNamespace(
        scope=scope,
        area_m2=Decimal("69.4"),
        area_basis="supply",
        trades=[SimpleNamespace(trade=t, grade=grade) for t in trades],
    )


def test_ai_standard_equals_screen_market_quote():
    from decimal import Decimal

    from app.chat.tools import market_facts
    from app.quote.service import market_of
    from app.v2 import schemas as v2
    from app.v2.service import market

    q, _ = market_of(_st())
    # 화면이 예전에 보내던 손님 계산 입력(toMarketIn)과 같은 값
    screen = market(
        v2.V2MqIn(area_m2=Decimal("69.4"), area_basis="supply", dobae=True, mokgong=False)
    )
    facts = market_facts(q)
    assert facts.total == q.total == screen.total == 4_070_000
    assert (facts.supply, facts.vat) == (screen.supply, screen.vat)
    assert sum(ln.amount or 0 for ln in facts.lines) == facts.supply
    assert facts.basis == "market"  # AI가 공공 기준이라고 말하지 않게


def test_market_only_for_full_dobae():
    from app.quote.service import market_of

    assert market_of(_st(scope="partial")) is None
    assert market_of(_st(trades=("mokgong",))) is None
    assert market_of(_st(scope=None)) is not None  # v2 공사는 전체로 본다
    silk = market_of(_st(grade="basic"))[0].total
    assert market_of(_st(grade="economy"))[0].total < silk
