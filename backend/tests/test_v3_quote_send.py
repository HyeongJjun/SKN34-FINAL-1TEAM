"""실측 견적서 v3 (V10 · D19 · D20, api.md 6장 · 10장): v3 요청은 실측 확정 · 실측 받음에서만 보내기(다른 상태 409),
간이과세 업체는 부가세 0(L02), 보낼 때 유효기간 3일 · 1일 전 알림 일(quote_valid_soon), 처리 함수는 한 번만 알린다."""

import asyncio
import uuid
from datetime import datetime, time, timedelta

from app.calc.deadline import valid_soon_at
from app.db import SessionLocal
from app.jobs.models import Job
from app.jobs.service import outcome
from app.quote import jobs as quote_jobs
from app.shared.clock import SEOUL, today_seoul
from tests.conftest import query
from tests.test_vendor_quote import FULL, doc, ready, url

TODAY = today_seoul()
BLOCKED = ("requested", "offered", "picked", "proposed", "cancelled", "no_show")


def to_v3(visit_id: str, status: str) -> None:
    """옛 요청을 v3 요청(희망 기간 있음)으로 바꾸고 상태를 둔다. 실측 반나절은 오늘 오전."""
    query(
        "update visits set wish_start = $2, wish_end = $3, status = $4,"
        " booked_day = $5, booked_half = 'am' where id = $1",
        uuid.UUID(visit_id),
        TODAY - timedelta(days=3),
        TODAY + timedelta(days=10),
        status,
        TODAY,
    )


def draft(api, visit_id: str, **over) -> dict:
    r = api.put(url(visit_id), json={**FULL, "file_ids": [doc(api)], **over})
    assert r.status_code == 200, r.text
    return r.json()["draft"]


def jobs_of(kind: str = "quote_valid_soon") -> list:
    return query(
        "select id, ref_id, run_at, status from jobs where kind = $1 order by run_at, ref_id", kind
    )


def run_job(job_id, now: datetime):
    async def go():
        async with SessionLocal() as s:
            job = await s.get(Job, job_id)
            out = outcome(await quote_jobs.quote_valid_soon(s, job, now))
            await s.commit()
            return out

    return asyncio.run(go())


def test_v3_sends_only_from_booked_or_visited(api):
    _, _, v = ready(api)
    to_v3(v, "booked")
    draft(api, v)  # 임시 저장은 실측 확정 · 실측 받음 · 견적서 옴에서
    for status in BLOCKED:
        query("update visits set status = $2 where id = $1", uuid.UUID(v), status)
        r = api.post(f"{url(v)}/send")
        assert r.status_code == 409, (status, r.text)
    assert query("select count(*) n from vendor_quotes where sent_at is not null")[0]["n"] == 0
    query("update visits set status = 'visited' where id = $1", uuid.UUID(v))
    sent = api.post(f"{url(v)}/send")
    assert sent.status_code == 200, sent.text
    assert sent.json()["visit_status"] == "quoted"
    (row,) = query("select status, quote_ver from visits")
    assert (row["status"], row["quote_ver"]) == ("quoted", 1)


def test_booked_send_and_simplified_vendor_has_no_vat(api):
    _, _, v = ready(api, tax_kind="simplified")
    to_v3(v, "booked")
    d = draft(api, v)  # 3,080,000원 '부가세 빼고'라도 간이는 부가세를 붙이지 않아요
    assert (d["supply"], d["vat"], d["total"]) == (3_080_000, 0, 3_080_000)
    sent = api.post(f"{url(v)}/send")
    assert sent.status_code == 200, sent.text
    (q,) = sent.json()["sent"]
    assert (q["supply"], q["vat"], q["total"]) == (3_080_000, 0, 3_080_000)
    (row,) = query("select vat, total from vendor_quotes")
    assert (row["vat"], row["total"]) == (0, 3_080_000)


def test_general_vendor_still_adds_vat(api):
    _, _, v = ready(api)
    to_v3(v, "booked")
    d = draft(api, v)
    assert (d["supply"], d["vat"], d["total"]) == (3_080_000, 308_000, 3_388_000)


def test_valid_soon_jobs_and_handler_notifies_once(api):
    _, p, v = ready(api)
    to_v3(v, "booked")
    valid = TODAY + timedelta(days=14)
    draft(api, v, valid_until=valid.isoformat())
    assert api.post(f"{url(v)}/send").status_code == 200
    (q1,) = query("select id from vendor_quotes where sent_at is not null")
    jobs = jobs_of()
    assert [j["ref_id"] for j in jobs] == [q1["id"], q1["id"]]
    assert [j["run_at"] for j in jobs] == valid_soon_at(valid)  # 3일 · 1일 전 18:00 (서울)
    assert jobs[0]["run_at"] == datetime.combine(valid - timedelta(days=3), time(18), SEOUL)

    first = run_job(jobs[0]["id"], jobs[0]["run_at"])
    assert first.changed is True and len(first.unread) == 1
    again = run_job(jobs[0]["id"], jobs[0]["run_at"])  # 두 번 불려도 알림은 한 번
    assert again.changed is False
    me = query("select id from users where email = 'home@mitjip.test'")[0]["id"]
    (n,) = query("select kind, body, link from notifications where user_id = $1"
                 " and kind = 'quote_valid_soon'", me)  # fmt: skip
    assert n["body"] == "마루와벽 견적서 유효기간이 3일 남았어요"
    assert n["link"] == f"/projects/{p['id']}/quotes"

    draft(api, v, valid_until=(valid + timedelta(days=7)).isoformat())  # 다시 올리기
    assert api.post(f"{url(v)}/send").status_code == 200
    old = {j["id"]: j["status"] for j in jobs_of() if j["ref_id"] == q1["id"]}
    assert set(old.values()) == {"cancelled"}  # 앞 버전의 기다리는 알림 일은 거둔다
    assert run_job(jobs[1]["id"], jobs[1]["run_at"]).changed is False  # 최신 버전이 아님
    (q2,) = query("select id from vendor_quotes where version = 2")
    new = [j for j in jobs_of() if j["ref_id"] == q2["id"]]
    assert len(new) == 2 and all(j["status"] == "pending" for j in new)

    query("update visits set status = 'chosen' where id = $1", uuid.UUID(v))
    assert run_job(new[0]["id"], new[0]["run_at"]).changed is False  # 이미 확정
    query("update visits set status = 'quoted' where id = $1", uuid.UUID(v))
    late = datetime.combine(valid + timedelta(days=8), time(9), SEOUL)
    assert run_job(new[1]["id"], late).changed is False  # 유효기간이 지난 뒤
    last = run_job(new[1]["id"], new[1]["run_at"])
    assert last.changed is True
    bodies = [r["body"] for r in query("select body from notifications where kind = 'quote_valid_soon'"
                                         " order by created_at")]  # fmt: skip
    assert bodies[-1] == "마루와벽 견적서 유효기간이 1일 남았어요"


def test_no_valid_until_means_no_jobs(api):
    _, _, v = ready(api)
    to_v3(v, "booked")
    draft(api, v, valid_until=None)
    assert api.post(f"{url(v)}/send").status_code == 200
    assert jobs_of() == []
