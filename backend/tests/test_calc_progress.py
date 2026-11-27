"""진행 단계 · 지금 할 일 판정 (계산 엔진, 오늘 · 지금 시각 인자)."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.calc.progress import STEPS, TradeFacts, first_todo, progress, project_phase

TODAY = date(2026, 11, 8)
NOW = datetime(2026, 11, 8, 3, 0, tzinfo=UTC)  # 서울 11.08 12:00
BASE = TradeFacts(
    trade="dobae",
    created_on=date(2026, 11, 2),
    standard_on=date(2026, 11, 2),
    asked=0,
    asked_on=None,
    quotes=0,
    waiting=0,
    quoted_on=None,
)


def at(**over) -> TradeFacts:
    return TradeFacts(**{**BASE.__dict__, **over})


def states(p) -> list[str]:
    return [s.state for s in p.steps]


def test_before_any_request_is_estimate_and_pick():
    p = progress(BASE, TODAY, NOW)
    assert (p.phase, p.current, p.todo) == ("estimate", 3, "pick")
    assert states(p) == ["done", "done", "now"] + ["todo"] * 5
    assert p.steps[0].on == date(2026, 11, 2) and p.steps[3].on is None


def test_requests_then_quotes():
    asked = at(asked=2, asked_on=date(2026, 11, 2), waiting=2)
    p = progress(asked, TODAY, NOW)
    assert (p.phase, p.current, p.todo, p.steps[2].count) == ("progress", 4, "visit_requested", 2)
    part = at(asked=2, asked_on=date(2026, 11, 2), quotes=1, waiting=1, quoted_on=date(2026, 11, 6))
    assert progress(part, TODAY, NOW).todo == "quotes_partial"
    full = at(asked=2, asked_on=date(2026, 11, 2), quotes=2, quoted_on=date(2026, 11, 7))
    p = progress(full, TODAY, NOW)
    assert (p.todo, p.current, p.steps[3].count) == (
        "quotes_arrived",
        5,
        2,
    )  # 견적서가 오면 비교 칸


def confirmed(**over) -> TradeFacts:
    base = {
        "asked": 2,
        "asked_on": date(2026, 11, 2),
        "quotes": 2,
        "quoted_on": date(2026, 11, 7),
        "deal_status": "confirmed",
        "deal_on": date(2026, 11, 8),
        "dates_due_at": datetime(2026, 11, 10, 9, 0, tzinfo=UTC),  # 서울 11.10 18:00
    }
    return at(**{**base, **over})


def test_dates_waiting_received_requested_and_overdue():
    p = progress(confirmed(), TODAY, NOW)
    assert (p.current, p.todo, p.overdue) == (6, "dates_waiting", False)
    assert states(p) == ["done"] * 5 + ["now", "todo", "todo"]
    late = NOW.replace(day=10, hour=10)  # 기한 지남 (상태가 아님)
    p = progress(confirmed(), TODAY, late)
    assert (p.todo, p.overdue) == ("dates_overdue", True)
    got = progress(confirmed(proposed=True, proposed_on=TODAY), TODAY, late)
    assert (got.todo, got.overdue, got.steps[5].on) == ("dates_received", False, TODAY)
    asked = progress(confirmed(proposed=True, request_open=True), TODAY, late)
    assert asked.todo == "dates_requested"


def scheduled(**over) -> TradeFacts:
    return confirmed(
        **{
            "accepted_on": date(2026, 11, 8),
            "start": date(2026, 11, 19),
            "end": date(2026, 11, 23),
            **over,
        }
    )


def test_after_dates_are_accepted():
    s = scheduled(deal_status="scheduled")
    p = progress(s, TODAY, NOW)
    assert (p.phase, p.current, p.todo) == ("work", 6, "before_work")  # 시작일 전은 일정(준비) 칸
    assert states(p) == ["done"] * 5 + ["now", "todo", "todo"] and p.steps[5].on == date(
        2026, 11, 8
    )
    assert progress(s, date(2026, 11, 20), NOW).current == 7  # 시작일부터 공사 칸
    assert progress(s, date(2026, 11, 20), NOW).todo == "working"
    assert (
        progress(scheduled(deal_status="scheduled", extras_pending=1), TODAY, NOW).todo == "extra"
    )
    change = scheduled(deal_status="scheduled", proposed=True)
    assert progress(change, TODAY, NOW).todo == "dates_change"
    assert progress(scheduled(deal_status="checking"), TODAY, NOW).todo == "check"
    assert progress(scheduled(deal_status="fixing"), TODAY, NOW).todo == "fixing"
    done = progress(scheduled(deal_status="done"), TODAY, NOW)
    assert (done.phase, done.todo) == ("done", "done")
    assert (done.current, states(done)) == (8, ["done"] * 8)


def test_eight_steps_follow_the_board():
    """재재 보드 8칸(집 · 견적 · 업체 · 실측 · 비교 · 일정 · 공사 · 완료)과 같은 칸이 '지금'이에요(#203)"""
    assert [st.key for st in progress(at(), TODAY, NOW).steps] == list(STEPS)
    cases = [
        (at(), 3),  # 업체 고르기 전
        (at(asked=1, asked_on=date(2026, 11, 2), waiting=1), 4),  # 실측 요청함
        (at(asked=1, asked_on=date(2026, 11, 2), quotes=1, quoted_on=date(2026, 11, 6)), 5),
        (confirmed(), 6),  # 업체 확정 · 공사 날짜 기다림
        (scheduled(deal_status="scheduled"), 6),  # 날짜 수락 · 공사 시작 전(준비)
        (scheduled(deal_status="checking"), 8),  # 끝냄 확인
        (scheduled(deal_status="fixing"), 8),  # 남은 일 손보는 중
        (scheduled(deal_status="done"), 8),
    ]
    for facts, want in cases:
        p = progress(facts, TODAY, NOW)
        assert p.current == want, (facts.deal_status, p.current)
        assert sum(st.state == "now" for st in p.steps) == (0 if facts.deal_status == "done" else 1)


def test_project_phase_and_first_todo():
    mok = progress(scheduled(trade="mokgong", deal_status="done"), TODAY, NOW)
    dob = progress(confirmed(proposed=True), TODAY, NOW)
    assert project_phase([mok, dob]) == "progress"
    assert first_todo([mok, dob]).trade == "dobae"  # 날짜 확인이 끝남보다 먼저
    assert project_phase([mok]) == "done"
    work = progress(scheduled(deal_status="scheduled"), TODAY, NOW)
    assert project_phase([mok, work]) == "work"
    assert project_phase([progress(BASE, TODAY, NOW)]) == "estimate"
    assert project_phase([]) == "estimate" and first_todo([]) is None
    with pytest.raises(ValueError):
        progress(BASE, TODAY, NOW.replace(tzinfo=None) + timedelta(0))
