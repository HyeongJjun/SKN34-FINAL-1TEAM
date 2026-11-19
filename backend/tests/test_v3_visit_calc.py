"""v3 실측 화면 계산 엔진 (calc.visit_view · calc.rating): 집 이름표(F7) · 업체 답 시간(C11) · 다른 날 제안
고를 거리(V07) · 겹치는 날 없음 까닭(C22) · 견적서 차이(C33) · 유효기간 3일 안(D20) · 별점 요약(I4)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.calc import rating, visit_view

D = date(2026, 12, 1)  # 화요일


def test_area_label_has_basis_and_one_decimal():
    assert visit_view.area_label("노원구", "상계동", Decimal("69.4"), "supply") == (
        "노원구 상계동 · 공급 69.4㎡"
    )
    assert visit_view.area_label("노원구", "상계동", Decimal("59.94"), "exclusive") == (
        "노원구 상계동 · 전용 59.9㎡"
    )
    assert visit_view.area_label("노원구", None, 70, "supply") == "노원구 · 공급 70.0㎡"
    assert (
        visit_view.area_label("노원구", "상계동", None, None) == "노원구 상계동"
    )  # 평형만 고른 집
    assert visit_view.area_text("69.45") == "69.5㎡"  # 기준을 모르면 숫자만, 반올림
    for bad in ((Decimal(0), None), (Decimal(10), "pyeong")):
        with pytest.raises(ValueError):
            visit_view.area_text(*bad)


def test_reply_hours_is_the_middle_rounded_up():
    h = timedelta(hours=1)
    assert visit_view.reply_hours([]) is None
    assert visit_view.reply_hours([timedelta(minutes=5)]) == 1  # 1시간보다 짧아도 1
    assert visit_view.reply_hours([2 * h, 30 * h, 5 * h]) == 5  # 가운데 값
    assert (
        visit_view.reply_hours([2 * h, 5 * h + timedelta(minutes=1)]) == 4
    )  # 짝수면 두 값의 가운데
    with pytest.raises(ValueError):
        visit_view.reply_hours([-h])


def test_propose_options_inside_wish_with_free_seats():
    taken = {(D + timedelta(days=1), "am"): 2, (D + timedelta(days=2), "pm"): 1}
    got = visit_view.propose_options(
        D, D + timedelta(days=2), taken, 2, today=D, skip=[(D + timedelta(days=2), "am")]
    )
    # 오늘(서울)은 빼고, 1일 오전은 2칸 다 참, 2일 오전은 고객이 고른 반나절이라 뺌
    assert got == [(D + timedelta(days=1), "pm"), (D + timedelta(days=2), "pm")]


def test_no_overlap_reasons():
    wish = (D, D + timedelta(days=6))
    work = D + timedelta(days=20)
    late = (D + timedelta(days=10), D + timedelta(days=12))
    assert visit_view.no_overlap_reason(*wish, work, *late, 0) == "after_wish"
    after = (work + timedelta(days=1), work + timedelta(days=5))
    assert visit_view.no_overlap_reason(*wish, work, *after, 10) == "after_work_start"  # C22 예
    early = (D - timedelta(days=9), D - timedelta(days=1))
    assert visit_view.no_overlap_reason(*wish, None, *early, 10) == "before_wish"
    assert visit_view.no_overlap_reason(*wish, work, D, D + timedelta(days=3), 0) == "full"
    assert visit_view.no_overlap_reason(*wish, work, D, D + timedelta(days=3), 4) is None


def test_quote_gap_diff_and_valid_soon():
    assert visit_view.quote_gap([3_080_000, 3_487_000]) == 407_000  # '두 곳이 40만 7,000원 차이'
    assert visit_view.quote_gap([3_080_000, 2_990_000, 3_487_000]) == 497_000
    assert visit_view.quote_gap([3_080_000]) is None
    assert visit_view.quote_vs_estimate(3_080_000, 3_132_800) == -52_800
    assert visit_view.valid_soon(D + timedelta(days=3), D) is True
    assert visit_view.valid_soon(D + timedelta(days=4), D) is False
    assert visit_view.valid_soon(D - timedelta(days=1), D) is False  # 지난 것은 '곧'이 아니다
    with pytest.raises(ValueError):
        visit_view.quote_gap([-1, 3])


def test_rating_summary_rules():
    assert rating.average(0, 0) is None
    assert rating.average(9, 2) == Decimal("4.5")
    assert rating.average(14, 3) == Decimal("4.7")  # 4.666… → 소수 한 자리 반올림
    assert rating.tag_counts({"kind": 2, "zzz": 9}) == {
        "seam": 0,
        "on_time": 0,
        "kind": 2,
        "tidy": 0,
    }
    x = rating.summary(9, 2, 1, {"seam": 1})
    assert (x.avg, x.count, x.done_count, x.tags["seam"]) == (Decimal("4.5"), 2, 1, 1)
    for bad in ((-1, 1, 0), (6, 1, 0), (5, 2, -1)):  # 별점 1~5를 벗어난 합 · 음수
        with pytest.raises(ValueError):
            rating.summary(*bad)
