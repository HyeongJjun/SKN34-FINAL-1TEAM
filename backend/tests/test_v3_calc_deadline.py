"""v3 기한 계산 (calc.deadline): 48시간 · 7일 · N일 18:00 · 실측 시각 지남(L09) · 지남 판정."""

from datetime import UTC, date, datetime, time, timedelta

import pytest

from app.calc import deadline as dl
from app.shared.clock import SEOUL

SENT = datetime(2026, 12, 1, 22, 30, tzinfo=SEOUL)  # 서울 밤 10시 반에 보냄


def test_hour_based_deadlines_add_exact_hours():
    assert dl.reply_due(SENT) == SENT + timedelta(hours=48)
    assert dl.accept_due(SENT) == SENT + timedelta(hours=48)
    assert dl.proposal_due(SENT) == SENT + timedelta(hours=48)
    assert dl.change_due(SENT) == SENT + timedelta(hours=48)
    assert dl.date_request_due(SENT) == SENT + timedelta(hours=48)
    assert dl.pick_due(SENT) == SENT + timedelta(days=7)
    # UTC로 받아도 같은 순간
    utc = SENT.astimezone(UTC)
    assert dl.reply_due(utc) == dl.reply_due(SENT)


def test_day_based_deadlines_are_seoul_18():
    visit_day = date(2026, 12, 15)
    assert dl.quote_due(visit_day) == datetime(2026, 12, 18, 18, 0, tzinfo=SEOUL)
    assert dl.reminder_at(visit_day) == datetime(2026, 12, 14, 18, 0, tzinfo=SEOUL)
    # 확정 + 2일 18:00: 서울 날짜 기준 (UTC로는 전날이어도)
    confirmed = datetime(2026, 12, 1, 16, 0, tzinfo=UTC)  # 서울 12.2 01:00
    assert dl.dates_due(confirmed) == datetime(2026, 12, 4, 18, 0, tzinfo=SEOUL)
    assert dl.valid_soon_at(date(2026, 12, 31)) == [
        datetime(2026, 12, 28, 18, 0, tzinfo=SEOUL),
        datetime(2026, 12, 30, 18, 0, tzinfo=SEOUL),
    ]


def test_auto_done_and_reminder_follow_d24():
    posted = datetime(2026, 12, 20, 10, 0, tzinfo=SEOUL)
    assert dl.done_remind_at(posted) == posted + timedelta(days=4)
    assert dl.auto_done_at(posted) == posted + timedelta(days=7)
    assert dl.auto_done_at(posted) - dl.done_remind_at(posted) == timedelta(days=3)


def test_half_end_l09_and_visited_ok():
    day = date(2026, 12, 15)
    assert dl.HALF_END == {"am": time(13, 0), "pm": time(18, 0)}
    assert dl.half_end(day, "am") == datetime(2026, 12, 15, 13, 0, tzinfo=SEOUL)
    assert dl.half_end(day, "pm") == datetime(2026, 12, 15, 18, 0, tzinfo=SEOUL)
    before = datetime(2026, 12, 15, 12, 59, tzinfo=SEOUL)
    at = datetime(2026, 12, 15, 13, 0, tzinfo=SEOUL)
    assert not dl.visited_ok(before, day, "am") and dl.visited_ok(at, day, "am")
    assert not dl.visited_ok(at, day, "pm")


def test_is_over_and_soon():
    due = datetime(2026, 12, 3, 22, 30, tzinfo=SEOUL)
    assert not dl.is_over(due - timedelta(seconds=1), due)
    assert dl.is_over(due, due)  # 같은 시각이면 지남
    assert not dl.is_over(due, None)
    assert dl.is_soon(due - timedelta(hours=11), due)
    assert not dl.is_soon(due - timedelta(hours=13), due)
    assert not dl.is_soon(due, due)  # 지났으면 '곧'이 아니다


def test_d12_minimum_handling_is_release_hold():
    assert dl.AFTER_ACCEPT_DUE == dl.AFTER_PROPOSAL_DUE == "release_hold"  # L10


def test_naive_datetimes_are_rejected():
    with pytest.raises(ValueError):
        dl.reply_due(datetime(2026, 12, 1, 9, 0))
    with pytest.raises(ValueError):
        dl.is_over(datetime(2026, 12, 1, 9, 0), SENT)
