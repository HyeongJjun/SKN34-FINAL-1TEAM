"""v3 실측 기한 일 처리 함수 (visit/jobs.py HANDLERS, dev-04 · architecture 6장): 기한 전에는 바꾸지 않고,
'아직 그 상태 · 기한 지남'일 때만 한 번 바꾸고 두 번째는 False(멱등). worker.sweep_jobs로도 돈다."""

import uuid
from datetime import timedelta

from app import worker
from app.calc import deadline
from app.visit.jobs import HANDLERS
from tests.conftest import query
from tests.test_v3_visit_kit import (
    booked,
    changed,
    d,
    day,
    handle,
    notes,
    offered,
    pending_jobs,
    picked,
    quiet,
    requested,
    run,
    status,
)
from tests.test_visit_inbox import login

MIN = timedelta(minutes=1)


def one(sql: str, *args):
    return query(sql, *args)[0]


def test_all_visit_kinds_have_handlers():
    assert set(HANDLERS) == {
        "visit_reply_due",
        "visit_pick_due",
        "visit_accept_due",
        "visit_proposal_due",
        "visit_change_due",
        "visit_reminder",
        "visit_quote_due",
    }
    assert set(HANDLERS) <= set(worker.JOB_HANDLERS)  # worker가 모은다


def test_reply_due_expires_once_and_frees_the_slot(api):
    f = requested(api)
    due = one("select reply_due_at from visits")["reply_due_at"]
    assert not changed(handle("visit_reply_due", f["visit"], due - MIN))  # 기한 전
    assert status(f["visit"]) == "requested"
    out = handle("visit_reply_due", f["visit"], due + MIN)
    assert changed(out) and [x.kind for x in out.states] == ["visit"]
    assert set(out.unread) == {
        one("select owner_id from projects")["owner_id"],
        uuid.UUID(f["vendor"]),
    }
    vr = one("select status, expired_reason from visits")
    assert (vr["status"], vr["expired_reason"]) == ("expired", "reply")
    assert one("select removed_code from shortlists")["removed_code"] == "expired"
    (n,) = notes("home@mitjip.test", "visit_reply_expired")
    assert n["link"] == f"/projects/{f['pid']}/visits"
    assert not changed(handle("visit_reply_due", f["visit"], due + 2 * MIN))  # 두 번째
    assert len(notes("home@mitjip.test", "visit_reply_expired")) == 1
    login(api, f["email"])
    late = api.post(
        f"/vendor/visits/{f['visit']}/window",
        json={"start": d(5), "end": d(12), "excluded": [], "instant": True},
    )
    assert late.status_code == 409 and late.json()["error"]["code"] == "expired"


def test_pick_due_expires_offered(api):
    f = offered(api)
    due = one("select pick_due_at from visit_windows")["pick_due_at"]
    assert not changed(handle("visit_pick_due", f["visit"], due - MIN))
    assert changed(handle("visit_pick_due", f["visit"], due + MIN))
    vr = one("select status, expired_reason from visits")
    assert (vr["status"], vr["expired_reason"]) == ("expired", "pick")
    assert len(notes(f["email"], "visit_pick_expired")) == 1
    assert not changed(handle("visit_pick_due", f["visit"], due + 2 * MIN))
    r = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/pick", json={"day": d(6), "half": "am"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "expired"


def test_accept_due_releases_the_hold_only(api):
    f = picked(api)
    until = one("select until from visit_holds")["until"]
    assert not changed(handle("visit_accept_due", f["visit"], until - MIN))
    assert changed(handle("visit_accept_due", f["visit"], until + MIN))
    assert status(f["visit"]) == "offered"  # D12 보류 최소 처리(L10): 잡기만 풀고 날짜 고를 차례로
    assert one("select status from visit_holds")["status"] == "released"
    assert one("select status from shortlists")["status"] == "active"  # 칸은 비우지 않는다
    assert len(notes("home@mitjip.test", "visit_hold_released")) == 1
    assert not changed(handle("visit_accept_due", f["visit"], until + 2 * MIN))
    assert pending_jobs(f["visit"], "visit_pick_due")  # 고르기 기한은 그대로 남아 있다
    r = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/pick", json={"day": d(6), "half": "pm"})
    assert r.status_code == 200 and r.json()["status"] == "picked"


def test_accept_due_after_pick_due_expires_on_next_sweep(api):
    f = picked(api)
    query("update visit_windows set pick_due_at = answered_at + interval '1 minute'")
    until = one("select until from visit_holds")["until"]
    assert changed(handle("visit_accept_due", f["visit"], until + MIN))
    assert status(f["visit"]) == "offered"
    jobs = pending_jobs(f["visit"], "visit_pick_due")
    assert len(jobs) == 2 and until + MIN in [j["run_at"] for j in jobs]  # 바로 기한 지남이 되게
    assert changed(handle("visit_pick_due", f["visit"], until + 2 * MIN))
    assert status(f["visit"]) == "expired"


def test_proposal_due_back_to_offered(api):
    f = picked(api)
    login(api, f["email"])
    body = {"reason_code": "no_crew", "slots": [{"day": d(8), "half": "am"}]}
    assert api.post(f"/vendor/visits/{f['visit']}/propose", json=body).status_code == 200
    p = one("select id, due_at from visit_proposals")
    assert not changed(handle("visit_proposal_due", p["id"], p["due_at"] - MIN))
    assert changed(handle("visit_proposal_due", p["id"], p["due_at"] + MIN))
    assert status(f["visit"]) == "offered"
    assert one("select status from visit_proposals")["status"] == "expired"
    assert len(notes(f["email"], "visit_proposal_expired")) == 1
    assert not changed(handle("visit_proposal_due", p["id"], p["due_at"] + 2 * MIN))


def test_change_due_and_countered_change_expire(api):
    f = booked(api)
    url = f"/projects/{f['pid']}/visits/{f['visit']}/changes"
    r = api.post(url, json={"day": d(8), "half": "pm"})
    assert r.status_code == 201, r.text
    c = one("select id, due_at from visit_changes")
    assert not changed(handle("visit_change_due", c["id"], c["due_at"] - MIN))
    assert changed(handle("visit_change_due", c["id"], c["due_at"] + MIN))
    assert one("select status from visit_changes")["status"] == "expired"
    vr = one("select status, booked_day, booked_half from visits")
    assert (vr["status"], str(vr["booked_day"]), vr["booked_half"]) == ("booked", d(6), "am")
    assert len(notes("home@mitjip.test", "visit_change_expired")) == 1
    assert not changed(handle("visit_change_due", c["id"], c["due_at"] + 2 * MIN))

    r = api.post(url, json={"day": d(9), "half": "am"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    login(api, f["email"])
    counter = api.post(
        f"/vendor/visits/{f['visit']}/changes/{cid}/propose",
        json={"slots": [{"day": d(10), "half": "pm"}]},
    )
    assert counter.status_code == 200, counter.text
    p = one("select id, due_at from visit_proposals where change_id = $1", uuid.UUID(cid))
    assert changed(handle("visit_proposal_due", p["id"], p["due_at"] + MIN))
    st = one("select status from visit_changes where id = $1", uuid.UUID(cid))["status"]
    assert st == "expired" and status(f["visit"]) == "booked"  # 원래 일정 그대로


def test_reminder_and_quote_due(api):
    f = booked(api)
    (job,) = pending_jobs(f["visit"], "visit_reminder")
    at = job["run_at"]
    assert at == deadline.reminder_at(day(6))
    assert not changed(handle("visit_reminder", f["visit"], at - MIN, run_at=at))
    other = deadline.reminder_at(day(7))
    assert not changed(
        handle("visit_reminder", f["visit"], other + MIN, run_at=other)
    )  # 옛 날 알림
    out = handle("visit_reminder", f["visit"], at + MIN, run_at=at)
    assert changed(out)
    (cn,) = notes("home@mitjip.test", "visit_reminder")
    assert cn["body"].startswith("내일 오전 실측이에요") and "동 · 호" in cn["body"]  # I7 B
    (vn,) = notes(f["email"], "visit_reminder")
    assert vn["link"] == f"/vendor/requests/{f['visit']}" and "동 · 호" not in vn["body"]
    assert not changed(handle("visit_reminder", f["visit"], at + 2 * MIN, run_at=at))

    due = one("select quote_due_at from visits")["quote_due_at"]
    assert not changed(handle("visit_quote_due", f["visit"], due - MIN))
    assert changed(handle("visit_quote_due", f["visit"], due + MIN))
    (q,) = notes("home@mitjip.test", "quote_late")
    assert q["link"] == f"/projects/{f['pid']}/visits"
    assert not changed(handle("visit_quote_due", f["visit"], due + 2 * MIN))


def test_handlers_skip_ended_or_missing_targets(api):
    f = requested(api)
    r = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/cancel", json={"code": "changed"})
    assert r.status_code == 200
    far = deadline.reply_due(one("select created_at from visits")["created_at"]) + timedelta(
        days=30
    )
    for kind in HANDLERS:
        assert not changed(handle(kind, f["visit"], far)), kind  # 지난 상태에서는 아무것도 안 한다
        assert not changed(handle(kind, uuid.uuid4(), far)), kind  # 대상이 없으면 skipped
    assert status(f["visit"]) == "cancelled"


def test_sweep_jobs_runs_due_visit_jobs(api, monkeypatch):
    quiet(monkeypatch)  # commit 뒤 신호는 줄기 쓰기를 끈 채로 (다른 이벤트 루프)
    f = requested(api)
    due = one("select reply_due_at from visits")["reply_due_at"]
    assert run(worker.sweep_jobs(None, due - MIN)) == 0  # 아직 기한 전
    run(worker.sweep_jobs(None, due + MIN))
    assert status(f["visit"]) == "expired"
    jobs = query("select kind, status from jobs where ref_id = $1", uuid.UUID(f["visit"]))
    assert {(j["kind"], j["status"]) for j in jobs} == {("visit_reply_due", "done")}
