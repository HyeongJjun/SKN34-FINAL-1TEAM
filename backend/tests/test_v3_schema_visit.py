"""v3 실측 일정 제약 (data-model.md 8장, alembic check가 못 보는 CHECK · 부분 UNIQUE).

shortlists · visits(새 상태 · 시도 · 기한 칸) · visit_holds(칸 번호, L03) · visit_windows ·
visit_changes · visit_proposals · visit_events, 그리고 0026 채우기(살아 있는 요청 → 담기 · 시도 번호).
"""

import uuid
from datetime import date, datetime

import asyncpg
import pytest

from app.shared.clock import SEOUL
from tests.conftest import BACKEND, query
from tests.test_visit_request import home, listed, send

Check = asyncpg.exceptions.CheckViolationError
Unique = asyncpg.exceptions.UniqueViolationError
DAY = date(2026, 12, 15)
SL = (
    "insert into shortlists (id, project_id, trade, vendor_id, slot)"
    " values (gen_random_uuid(), $1, 'dobae', $2, $3)"
)
VISIT = (
    "insert into visits (id, project_id, trade, vendor_id, vendor_name, slot, attempt, status)"
    " values (gen_random_uuid(), $1, 'dobae', $2, 'x', $3, $4, $5)"
)
HOLD = (
    "insert into visit_holds (id, vendor_id, visit_id, day, half, seat, kind, until)"
    " values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)"
)


def base(api):
    """업체 두 곳(가 · 나) + 고객 공사 + 업체 가에 보낸 요청 하나 (requested, 시도 1)"""
    a = uuid.UUID(listed(api, "a@mitjip.test", "가"))
    b = uuid.UUID(listed(api, "b@mitjip.test", "나"))
    _, p = home(api)
    r = send(api, p["id"], [str(a)])
    assert r.status_code == 201, r.text
    return uuid.UUID(p["id"]), a, b, uuid.UUID(r.json()["created"][0]["id"])


def raises(error, sql: str, *args) -> None:
    with pytest.raises(error):
        query(sql, *args)


def migrate(to: str) -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    if to == "head":
        command.upgrade(cfg, "head")
    else:
        command.downgrade(cfg, to)


def test_shortlist_one_vendor_three_slots_and_again_after_removed(api):
    pid, a, b, _ = base(api)
    query(SL, pid, a, 1)
    raises(Unique, SL, pid, a, 2)  # 같은 업체 두 번 담기 → 409 already
    raises(Unique, SL, pid, b, 1)  # 같은 칸 동시 → 409 stale
    raises(Check, SL, pid, b, 4)  # 4번째 칸 → 409 slots_full
    query("update shortlists set status = 'removed', removed_code = 'customer', removed_at = now()")
    query(SL, pid, a, 1)  # 빼고 다시 담기는 된다
    assert query("select count(*) n from shortlists where status = 'active'")[0]["n"] == 1
    raises(Check, "update shortlists set status = 'removed', removed_at = now()")  # 사유 없음
    raises(Check, "update shortlists set removed_at = now() where status = 'active'")
    raises(Check, "update shortlists set removed_code = 'lost'")


def test_visit_new_states_and_reason_columns(api):
    _, _, _, _ = base(api)
    for st in ("offered", "picked", "proposed", "booked", "visited", "no_show", "quoted"):
        query("update visits set status = $1", st)
    raises(Check, "update visits set status = 'lost'")
    raises(Check, "update visits set status = 'expired'")  # 기한 지남인데 이유 없음
    query("update visits set status = 'expired', expired_reason = 'pick'")
    raises(Check, "update visits set expired_reason = 'late'")
    raises(Check, "update visits set status = 'booked'")  # 이유가 남은 채로 다른 상태
    raises(
        Check,
        "update visits set status = 'requested', expired_reason = null, cancel_code = 'other'",
    )
    query("update visits set status = 'cancelled', expired_reason = null, cancel_code = 'other'")
    query("update visits set cancel_note = '이사 날짜가 바뀌었어요'")
    raises(Check, "update visits set cancel_note = '  '")
    raises(Check, "update visits set cancel_code = 'nope'")
    raises(Check, "update visits set decline_note = '바빠요'")  # 못 받음이 아님
    raises(Check, "update visits set booked_day = '2026-12-15'")  # 반나절 없이
    query("update visits set booked_day = '2026-12-15', booked_half = 'am'")
    raises(Check, "update visits set booked_half = 'ev'")
    raises(Check, "update visits set wish_start = '2026-12-10'")  # 끝 없이
    raises(Check, "update visits set wish_start = '2026-12-10', wish_end = '2026-12-09'")
    raises(Check, "update visits set wish_start = '2026-12-01', wish_end = '2027-02-02'")  # 63일
    query("update visits set wish_start = '2026-12-01', wish_end = '2027-02-01'")  # 62일
    raises(Check, "update visits set attempt = 0")


def test_visit_attempt_unique_and_live_slot(api):
    pid, a, _, _ = base(api)
    raises(Unique, VISIT, pid, a, 2, 1, "cancelled")  # 같은 시도 번호
    raises(Unique, VISIT, pid, a, 2, 2, "offered")  # 살아 있는 요청이 이미 있음
    raises(Unique, VISIT, pid, None, 1, 1, "booked")  # 살아 있는 칸 1번
    query("update visits set status = 'expired', expired_reason = 'reply'")
    query(VISIT, pid, a, 1, 2, "requested")  # 기한 지난 뒤 시도 2 · 같은 칸
    assert [r["attempt"] for r in query("select attempt from visits order by attempt")] == [1, 2]


def test_holds_seat_number_capacity_l03(api):
    pid, a, _, v1 = base(api)
    home(api, "home2@mitjip.test")  # 다른 고객이 같은 업체에
    p2 = query("select id from projects where id <> $1", pid)[0]["id"]
    query(VISIT, p2, a, 1, 1, "picked")
    v2 = query("select id from visits where project_id = $1", p2)[0]["id"]
    until = datetime(2026, 12, 12, 18, 0, tzinfo=SEOUL)
    query(HOLD, a, v1, DAY, "am", 1, "hold", until)
    raises(Unique, HOLD, a, v2, DAY, "am", 1, "hold", until)  # 같은 칸 번호 → 409 slot_taken
    query(HOLD, a, v2, DAY, "am", 2, "hold", until)  # 두 번째 칸 (반나절당 2)
    raises(Unique, HOLD, a, v1, DAY, "pm", 1, "booked", None)  # 요청 하나에 살아 있는 잡기 하나
    raises(Check, "update visit_holds set seat = 4")  # 칸 번호 1~3
    query("update visit_holds set status = 'released', released_at = now() where visit_id = $1", v1)
    query(HOLD, a, v1, DAY, "am", 1, "booked", None)  # 풀린 뒤 다시 잡기
    raises(
        Check, "update visit_holds set until = null where kind = 'hold'"
    )  # 잡아 둠인데 기한 없음
    raises(
        Check, "update visit_holds set kind = 'booked' where kind = 'hold'"
    )  # 확정인데 기한 남음
    raises(Check, "update visit_holds set half = 'ev'")
    raises(Check, "update visit_holds set status = 'released'")  # 푼 때 없음
    raises(Check, "update visit_holds set kind = 'maybe'")


def test_window_ranges(api):
    _, _, _, vid = base(api)
    w = (
        "insert into visit_windows (visit_id, start_date, end_date, excluded, pick_due_at)"
        " values ($1, $2, $3, $4, now() + interval '7 days')"
    )
    raises(Check, w, vid, date(2026, 12, 10), date(2026, 12, 9), [])
    raises(Check, w, vid, date(2026, 12, 1), date(2027, 2, 2), [])  # 63일
    many = [date(2026, 12, 1 + n % 28) for n in range(32)]
    raises(Check, w, vid, date(2026, 12, 1), date(2027, 1, 31), many)  # 빼는 날 32개
    query(w, vid, date(2026, 12, 10), date(2026, 12, 20), [date(2026, 12, 13)])
    raises(Unique, w, vid, date(2026, 12, 10), date(2026, 12, 20), [])  # 요청마다 답 하나
    raises(Check, "update visit_windows set pick_due_at = answered_at")


def test_changes_one_open_and_no_same_half(api):
    _, _, _, vid = base(api)
    c = (
        "insert into visit_changes (id, visit_id, from_day, from_half, to_day, to_half, due_at)"
        " values (gen_random_uuid(), $1, $2, $3, $4, $5, now() + interval '48 hours')"
    )
    raises(Check, c, vid, DAY, "am", DAY, "am")  # 같은 반나절로 바꾸기 금지
    query(c, vid, DAY, "am", DAY, "pm")
    raises(Unique, c, vid, DAY, "am", date(2026, 12, 16), "am")  # 열린 요청 하나
    query("update visit_changes set status = 'countered'")
    raises(Unique, c, vid, DAY, "am", date(2026, 12, 16), "am")  # countered도 고객 답을 기다린다
    raises(Check, "update visit_changes set closed_at = now()")  # 열린 것에 닫은 때
    query("update visit_changes set status = 'accepted', closed_at = now()")
    query(c, vid, DAY, "pm", date(2026, 12, 16), "am")
    raises(Check, "update visit_changes set status = 'withdrawn' where closed_at is null")
    raises(Check, "update visit_changes set to_half = 'ev'")


def test_proposals_one_open_and_slots(api):
    _, _, _, vid = base(api)
    p = (
        "insert into visit_proposals (id, visit_id, reason_code, due_at)"
        " values ($1, $2, $3, now() + interval '48 hours')"
    )
    first = uuid.uuid4()
    query(p, first, vid, "other_site")
    raises(Unique, p, uuid.uuid4(), vid, "no_crew")  # 열린 제안 하나
    raises(Check, "update visit_proposals set reason_code = null")  # 처음 제안은 이유가 있다
    raises(Check, "update visit_proposals set reason_code = 'busy'")
    raises(Check, "update visit_proposals set status = 'picked'")  # 닫은 때 없음
    slot = "insert into visit_proposal_slots (proposal_id, day, half) values ($1, $2, $3)"
    query(slot, first, DAY, "am")
    raises(Unique, slot, first, DAY, "am")
    raises(Check, slot, first, DAY, "ev")


def test_events_new_columns(api):
    _, _, _, vid = base(api)
    e = (
        "insert into visit_events (id, visit_id, from_status, to_status, code, day, half, day_to)"
        " values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)"
    )
    query(e, vid, "requested", "offered", "answered", DAY, None, date(2026, 12, 18))
    query(e, vid, "booked", "booked", "change_requested", DAY, "pm", None)  # 상태 그대로인 기록
    raises(Check, e, vid, "offered", "lost", None, None, None, None)
    raises(Check, e, vid, "offered", "picked", "picked", DAY, "ev", None)
    raises(Check, e, vid, "requested", "offered", "answered", DAY, None, date(2026, 12, 14))
    raises(Check, e, vid, "requested", "offered", "answered", None, None, DAY)  # 시작 없이 끝


def test_0026_fills_shortlist_for_live_visit_and_attempt_numbers(api):
    pid, a, _, first = base(api)
    query("update visits set status = 'declined', decline_code = 'full'")
    again = send(api, str(pid), [str(a)])
    assert again.status_code == 201, again.text
    second = uuid.UUID(again.json()["created"][0]["id"])
    assert query("select attempt from visits where id = $1", second)[0]["attempt"] == 2
    try:
        migrate("0025_v3_vendor")
        names = {r["tablename"] for r in query("select tablename from pg_tables")}
        assert "shortlists" not in names and "visit_holds" not in names
    finally:
        migrate("head")
    rows = {r["id"]: r for r in query("select id, attempt, slot, shortlist_id from visits")}
    assert (rows[first]["attempt"], rows[second]["attempt"]) == (1, 2)  # 만든 순서로 채움
    sl = query("select id, slot, status, vendor_id from shortlists")
    assert len(sl) == 1 and sl[0]["status"] == "active" and sl[0]["vendor_id"] == a
    assert sl[0]["slot"] == rows[second]["slot"] and rows[second]["shortlist_id"] == sl[0]["id"]
    assert rows[first]["shortlist_id"] is None  # 끝난 요청은 담기를 만들지 않는다


def test_0026_down_maps_new_states_back(api):
    _, _, _, vid = base(api)
    query("update visits set status = 'booked', booked_day = '2026-12-15', booked_half = 'am'")
    query(
        "insert into visit_events (id, visit_id, from_status, to_status)"
        " values (gen_random_uuid(), $1, 'offered', 'booked')",
        vid,
    )
    try:
        migrate("0025_v3_vendor")
        assert query("select status from visits")[0]["status"] == "requested"
        ev = query("select from_status, to_status from visit_events where from_status is not null")
        assert (ev[0]["from_status"], ev[0]["to_status"]) == ("requested", "requested")
    finally:
        migrate("head")
    assert query("select status, attempt from visits")[0]["attempt"] == 1
