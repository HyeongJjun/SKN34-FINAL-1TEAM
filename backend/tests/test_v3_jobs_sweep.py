"""v3 기한 일: schedule 처리 함수(기한 전 그대로 · 기한 뒤 한 번 · 두 번째 False) · sweep이 실제 처리 함수로
끝냄(done · skipped · 실패 다시) · commit 뒤 신호 · 기한 당기기 명령(app.run_due)."""

import asyncio
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime, timedelta

from app import run_due, worker
from app.auth.models import User
from app.calc import deadline
from app.db import SessionLocal
from app.jobs import service as jobs
from app.jobs.models import Job
from app.schedule import jobs as deal_jobs
from app.schedule import service
from app.schedule.schemas import CheckIn
from app.shared.clock import today_seoul
from app.shared.errors import AppError
from tests.conftest import BACKEND, query
from tests.helpers import no_surprises, use
from tests.test_dates import days, propose, ready
from tests.test_extras import scheduled
from tests.test_visit_inbox import login

TODAY = today_seoul()


def run(coro):
    return asyncio.run(coro)


def handle(kind: str, ref: uuid.UUID | None, now: datetime):
    """처리 함수 하나를 새 세션에서 부르고 commit한다 (worker.sweep과 같은 계약)"""

    async def go():
        job = Job(
            id=uuid.uuid4(), kind=kind, ref_id=ref, run_at=now, dedup_key="t", status="running"
        )
        async with SessionLocal() as s:
            out = await deal_jobs.HANDLERS[kind](s, job, now)
            await s.commit()
            return out

    return run(go())


def changed(out) -> bool:
    return jobs.outcome(out).changed


def kinds(kind: str) -> list[dict]:
    return [
        dict(r)
        for r in query("select user_id, body, link from notifications where kind = $1", kind)
    ]


def job_row(kind: str, ref) -> dict:
    (row,) = query("select status, run_at from jobs where kind = $1 and ref_id = $2", kind, ref)
    return dict(row)


def deal_of(did: str) -> dict:
    return dict(query("select * from deals where id = $1", uuid.UUID(did))[0])


def test_dates_due_waits_then_notifies_both_once(api):
    customer, pid, did, _ = ready(api)
    d = deal_of(did)
    due = d["dates_due_at"]
    assert due == deadline.dates_due(d["created_at"])  # 확정 + 2일 18:00 (계산 엔진)
    assert job_row("deal_dates_due", d["id"]) == {"status": "pending", "run_at": due}

    assert handle("deal_dates_due", d["id"], due - timedelta(minutes=1)) is False  # 기한 전
    assert kinds("dates_due") == []
    out = handle("deal_dates_due", d["id"], due)
    assert changed(out)
    o = jobs.outcome(out)
    owner = query("select owner_id from projects")[0]["owner_id"]
    assert set(o.unread) == {owner, d["vendor_id"]}
    assert [(p.kind, p.ref_id, set(p.user_ids)) for p in o.states] == [
        ("deal", d["id"], {owner, d["vendor_id"]})
    ]
    got = {r["user_id"]: r for r in kinds("dates_due")}
    assert set(got) == {owner, d["vendor_id"]}
    assert got[owner]["link"] == f"/projects/{pid}/schedule"
    assert got[d["vendor_id"]]["link"] == f"/vendor/jobs/{did}"
    assert "마루와벽이 아직 공사 날짜를 내지 않았어요" in got[owner]["body"]
    assert handle("deal_dates_due", d["id"], due + timedelta(hours=1)) is False  # 두 번째
    assert len(kinds("dates_due")) == 2

    assert propose(api, did, *days(14)).status_code == 200  # 날짜가 오면 기한 일은 취소
    assert job_row("deal_dates_due", d["id"])["status"] == "cancelled"
    assert handle("deal_dates_due", d["id"], due + timedelta(days=1)) is False
    assert handle("deal_dates_due", uuid.uuid4(), due) is False  # 대상 없음
    assert customer


def test_request_due_waits_then_notifies_once_and_answer_cancels(api):
    customer, pid, did, _ = ready(api)
    propose(api, did, *days(14))
    use(api, customer)
    w1, _ = days(28, 1)
    r = api.post(f"/projects/{pid}/deals/{did}/date-requests", json={"wish_dates": [w1]})
    assert r.status_code == 201, r.text
    req = r.json()["trades"][0]["request"]
    rid, due = uuid.UUID(req["id"]), datetime.fromisoformat(req["due_at"])
    assert due == deadline.date_request_due(datetime.fromisoformat(req["created_at"]))  # + 48시간
    assert job_row("deal_request_due", rid) == {"status": "pending", "run_at": due}

    assert handle("deal_request_due", rid, due - timedelta(seconds=1)) is False
    assert changed(handle("deal_request_due", rid, due + timedelta(minutes=1)))
    assert len(kinds("request_due")) == 2  # 고객 · 업체
    assert handle("deal_request_due", rid, due + timedelta(minutes=2)) is False
    login(api, "maru@mitjip.test")
    a, b = days(28)
    assert propose(api, did, w1, b, request_id=str(rid)).status_code == 200
    assert job_row("deal_request_due", rid)["status"] == "cancelled"
    assert handle("deal_request_due", rid, due + timedelta(days=1)) is False  # 요청이 닫혔다
    assert a


def finished(api):
    """공사 날짜를 수락하고 '공사 끝냈어요'를 올린 집. (고객, 프로젝트, 확정, 올린 때)"""
    customer, pid, did = scheduled(api)
    query("update deals set start_date = $1, end_date = $2", TODAY - timedelta(days=3), TODAY)
    r = api.post(f"/vendor/jobs/{did}/done", json={"note": "남은 벽지 1롤은 다용도실에 두었어요"})
    assert r.status_code == 200, r.text
    posted = datetime.fromisoformat(r.json()["done_posted_at"])
    return customer, pid, did, posted


def test_done_remind_then_auto_done_once(api):
    customer, pid, did, posted = finished(api)
    d = deal_of(did)
    remind, auto = deadline.done_remind_at(posted), deadline.auto_done_at(posted)
    assert job_row("deal_done_remind", d["id"]) == {"status": "pending", "run_at": remind}
    assert job_row("deal_auto_done", d["id"]) == {"status": "pending", "run_at": auto}

    assert handle("deal_done_remind", d["id"], remind - timedelta(minutes=1)) is False
    assert changed(handle("deal_done_remind", d["id"], remind))
    (note,) = kinds("done_remind")
    auto_day = auto.astimezone(deadline.SEOUL).date()
    assert note["body"].startswith(f"{auto_day.month}.{auto_day.day}(")  # 자동으로 끝나는 날
    assert handle("deal_done_remind", d["id"], remind + timedelta(hours=1)) is False

    assert handle("deal_auto_done", d["id"], auto - timedelta(minutes=1)) is False  # 기한 전
    assert deal_of(did)["status"] == "checking"
    out = handle("deal_auto_done", d["id"], auto)
    assert changed(out)
    assert deal_of(did)["status"] == "done"
    (ev,) = query(
        "select from_status, to_status, by_id, code from deal_events where code = 'auto_done'"
    )
    assert (ev["from_status"], ev["to_status"], ev["by_id"]) == ("checking", "done", None)
    assert {r["link"] for r in kinds("auto_done")} == {
        f"/projects/{pid}/review",
        f"/vendor/jobs/{did}",
    }
    assert handle("deal_auto_done", d["id"], auto + timedelta(days=1)) is False  # 두 번째
    assert len(kinds("auto_done")) == 2
    use(api, customer)
    (got,) = api.get(f"/projects/{pid}/deals").json()
    assert (got["status"], got["review_open"], got["auto_done_at"]) == ("done", True, None)


def test_customer_check_cancels_done_jobs_and_beats_auto_done(api):
    customer, pid, did, posted = finished(api)
    use(api, customer)
    (d,) = api.get(f"/projects/{pid}/deals").json()
    assert datetime.fromisoformat(d["auto_done_at"]) == deadline.auto_done_at(posted)
    assert d["done_note"] == "남은 벽지 1롤은 다용도실에 두었어요" and d["review_open"] is False
    r = api.post(f"/projects/{pid}/deals/{did}/check", json={"result": "done"})
    assert r.status_code == 200, r.text
    deal = deal_of(did)["id"]
    assert job_row("deal_done_remind", deal)["status"] == "cancelled"
    assert job_row("deal_auto_done", deal)["status"] == "cancelled"
    later = deadline.auto_done_at(posted) + timedelta(minutes=1)
    assert handle("deal_auto_done", deal, later) is False  # 이미 고객이 확인했다
    assert query("select count(*) n from deal_events where code = 'auto_done'")[0]["n"] == 0


def test_auto_done_and_customer_check_at_once_only_one_wins(api):
    customer, pid, did, posted = finished(api)
    me = query("select owner_id from projects")[0]["owner_id"]
    deal = uuid.UUID(did)
    when = deadline.auto_done_at(posted) + timedelta(minutes=1)

    async def by_worker():
        job = Job(id=uuid.uuid4(), kind="deal_auto_done", ref_id=deal, run_at=when, dedup_key="t")
        async with SessionLocal() as s:
            out = await deal_jobs.on_auto_done(s, job, when)
            await s.commit()
            return out

    async def by_customer():
        async with SessionLocal() as s:
            user = await s.get(User, me)
            return await service.check_work(
                s, user, uuid.UUID(pid), deal, CheckIn(result="done"), TODAY
            )

    async def both():
        return await asyncio.gather(by_worker(), by_customer(), return_exceptions=True)

    worker_out, customer_out = no_surprises(run(both()))
    won = [changed(worker_out) if not isinstance(worker_out, Exception) else False]
    won.append(not isinstance(customer_out, AppError))
    assert won.count(True) == 1  # 하나만 끝낸다
    if isinstance(customer_out, AppError):
        assert customer_out.status == 409
    assert query("select count(*) n from deal_events where to_status = 'done'")[0]["n"] == 1
    assert deal_of(did)["status"] == "done"
    assert customer


def test_thread_redact_is_a_no_op_until_thread_has_it():
    assert handle("thread_redact", uuid.uuid4(), datetime.now(UTC)) is False
    assert handle("thread_redact", None, datetime.now(UTC)) is False


# ---- worker.sweep: 실제 처리 함수 · 결과별 끝냄 · commit 뒤 신호 ----


def _job(kind: str, ref, at: datetime) -> None:
    async def go():
        async with SessionLocal() as s:
            assert await jobs.add(s, kind=kind, ref_id=ref, run_at=at)
            await s.commit()

    run(go())


def test_sweep_finishes_with_real_handlers_and_signals_after_commit(api, monkeypatch):
    customer, _pid, did, posted = finished(api)
    deal = uuid.UUID(did)
    now = deadline.auto_done_at(posted) + timedelta(minutes=5)
    _job("deal_auto_done", uuid.uuid4(), now - timedelta(hours=1))  # 대상 없음 → skipped
    _job("deal_request_due", uuid.uuid4(), now - timedelta(minutes=1))  # 처리 중 오류 → 다시
    _job("deal_auto_done", uuid.uuid4(), now + timedelta(hours=1))  # 아직 기한 전 → 그대로
    states, unread, after = [], [], []

    async def push_state(user_ids, kind, ref_id, project_id=None):
        states.append((set(user_ids), kind, ref_id))
        return 1

    async def push_unread(s, user_ids):
        unread.append(set(user_ids))

    async def broken(s, job, now):
        async def never():
            after.append("from broken")

        s.info.setdefault(jobs.AFTER_COMMIT, []).append(never)  # 실패하면 버린다
        raise TimeoutError

    monkeypatch.setattr(worker.realtime, "push_state", push_state)
    monkeypatch.setattr(worker.notify_service, "push_unread", push_unread)
    monkeypatch.setitem(worker.JOB_HANDLERS, "deal_request_due", broken)

    tally = run(worker.sweep(now))
    assert tally[("deal_auto_done", "done")] == 1  # 올린 공사 (deal_done_remind는 함께 취소됨)
    assert tally[("deal_auto_done", "skipped")] == 1
    assert tally[("deal_request_due", "retry")] == 1
    assert tally[("deal_done_remind", "skipped")] + tally[("deal_done_remind", "done")] <= 1
    assert deal_of(did)["status"] == "done"
    owner = query("select owner_id from projects")[0]["owner_id"]
    vendor = deal_of(did)["vendor_id"]
    assert ({owner, vendor}, "deal", deal) in states
    assert {owner, vendor} in unread
    assert after == []
    rows = {
        (r["kind"], r["status"], r["attempts"])
        for r in query("select kind, status, attempts from jobs where ref_id <> $1", deal)
    }
    assert ("deal_request_due", "pending", 1) in rows  # 1분 뒤 다시
    assert ("deal_auto_done", "pending", 0) in rows  # 기한 전 일은 그대로
    assert ("deal_auto_done", "skipped", 0) in rows
    again = run(worker.sweep(now))  # 공사 쪽은 더 거둘 것이 없다 (실패한 일은 1분 뒤로 밀렸다)
    assert not [k for k, _ in again if k.startswith("deal_")]
    assert customer


def test_sweep_runs_after_commit_functions(monkeypatch):
    now = datetime(2026, 12, 1, 9, 0, tzinfo=UTC)
    _job("thread_redact", uuid.uuid4(), now - timedelta(minutes=1))
    done = []

    async def handler(s, job, at):
        async def later():
            done.append(job.kind)

        s.info.setdefault(jobs.AFTER_COMMIT, []).append(later)
        return True

    monkeypatch.setattr(worker, "JOB_HANDLERS", {"thread_redact": handler})
    assert run(worker.sweep_jobs(now=now)) == 1
    assert done == ["thread_redact"]
    assert query("select status from jobs")[0]["status"] == "done"


# ---- 기한 당기기 (app.run_due): 도는 명령은 따로 띄운 파이썬으로 (시험 클라이언트의 이벤트 루프 ·
# Redis 연결을 이 명령이 닫지 않게. 명령은 끝날 때 자기 연결을 닫는다) ----


def due_cli(*args: str, **env: str) -> subprocess.CompletedProcess:
    """python -m app.run_due: 같은 파이썬 · 같은 시험 DB · Redis (conftest가 정한 환경 그대로)"""
    return subprocess.run(
        [sys.executable, "-m", "app.run_due", *args],
        cwd=BACKEND,
        env={**os.environ, "PYTHONIOENCODING": "utf-8", **env},
        capture_output=True,
        check=False,
        timeout=120,
    )


def test_run_due_sweeps_only_jobs_due_by_now():
    now = datetime(2026, 11, 21, 10, 0, tzinfo=deadline.SEOUL)
    _job("deal_auto_done", uuid.uuid4(), now - timedelta(minutes=1))
    _job("deal_dates_due", uuid.uuid4(), now)
    _job("deal_auto_done", uuid.uuid4(), now + timedelta(minutes=1))  # 아직
    r = due_cli("--now", "2026-11-21T10:00+09:00")
    out = r.stdout.decode("utf-8")
    assert r.returncode == 0, r.stderr.decode("utf-8")
    assert "2026-11-21 10:00 (서울)" in out
    assert "deal_auto_done: skipped 1" in out and "deal_dates_due: skipped 1" in out
    assert "모두 2건" in out
    got = sorted(r["status"] for r in query("select status from jobs"))
    assert got == ["pending", "skipped", "skipped"]
    again = due_cli("--now", "2026-11-21T10:00")  # 시간대가 없으면 서울
    assert again.returncode == 0 and "거둘 일이 없어요" in again.stdout.decode("utf-8")


def test_run_due_only_in_local_and_test(monkeypatch, capsys):
    _job("deal_auto_done", uuid.uuid4(), datetime(2026, 1, 1, tzinfo=UTC))
    for env in ("staging", "production"):  # 환경을 보고 바로 멈춘다 (이벤트 루프를 열지 않음)
        monkeypatch.setattr(run_due.settings, "app_env", env)
        assert run_due.main(["--now", "2026-11-21T10:00+09:00"]) == 2
        assert "개발" in capsys.readouterr().err
    assert query("select status from jobs")[0]["status"] == "pending"  # 아무것도 거두지 않았다
    r = due_cli("--now", "2026-11-21T10:00+09:00", APP_ENV="local")
    assert r.returncode == 0, r.stderr.decode("utf-8")
    assert query("select status from jobs")[0]["status"] == "skipped"  # local에서는 거둔다


def test_run_due_command_exits_2_outside_dev():
    r = due_cli("--now", "2026-11-21T10:00+09:00", APP_ENV="staging")
    assert r.returncode == 2
    assert "APP_ENV=staging" in r.stderr.decode("utf-8")
    assert due_cli("--now", "내일", APP_ENV="local").returncode == 2  # 시각을 못 읽음 (argparse)
