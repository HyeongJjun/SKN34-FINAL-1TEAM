"""v3 반나절 계산 (calc.slots): 열린 칸 · 칸 번호(L03) · 겹침 · 희망 기간 초안 · 추천."""

from datetime import date, timedelta

import pytest

from app.calc import slots

TODAY = date(2026, 12, 1)
D = [date(2026, 12, 10) + timedelta(days=n) for n in range(7)]  # 12.10(목) ~ 12.16(수)


def test_open_halves_counts_capacity_minus_taken():
    taken = slots.taken_count([(D[0], "am"), (D[0], "am"), (D[1], "pm")])
    days = slots.open_halves(D[0], D[2], excluded=[D[2]], taken=taken, capacity=2, today=TODAY)
    assert [(x.day, x.am, x.pm) for x in days] == [(D[0], 0, 2), (D[1], 2, 1), (D[2], 0, 0)]
    assert slots.count_open(days) == 5  # D14 '칸 × 남은 수용량'
    assert not slots.is_open(days, D[0], "am") and slots.is_open(days, D[1], "pm")


def test_past_and_today_are_closed():
    days = slots.open_halves(TODAY, TODAY + timedelta(days=1), (), {}, 1, today=TODAY)
    assert [(x.am, x.pm) for x in days] == [(0, 0), (1, 1)]


def test_capacity_and_range_limits():
    with pytest.raises(ValueError):
        slots.open_halves(D[0], D[1], (), {}, 4, today=TODAY)
    with pytest.raises(ValueError):
        slots.days_between(D[1], D[0])
    with pytest.raises(ValueError):
        slots.days_between(D[0], D[0] + timedelta(days=63))


def test_free_seat_is_smallest_open_number():
    assert slots.free_seat([], 2) == 1
    assert slots.free_seat([1], 2) == 2
    assert slots.free_seat([2], 2) == 1
    assert slots.free_seat([1, 2], 2) is None  # 다 차면 409 slot_taken
    assert slots.free_seat([1, 2], 3) == 3


def test_overlap():
    assert slots.overlaps(D[0], D[2], D[2], D[4])
    assert not slots.overlaps(D[0], D[1], D[2], D[4])


def test_draft_wish_is_minus_28_to_minus_14():
    start = date(2027, 1, 4)
    assert slots.draft_wish(start, TODAY) == (date(2026, 12, 7), date(2026, 12, 21))
    assert slots.draft_wish(None, TODAY) is None
    # 희망일이 가까우면 내일부터, 끝이 시작보다 이르면 하루
    assert slots.draft_wish(date(2026, 12, 10), TODAY) == (date(2026, 12, 2), date(2026, 12, 2))


def test_recommend_closest_to_minus_20_am_first():
    work_start = date(2027, 1, 4)  # − 20일 = 12.15(화)
    days = slots.open_halves(D[0], D[6], (), {(D[5], "am"): 2}, 2, today=TODAY)
    pick = slots.recommend(work_start, days)
    assert pick == slots.Pick(D[5], "pm", date(2026, 12, 15), "start_minus_20")
    full = slots.open_halves(D[0], D[0], (), {(D[0], "am"): 2, (D[0], "pm"): 2}, 2, today=TODAY)
    assert slots.recommend(work_start, full) is None
    early = slots.recommend(None, days)
    assert (early.day, early.half, early.basis) == (D[0], "am", "earliest")
