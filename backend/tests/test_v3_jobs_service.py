"""기한 일(jobs.service): 넣기 멱등 · 취소 · 거두기(SKIP LOCKED, 멈춘 일 다시) · 끝내기 · 실패 다시."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.db import SessionLocal
from app.jobs import service as jobs
from app.jobs.models import Job
from tests.conftest import query

NOW = datetime(2026, 12, 1, 9, 0, tzinfo=UTC)


def run(coro):
    return asyncio.run(coro)


async def _add(n: int = 1, at: datetime = NOW, kind: str = "visit_reply_due") -> list[uuid.UUID]:
    refs = [uuid.uuid4() for _ in range(n)]
    async with SessionLocal() as s:
        for r in refs:
            assert await jobs.add(s, kind=kind, ref_id=r, run_at=at)
        await s.commit()
    return refs


def test_key_is_short_and_utc():
    ref = uuid.uuid4()
    k = jobs.key("visit_proposal_due", ref, datetime(2026, 12, 3, 22, 30, tzinfo=UTC))
    assert k == f"visit_proposal_due:{ref}:202612032230" and len(k) <= 80
    with pytest.raises(ValueError):
        jobs.key("visit_reply_due", ref, datetime(2026, 12, 3, 22, 30))


def test_add_is_idempotent_and_checks_input():
    async def go():
        ref = uuid.uuid4()
        async with SessionLocal() as s:
            first = await jobs.add(s, kind="visit_reply_due", ref_id=ref, run_at=NOW)
            again = await jobs.add(s, kind="visit_reply_due", ref_id=ref, run_at=NOW)
            await s.commit()
            with pytest.raises(ValueError):
                await jobs.add(s, kind="lunch", ref_id=ref, run_at=NOW)
            with pytest.raises(ValueError):
                await jobs.add(
                    s, kind="visit_reply_due", ref_id=ref, run_at=NOW.replace(tzinfo=None)
                )
        return first, again

    assert run(go()) == (True, False)
    assert query("select count(*) n from jobs")[0]["n"] == 1


def test_cancel_only_pending():
    refs = run(_add(2))
    query("update jobs set status = 'running', locked_until = now() where ref_id = $1", refs[1])

    async def go():
        async with SessionLocal() as s:
            a = await jobs.cancel(s, now=NOW, kind="visit_reply_due", ref_id=refs[0])
            b = await jobs.cancel(s, now=NOW, kind="visit_reply_due", ref_id=refs[1])
            c = await jobs.cancel(s, now=NOW, dedup_key="nope")
            await s.commit()
            with pytest.raises(ValueError):
                await jobs.cancel(s, now=NOW)
        return a, b, c

    assert run(go()) == (1, 0, 0)
    got = {r["ref_id"]: r["status"] for r in query("select ref_id, status from jobs")}
    assert got == {refs[0]: "cancelled", refs[1]: "running"}


def test_claim_due_only_and_two_workers_never_share():
    run(_add(3))
    run(_add(1, at=NOW + timedelta(hours=1)))  # 아직 기한 전

    async def go():
        a = SessionLocal()
        b = SessionLocal()
        try:
            first = await jobs.claim(a, NOW)  # 잠금을 쥔 채로
            second = await jobs.claim(b, NOW)  # 다른 worker: 잠긴 행은 건너뛴다
            await a.commit()
            await b.commit()
            return [j.id for j in first], [j.id for j in second]
        finally:
            await a.close()
            await b.close()

    first, second = run(go())
    assert len(first) == 3 and second == []
    rows = query("select status, locked_until from jobs where status = 'running'")
    assert len(rows) == 3 and all(r["locked_until"] == NOW + jobs.LOCK for r in rows)


def test_stuck_running_is_claimed_again_then_finished():
    run(_add(2))

    async def go():
        async with SessionLocal() as s:
            got = await jobs.claim(s, NOW)
            await s.commit()
        async with SessionLocal() as s:  # 잠금 시간이 지나면 다시 거둔다
            again = await jobs.claim(s, NOW + jobs.LOCK + timedelta(seconds=1))
            await s.commit()
            await jobs.finish(s, again[0].id, now=NOW)
            await jobs.finish(s, again[1].id, now=NOW, skipped=True)
            await s.commit()
        return got, again

    got, again = run(go())
    assert {j.id for j in got} == {j.id for j in again}
    assert sorted(r["status"] for r in query("select status from jobs")) == ["done", "skipped"]
    assert all(r["done_at"] for r in query("select done_at from jobs"))


def test_fail_retries_then_gives_up():
    run(_add(1))

    async def go():
        times = []
        for n in range(jobs.ATTEMPTS_MAX):
            async with SessionLocal() as s:
                at = NOW + timedelta(hours=n)
                got = await jobs.claim(s, at)
                assert len(got) == 1, n
                await jobs.fail(s, got[0].id, now=at, error="TimeoutError")
                await s.commit()
                j = await s.get(Job, got[0].id, populate_existing=True)
                times.append((j.status, j.attempts, j.run_at - at))
        return times

    times = run(go())
    assert times[0] == ("pending", 1, timedelta(minutes=1))
    assert times[1] == ("pending", 2, timedelta(minutes=5))
    assert times[2] == ("pending", 3, timedelta(minutes=30))
    assert times[-1][:2] == ("failed", jobs.ATTEMPTS_MAX)
    row = query("select last_error, done_at from jobs")[0]
    assert row["last_error"] == "TimeoutError" and row["done_at"] is not None


def test_sweep_calls_handlers_by_kind(monkeypatch):
    from app import worker

    run(_add(1, kind="visit_reply_due"))
    run(_add(1, kind="visit_pick_due"))
    run(_add(1, kind="deal_auto_done"))
    seen = []

    async def changed(s, job, now):
        seen.append(job.kind)
        return True

    async def nothing(s, job, now):
        seen.append(job.kind)
        return False

    async def broken(s, job, now):
        raise TimeoutError

    # 처리 함수가 없으면 아무것도 거두지 않는다 (1단계부터 실제 표가 차 있어 빈 표로 바꿔 본다)
    monkeypatch.setattr(worker, "JOB_HANDLERS", {})
    assert run(worker.sweep_jobs(now=NOW)) == 0
    assert {r["status"] for r in query("select status from jobs")} == {"pending"}
    handlers = {"visit_reply_due": changed, "visit_pick_due": nothing, "deal_auto_done": broken}
    monkeypatch.setattr(worker, "JOB_HANDLERS", handlers)
    assert run(worker.sweep_jobs(now=NOW)) == 2
    got = {
        r["kind"]: (r["status"], r["attempts"])
        for r in query("select kind, status, attempts from jobs")
    }
    assert got == {
        "visit_reply_due": ("done", 0),
        "visit_pick_due": ("skipped", 0),
        "deal_auto_done": ("pending", 1),  # 1분 뒤 다시
    }
    assert sorted(seen) == ["visit_pick_due", "visit_reply_due"]
