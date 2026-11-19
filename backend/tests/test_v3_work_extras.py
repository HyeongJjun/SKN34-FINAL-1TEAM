"""v3 추가 금액 판 (D23 · C37 · V12): 같은 키 두 번 → 200 같은 줄 · 고친 새 판(앞 판 superseded, 최신 판 하나) ·
답 승인 · 거절 · 묻기 전이 표(허용 · 409) · 옛 /ack 길 그대로 · 합계는 최신 판만 · 간이 업체 부가세 0 ·
묻기는 채팅 카드 · 동시 같은 키 · 권한."""

import asyncio
import json
import uuid

import asyncpg
import pytest
import redis

from app.auth.models import User
from app.calc.common import from_entered
from app.db import SessionLocal
from app.realtime import service as realtime
from app.schedule import service
from app.schedule.schemas import ExtraIn
from app.shared.clock import today_seoul
from app.thread import service as thread_service
from tests.conftest import REDIS_URL, query
from tests.helpers import no_surprises, signup, use
from tests.test_extras import MOLD, scheduled
from tests.test_visit_inbox import login

TODAY = today_seoul()


def run(coro):
    return asyncio.run(coro)


def post(api, did: str, amount: int = 50_000, mode: str = "excluded", **over):
    return api.post(
        f"/vendor/jobs/{did}/extras",
        json={**MOLD, "entered_amount": amount, "vat_mode": mode, **over},
    )


def answer(api, pid: str, did: str, xid: str, what: str):
    return api.post(f"/projects/{pid}/deals/{did}/extras/{xid}/answer", json={"answer": what})


def items(r) -> list[dict]:
    return r.json()["extras"]["items"]


def rows() -> list[dict]:
    q = "select id, group_id, version, ack, superseded_at, client_key, total from extra_charges"
    return [dict(x) for x in query(q + " order by version")]


def test_same_key_twice_is_200_with_the_same_line(api):
    _, _, did = scheduled(api)
    key = str(uuid.uuid4())
    first = post(api, did, client_key=key)
    assert first.status_code == 201, first.text
    again = post(api, did, 90_000, client_key=key)  # 다시 눌러도 처음 줄 그대로
    assert again.status_code == 200, again.text
    assert items(again) == items(first)
    (row,) = rows()
    assert (str(row["client_key"]), row["version"], row["group_id"]) == (key, 1, row["id"])
    assert row["total"] == from_entered(50_000, "excluded").total
    other = post(api, did, client_key=str(uuid.uuid4()))  # 다른 키는 새 줄
    assert other.status_code == 201 and len(items(other)) == 2


def test_revise_makes_a_new_version_and_only_the_latest_counts(api):
    customer, pid, did = scheduled(api)
    one = items(post(api, did, 50_000))[0]
    r = post(api, did, 70_000, replaces=one["id"])
    assert r.status_code == 201, r.text
    old, new = items(r)
    assert (old["id"], old["superseded"], old["version"]) == (one["id"], True, 1)
    assert (new["group_id"], new["version"], new["superseded"]) == (one["group_id"], 2, False)
    extras = r.json()["extras"]
    assert extras["pending"]["total"] == from_entered(70_000, "excluded").total  # 앞 판은 빠진다
    stale = post(api, did, 80_000, replaces=one["id"])  # 이미 고친 앞 판
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "stale"
    assert post(api, did, replaces=str(uuid.uuid4())).status_code == 404
    latest = [x for x in rows() if x["superseded_at"] is None]
    assert len(latest) == 1 and latest[0]["version"] == 2

    use(api, customer)
    gone = answer(api, pid, did, one["id"], "approve")  # 최신 판만 답한다
    assert gone.status_code == 409 and gone.json()["error"]["code"] == "stale"
    ok = answer(api, pid, did, new["id"], "approve")
    assert ok.status_code == 200, ok.text
    assert ok.json()["ok"]["total"] == from_entered(70_000, "excluded").total
    assert ok.json()["pending"]["total"] == 0
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):  # 최신 판은 하나
        query("update extra_charges set superseded_at = null")


@pytest.mark.parametrize(
    ("start", "what", "status", "after"),
    [
        ("pending", "approve", 200, "approved"),
        ("pending", "reject", 200, "rejected"),
        ("pending", "ask", 200, "asked"),
        ("asked", "approve", 200, "approved"),
        ("asked", "reject", 200, "rejected"),
        ("asked", "ask", 409, "asked"),
        ("approved", "approve", 409, "approved"),
        ("approved", "reject", 409, "approved"),
        ("approved", "ask", 409, "approved"),
        ("rejected", "approve", 409, "rejected"),
        ("rejected", "ask", 409, "rejected"),
    ],
)
def test_answer_transitions(api, start, what, status, after):
    customer, pid, did = scheduled(api)
    xid = items(post(api, did))[0]["id"]
    if start != "pending":
        query("update extra_charges set ack = $1, acked_at = now()", start)
    use(api, customer)
    r = answer(api, pid, did, xid, what)
    assert r.status_code == status, r.text
    if status == 409:
        assert r.json()["error"]["code"] == "already"
    assert query("select ack from extra_charges")[0]["ack"] == after
    if status == 200:
        (x,) = r.json()["items"]
        assert x["answer"] == after
        notes = query("select dedup_key from notifications where kind = 'extra_acked'")
        assert [n["dedup_key"] for n in notes] == [f"extra:{xid}:{after}"]


def test_ask_posts_a_card_in_the_chat_and_old_ack_still_works(api):
    customer, pid, did = scheduled(api)
    owner = query("select owner_id from projects")[0]["owner_id"]
    (visit,) = query("select id, vendor_id from visits where status = 'chosen'")

    async def open_thread():
        async with SessionLocal() as s:
            tid = await thread_service.open(
                s,
                project_id=uuid.UUID(pid),
                vendor_id=visit["vendor_id"],
                customer_id=owner,
                visit_id=visit["id"],
                customer_label="상계동 고객",
                vendor_label="업체",
                area_label="노원구 69.4㎡",
            )
            await s.commit()
            return tid

    tid = run(open_thread())
    a = items(post(api, did, 50_000))[0]["id"]
    b = items(post(api, did, 20_000))[1]["id"]
    use(api, customer)
    assert answer(api, pid, did, a, "ask").status_code == 200
    got = query(
        "select system_code, ref_id from thread_messages where thread_id = $1 order by seq", tid
    )
    assert [(m["system_code"], str(m["ref_id"])) for m in got] == [
        ("extra_sent", a),
        ("extra_sent", b),
        ("extra_asked", a),
    ]
    sync = redis.Redis.from_url(REDIS_URL)  # 카드마다 두 사람 줄기에 msg (thread.notify_message)
    seqs = [
        json.loads(i[1][b"d"])["seq"]
        for i in sync.xrange(realtime.stream_key(visit["vendor_id"]))
        if i[1][b"e"] == b"msg"
    ]
    assert seqs == [1, 2, 3]
    r = api.post(f"/projects/{pid}/deals/{did}/extras/{b}/ack", json={"ack": "ok"})  # 옛 길
    assert r.status_code == 200, r.text
    old = next(x for x in r.json()["items"] if x["id"] == b)
    assert (old["ack"], old["answer"]) == ("ok", "approved")
    assert r.json()["talk"]["total"] == from_entered(50_000, "excluded").total  # 물어본 것


def test_simplified_vendor_adds_no_vat(api):
    _, _, did = scheduled(api)
    query("update vendors set tax_kind = 'simplified'")
    r = post(api, did, 100_000, "excluded")
    assert r.status_code == 201, r.text
    x = items(r)[0]
    assert (x["supply"], x["vat"], x["total"]) == (100_000, 0, 100_000)  # L02: 낸 금액 = 합계
    y = items(post(api, did, 55_000, "included"))[1]
    assert (y["supply"], y["vat"], y["total"]) == (55_000, 0, 55_000)


def test_totals_after_approval_and_preview_before_sending(api):
    """B3 · C37 · C38: 보내기 전 미리 보기(저장 안 함) · '승인하면 공사 금액' · 승인 뒤 공사 금액 (계산 엔진)"""
    customer, pid, did = scheduled(api)
    (base,) = [
        r["total"]
        for r in query("select q.total from deals d join vendor_quotes q on q.id = d.quote_id")
    ]
    url = f"/vendor/jobs/{did}/extras/preview"
    pre = api.get(url, params={"entered_amount": 50_000, "vat_mode": "excluded"})
    assert pre.status_code == 200, pre.text
    m = from_entered(50_000, "excluded")
    assert pre.json() == {
        "supply": m.supply,
        "vat": m.vat,
        "total": m.total,
        "tax_kind": "general",
        "grand_total": base,
        "after_total": base + m.total,
    }
    assert rows() == []  # 미리 보기는 저장하지 않는다
    a = items(post(api, did, 50_000))[0]
    assert a["after_total"] == base + m.total
    job = api.get(f"/vendor/jobs/{did}").json()
    assert (job["grand_total"], job["extras"]["deal_total"], job["extras"]["grand_total"]) == (
        base,
        base,
        base,
    )
    use(api, customer)
    out = answer(api, pid, did, a["id"], "approve").json()
    assert (out["grand_total"], out["items"][0]["after_total"]) == (base + m.total, None)
    (deal,) = api.get(f"/projects/{pid}/deals").json()
    assert deal["grand_total"] == base + m.total  # 공사 끝 화면의 '공사 금액'
    login(api, "maru@mitjip.test")
    assert api.get(f"/vendor/jobs/{did}").json()["grand_total"] == base + m.total

    query("update vendors set tax_kind = 'simplified'")
    s = api.get(url, params={"entered_amount": 100_000, "vat_mode": "excluded"}).json()
    assert (s["supply"], s["vat"], s["total"], s["tax_kind"]) == (100_000, 0, 100_000, "simplified")
    query("update vendors set tax_kind = 'exempt'")
    bad = api.get(url, params={"entered_amount": 100_000, "vat_mode": "excluded"})
    assert bad.status_code == 422 and bad.json()["error"]["fields"][0]["loc"] == ["vat_mode"]
    assert api.get(url, params={"entered_amount": -1}).status_code == 422
    login(api, "gyeol@mitjip.test")
    assert api.get(url, params={"entered_amount": 1}).status_code == 404  # 다른 업체 공사
    use(api, customer)
    assert api.get(url, params={"entered_amount": 1}).status_code == 403  # 고객이 업체 길


def test_same_key_at_once_saves_one_line(api):
    _, _, did = scheduled(api)
    vendor = query("select vendor_id from deals")[0]["vendor_id"]
    key = uuid.uuid4()

    async def go():
        async with SessionLocal() as s:
            v = await s.get(User, vendor)
            data = ExtraIn(**MOLD, entered_amount=30_000, client_key=key)
            return await service.add_extra(s, v, uuid.UUID(did), data, TODAY)

    async def both():
        return await asyncio.gather(go(), go(), return_exceptions=True)

    results = no_surprises(run(both()))
    assert sorted(created for _, created in results) == [False, True]
    assert len(rows()) == 1


def test_answer_needs_my_home_and_customer_role(api):
    customer, pid, did = scheduled(api)
    xid = items(post(api, did))[0]["id"]
    assert answer(api, pid, did, xid, "approve").status_code == 403  # 업체가 고객 길
    signup(api, "other@mitjip.test")
    assert answer(api, pid, did, xid, "approve").status_code == 404  # 남의 집
    use(api, customer)
    assert answer(api, pid, did, str(uuid.uuid4()), "approve").status_code == 404
    bad = api.post(f"/projects/{pid}/deals/{did}/extras/{xid}/answer", json={"answer": "ok"})
    assert bad.status_code == 422
    login(api, "maru@mitjip.test")
    assert query("select ack from extra_charges")[0]["ack"] == "pending"
