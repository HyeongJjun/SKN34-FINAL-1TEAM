"""공정표 날짜 계산. 기대값은 시안 예시 집(상계동 32평, 도배 기본형 + 목공 몰딩 · 걸레받이)이다."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.calc import dobae, mokgong
from app.calc.common import Step
from app.calc.schedule import (
    SEOUL,
    Dated,
    TradePlan,
    contact_until,
    count_workdays,
    days_since,
    due_at,
    fix_plan,
    free_range,
    lay_out,
    order_conflicts,
    start_choices,
    trade_days,
    workdays,
    years_since,
)
from app.refprice.book import DOBAE_2026H2 as D
from app.refprice.book import MOKGONG_2026H2 as M
from app.refprice.holidays import days_off


def example():
    d = dobae.quote(dobae.DobaeInput(Decimal("105.8"), "supply", "basic", True, False), D)
    m = mokgong.quote(
        mokgong.MokgongInput(Decimal("105.8"), "supply", ("molding", "base"), False), M
    )
    return [TradePlan("mokgong", m.steps, M.crew), TradePlan("dobae", d.steps, D.crew)]


def test_trade_days_round_half_days_up_to_whole_days():
    assert trade_days([Step("paper", "벽지", 4), Step("finish", "마감", 1)]) == 3
    assert trade_days([Step("a", "a", 2)]) == 1
    with pytest.raises(ValueError):
        trade_days([Step("a", "a", 0)])


def test_example_house_matches_the_plan():
    start = date(2026, 11, 16)
    plan = lay_out(example(), start, days_off(start, date(2026, 12, 31)))
    work = [(b.trade, b.start, b.end, b.days) for b in plan.blocks if b.kind == "work"]
    assert work == [
        ("mokgong", date(2026, 11, 16), date(2026, 11, 18), 3),
        ("dobae", date(2026, 11, 19), date(2026, 11, 23), 3),  # 21 · 22 주말은 건너뛴다
    ]
    dry, clean = plan.blocks[2], plan.blocks[3]
    assert (dry.kind, dry.start, dry.end) == ("dry", date(2026, 11, 24), date(2026, 11, 25))
    assert (clean.kind, clean.start) == ("clean", date(2026, 11, 26))
    assert plan.work_days == 6 and (plan.start, plan.end) == (start, date(2026, 11, 26))
    by_day = {t.day: t for t in plan.days}
    assert by_day[date(2026, 11, 21)].kind == "off"
    assert by_day[date(2026, 11, 23)].names == ("마감 · 확인 · 청소",)
    assert len(plan.days) == 11


def test_fixed_dates_place_blocks_and_push_dry_and_clean():
    off = days_off(date(2026, 11, 1), date(2026, 12, 31))
    # 목공만 수락(11.16~11.18), 도배는 날짜 없음 → 목공 다음 일하는 날부터 계산한 기간
    plan = fix_plan(
        example(), {"mokgong": (date(2026, 11, 16), date(2026, 11, 18))}, date(2026, 11, 2), off
    )
    work = [(b.trade, b.start, b.end, b.days) for b in plan.blocks if b.kind == "work"]
    assert work == [
        ("mokgong", date(2026, 11, 16), date(2026, 11, 18), 3),
        ("dobae", date(2026, 11, 19), date(2026, 11, 23), 3),
    ]
    assert plan == lay_out(example(), date(2026, 11, 16), off)  # 계산한 자리와 같으면 같은 공정표
    # 도배를 11.24(화) ~ 11.26(목)으로 바꾸면 건조 · 청소가 같이 밀린다
    moved = fix_plan(
        example(),
        {
            "mokgong": (date(2026, 11, 16), date(2026, 11, 18)),
            "dobae": (date(2026, 11, 24), date(2026, 11, 26)),
        },
        date(2026, 11, 2),
        off,
    )
    by = {b.kind if b.trade is None else b.trade: b for b in moved.blocks}
    assert (by["dobae"].start, by["dobae"].end, by["dobae"].days) == (
        date(2026, 11, 24),
        date(2026, 11, 26),
        3,
    )
    assert (by["dry"].start, by["dry"].end) == (date(2026, 11, 27), date(2026, 11, 28))
    assert (by["clean"].start, moved.end) == (date(2026, 11, 29), date(2026, 11, 29))
    days = {t.day: t for t in moved.days}
    assert days[date(2026, 11, 19)].kind == "off"  # 목공 · 도배 사이 빈 날
    assert days[date(2026, 11, 26)].names == ("마감 · 확인 · 청소",)
    assert moved.work_days == 6


def test_fixed_range_longer_or_shorter_than_the_steps():
    steps = [Step("paper", "바르기", 3), Step("finish", "마감", 1)]  # 반나절 4개 = 2일
    long = fix_plan(
        [TradePlan("dobae", steps, 4)],
        {"dobae": (date(2026, 11, 16), date(2026, 11, 19))},
        date(2026, 11, 16),
    )
    names = [t.names for t in long.days if t.kind == "work"]
    assert names == [("바르기",), ("바르기",), ("바르기",), ("마감",)]  # 4일에 나눠 놓는다
    short = fix_plan(
        [TradePlan("dobae", steps, 4)],
        {"dobae": (date(2026, 11, 16), date(2026, 11, 16))},
        date(2026, 11, 16),
    )
    assert [t.names for t in short.days if t.kind == "work"] == [("바르기", "마감")]
    with pytest.raises(ValueError):  # 주말뿐인 날짜
        fix_plan(
            [TradePlan("dobae", steps, 4)],
            {"dobae": (date(2026, 11, 21), date(2026, 11, 22))},
            date(2026, 11, 16),
        )


def test_next_trade_starts_after_a_holiday():
    # 추석 연휴(9.24~26)와 주말을 건너뛴다
    start = date(2026, 9, 22)
    plan = lay_out(example(), start, days_off(start, date(2026, 10, 31)))
    mok, dob = plan.blocks[0], plan.blocks[1]
    assert (mok.start, mok.end) == (date(2026, 9, 22), date(2026, 9, 28))
    assert dob.start == date(2026, 9, 29)


def test_prep_is_kept_once_and_weekend_work_is_allowed():
    occupied = [Step("prep", "짐 정리", 1), Step("work", "작업", 2)]
    plan = lay_out(
        [TradePlan("mokgong", occupied, 2), TradePlan("dobae", occupied, 4)],
        date(2026, 11, 21),
        weekend=(),
    )
    names = [n for t in plan.days for n in t.names]
    assert names.count("짐 정리") == 1
    assert plan.blocks[0].start == date(2026, 11, 21)  # 토요일에도 일한다


def test_workdays_and_count_skip_weekends_and_days_off():
    assert workdays(date(2026, 11, 20), 2) == [date(2026, 11, 20), date(2026, 11, 23)]
    assert count_workdays(date(2026, 11, 19), date(2026, 11, 23)) == 3
    assert (
        count_workdays(
            date(2026, 9, 21), date(2026, 9, 28), days_off(date(2026, 9, 1), date(2026, 9, 30))
        )
        == 4
    )
    with pytest.raises(ValueError):
        count_workdays(date(2026, 11, 23), date(2026, 11, 19))
    with pytest.raises(ValueError):
        workdays(date(2026, 11, 20), 1, weekend=range(7))


def test_order_conflicts_when_later_trade_starts_too_early():
    ok = [
        Dated("mokgong", date(2026, 11, 16), date(2026, 11, 18)),
        Dated("dobae", date(2026, 11, 19), date(2026, 11, 23)),
    ]
    assert order_conflicts(ok, ("mokgong", "dobae")) == []
    bad = [ok[0], Dated("dobae", date(2026, 11, 18), date(2026, 11, 20))]
    assert order_conflicts(bad, ("mokgong", "dobae")) == [("mokgong", "dobae")]


def test_free_range_is_between_the_trades_before_and_after():
    order = ("mokgong", "dobae")
    mok = Dated("mokgong", date(2026, 11, 16), date(2026, 11, 18))
    me = Dated("dobae", date(2026, 11, 18), date(2026, 11, 20))
    assert free_range("dobae", [me, mok], order) == (date(2026, 11, 19), None)
    # 목공이 금요일에 끝나면 도배는 주말을 건너 월요일부터
    fri = Dated("mokgong", date(2026, 11, 18), date(2026, 11, 20))
    assert free_range("dobae", [fri], order) == (date(2026, 11, 23), None)
    # 뒤 공정(도배)이 월요일에 시작하면 목공은 그 전 금요일까지
    dob = Dated("dobae", date(2026, 11, 23), date(2026, 11, 25))
    assert free_range("mokgong", [dob], order) == (None, date(2026, 11, 20))
    # 공휴일 앞뒤: 12.25(금) 성탄절이면 12.24(목)까지
    xmas = Dated("dobae", date(2026, 12, 28), date(2026, 12, 29))
    off = days_off(date(2026, 12, 1), date(2026, 12, 31))
    assert free_range("mokgong", [xmas], order, off) == (None, date(2026, 12, 24))
    assert free_range("dobae", [], order) == (None, None)


def test_start_choices_skip_days_off_and_keep_the_length():
    off = days_off(date(2026, 11, 1), date(2026, 12, 31))
    got = start_choices(date(2026, 11, 19), 3, 3, {date(2026, 11, 19)}, off)
    # 11.19(목)은 빼고 11.20(금) · 11.23(월) · 11.24(화), 3일씩 일하면 끝나는 날
    assert got == [
        (date(2026, 11, 20), date(2026, 11, 24)),
        (date(2026, 11, 23), date(2026, 11, 25)),
        (date(2026, 11, 24), date(2026, 11, 26)),
    ]
    assert start_choices(date(2026, 12, 24), 1, 1, (), off) == [
        (date(2026, 12, 24), date(2026, 12, 24))
    ]
    assert start_choices(date(2026, 12, 25), 2, 1, (), off) == [
        (date(2026, 12, 28), date(2026, 12, 29))
    ]  # 성탄절 · 주말을 건너뛴다
    with pytest.raises(ValueError):
        start_choices(date(2026, 11, 19), 0, 1)


def test_start_choices_stop_before_the_next_trade():
    off = days_off(date(2026, 11, 1), date(2026, 12, 31))
    # 도배가 11.26(목)에 시작하면 3일짜리 목공은 11.25(수)까지 끝나는 시작일만
    got = start_choices(date(2026, 11, 19), 3, 5, (), off, end_by=date(2026, 11, 25))
    assert got == [
        (date(2026, 11, 19), date(2026, 11, 23)),
        (date(2026, 11, 20), date(2026, 11, 24)),
        (date(2026, 11, 23), date(2026, 11, 25)),
    ]
    assert start_choices(date(2026, 11, 24), 3, 5, (), off, end_by=date(2026, 11, 25)) == []


def test_due_at_is_calendar_days_at_18_seoul():
    # 11.08(일) 10:12 서울에 확정 → 11.10(화) 18:00
    base = datetime(2026, 11, 8, 1, 12, tzinfo=UTC)
    assert due_at(base, 2) == datetime(2026, 11, 10, 18, 0, tzinfo=SEOUL)
    # 서울 날짜로 센다: UTC 11.07 16:00은 서울 11.08 01:00
    assert due_at(datetime(2026, 11, 7, 16, 0, tzinfo=UTC), 2).date() == date(2026, 11, 10)
    with pytest.raises(ValueError):
        due_at(datetime(2026, 11, 8, 10, 0), 2)


def test_contact_until_is_one_year_later():
    assert contact_until(date(2026, 11, 23)) == date(2027, 11, 23)
    assert contact_until(date(2028, 2, 29)) == date(2029, 2, 28)


def test_days_since_counts_seoul_dates():
    today = date(2026, 11, 2)
    # 10.30(금) 18:47 서울 신청 → 11.02(월)에 3일째
    assert days_since(datetime(2026, 10, 30, 9, 47, tzinfo=UTC), today) == 3
    # UTC 10.31 15:30은 서울 11.01 00:30 → 1일째
    assert days_since(datetime(2026, 10, 31, 15, 30, tzinfo=UTC), today) == 1
    assert days_since(datetime(2026, 11, 2, 0, 0, tzinfo=SEOUL), today) == 0
    assert days_since(datetime(2026, 11, 5, 0, 0, tzinfo=SEOUL), today) == 0  # 앞날은 0
    with pytest.raises(ValueError):
        days_since(datetime(2026, 11, 1, 10, 0), today)


def test_years_since_counts_full_years():
    assert years_since(date(2014, 3, 2), date(2026, 11, 2)) == 12  # 2014.03 · 업력 12년
    assert years_since(date(2014, 11, 3), date(2026, 11, 2)) == 11  # 하루 모자람
    assert years_since(date(2014, 11, 2), date(2026, 11, 2)) == 12
    assert years_since(date(2027, 1, 1), date(2026, 11, 2)) == 0  # 앞날은 0
