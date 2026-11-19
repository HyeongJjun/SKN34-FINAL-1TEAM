"""상태판 '답 없음' · '고르기 없음' 줄의 지난 기한 시각 (B2b 부탁, BoardRowOut.expired_due_at).

화면은 기한을 셈하지 않고 이 칸을 그대로 보여 줘요('3일 오후 2시까지 답이 없었어요').
"""

from datetime import datetime, timedelta

from tests.conftest import query
from tests.test_v3_visit_kit import changed, handle, offered, requested

MIN = timedelta(minutes=1)


def board_row(api, pid: str) -> dict:
    r = api.get(f"/projects/{pid}/visits?trade=dobae")
    assert r.status_code == 200, r.text
    (row,) = r.json()["board"]
    return row


def test_live_row_has_no_passed_deadline(api):
    f = requested(api)
    row = board_row(api, f["pid"])
    assert (row["status"], row["expired_due_at"]) == ("requested", None)


def test_reply_expired_row_shows_reply_deadline(api):
    f = requested(api)
    due = query("select reply_due_at from visits")[0]["reply_due_at"]
    assert changed(handle("visit_reply_due", f["visit"], due + MIN))
    row = board_row(api, f["pid"])
    assert (row["status"], row["expired_reason"]) == ("expired", "reply")
    assert datetime.fromisoformat(row["expired_due_at"]) == due


def test_pick_expired_row_shows_pick_deadline(api):
    f = offered(api)
    due = query("select pick_due_at from visit_windows")[0]["pick_due_at"]
    assert changed(handle("visit_pick_due", f["visit"], due + MIN))
    row = board_row(api, f["pid"])
    assert (row["status"], row["expired_reason"]) == ("expired", "pick")
    assert datetime.fromisoformat(row["expired_due_at"]) == due
