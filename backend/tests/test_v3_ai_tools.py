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
