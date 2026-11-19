"""공휴일 목록(refprice/holidays.py)이 공식 발표와 맞는지 확인해요(B6).

공식: 관공서의 공휴일에 관한 규정(2026-04-28 개정, 노동절 · 제헌절) · 우주항공청 2027년도 월력요항.
목록 · 출처는 data/v3/holidays/holidays_2026_2027.csv에 있어요. 여기서는 평일 공휴일만 봐요(주말은 calc가 쉬어요).
"""

from datetime import date, timedelta

from app.calc.schedule import WEEKEND, is_off, workdays
from app.refprice import v2_ref
from app.refprice.holidays import HOLIDAYS, LAST_YEAR, days_off

# 공식 평일 공휴일(월~금). 2026-09-26(토, 추석 연휴)은 저장소가 이미 적어 둔 주말 날이라 따로 봐요
OFFICIAL_WEEKDAYS = {
    2026: {
        date(2026, 1, 1), date(2026, 2, 16), date(2026, 2, 17), date(2026, 2, 18), date(2026, 3, 2),
        date(2026, 5, 1), date(2026, 5, 5), date(2026, 5, 25), date(2026, 6, 3), date(2026, 7, 17),
        date(2026, 8, 17), date(2026, 9, 24), date(2026, 9, 25), date(2026, 10, 5), date(2026, 10, 9),
        date(2026, 12, 25),
    },
    2027: {
        date(2027, 1, 1), date(2027, 2, 8), date(2027, 2, 9), date(2027, 3, 1), date(2027, 5, 3),
        date(2027, 5, 5), date(2027, 5, 13), date(2027, 7, 19), date(2027, 8, 16), date(2027, 9, 14),
        date(2027, 9, 15), date(2027, 9, 16), date(2027, 10, 4), date(2027, 10, 11), date(2027, 12, 27),
    },
}  # fmt: skip


def test_labor_day_and_constitution_day_are_in_the_list():
    assert HOLIDAYS[date(2026, 5, 1)] == "노동절"
    assert HOLIDAYS[date(2026, 7, 17)] == "제헌절"
    assert HOLIDAYS[date(2027, 5, 3)] == "노동절 대체공휴일"
    assert HOLIDAYS[date(2027, 7, 19)] == "제헌절 대체공휴일"


def test_weekday_holidays_match_official_list_exactly():
    for year, official in OFFICIAL_WEEKDAYS.items():
        ours = {d for d in HOLIDAYS if d.year == year and d.weekday() < 5}
        assert ours == official, year
        assert all(d.weekday() < 5 for d in official)
    weekend_days = {d for d in HOLIDAYS if d.weekday() >= 5}
    assert weekend_days == {date(2026, 9, 26)}  # 추석 연휴(토). 넣어 둬도 계산은 같아요
    assert max(HOLIDAYS).year == LAST_YEAR == 2027


def test_days_off_and_workdays_skip_the_new_days():
    assert days_off(date(2027, 5, 1), date(2027, 5, 31)) == {
        date(2027, 5, 3),
        date(2027, 5, 5),
        date(2027, 5, 13),
    }
    off = days_off(date(2027, 7, 1), date(2027, 7, 31))
    assert is_off(date(2027, 7, 19), off, WEEKEND)
    # 7.16(금) 다음 일하는 날은 7.20(화): 17 · 18 주말, 19 제헌절 대체공휴일
    assert workdays(date(2027, 7, 16), 2, off) == [date(2027, 7, 16), date(2027, 7, 20)]
    may = days_off(date(2026, 4, 27), date(2026, 5, 8))
    assert workdays(date(2026, 4, 30), 2, may) == [date(2026, 4, 30), date(2026, 5, 4)]


def test_v2_screen_list_and_schedule_list_are_the_same():
    assert v2_ref.HOLIDAYS_EXTRA == {}
    merged = {**HOLIDAYS, **v2_ref.HOLIDAYS_EXTRA}
    assert merged == HOLIDAYS
    span = days_off(date(2026, 1, 1), date(2027, 12, 31))
    assert span == frozenset(HOLIDAYS)
    # 공정표가 400일 앞까지 쉬는 날을 보는 방식(schedule.service)으로도 새 날이 들어가요
    ahead = days_off(date(2026, 11, 18), date(2026, 11, 18) + timedelta(days=400))
    assert {date(2027, 5, 3), date(2027, 7, 19)} <= ahead
