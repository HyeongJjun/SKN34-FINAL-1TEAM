"""고객-업체 채팅 API (B1b, dev-05 · b7.md W4): 목록 · 머리 · 글 · 같은 키 두 번 · 동시 두 글 seq 빈틈 없음 ·
읽음 · 주의 줄 · 동 · 호 꼴 · 사진 · 차단 · 쓰기 막기 · 남의 대화 404 · 업체 응답에 고객 이름 · 휴대폰 없음 · 한도.

준비 데이터는 바뀌는 중인 실측 흐름(B1a)에 기대지 않게 가입 · 승인 API + SQL 행 + thread.service.open으로 만든다.
"""

import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import date

from app.auth.models import User
from app.db import SessionLocal
from app.realtime import service as realtime
from app.thread import service as thread_service
from app.thread.schemas import MessageIn
from tests.conftest import query
from tests.helpers import JPEG, PHONE, make_admin, no_surprises, signup, upload, use
from tests.test_vendor_profile import approved_vendor, vendor_id

DAY = date(2026, 12, 15)  # 화요일
CUSTOMER_NAME = "김하늘"
PROJECT = (
    "insert into projects (id, owner_id, sido, sgg, emd, area_basis, area_m2, balcony_ext,"
    " start_kind, occupied, code) values ($1, $2, 'seoul', '노원구', $3, 'supply', 69.4, false,"
    " 'unknown', false, $4)"
)
VISIT = (
    "insert into visits (id, project_id, trade, vendor_id, vendor_name, slot, attempt, status,"
    " booked_day, booked_half) values ($1, $2, 'dobae', $3, $4, 1, 1, $5, $6, $7)"
)


@dataclass
class Pair:
    customer: str  # 세션 토큰
    vendor: str
    cid: uuid.UUID
    vid: uuid.UUID
    pid: uuid.UUID
    visit: uuid.UUID
    tid: uuid.UUID
    c_email: str
    v_email: str


def user_id(email: str) -> uuid.UUID:
    return query("select id from users where email = $1", email)[0]["id"]


def project_for(owner: uuid.UUID, emd: str = "상계동") -> uuid.UUID:
    pid = uuid.uuid4()
    query(PROJECT, pid, owner, emd, f"MJ-2611-{pid.int % 10**6:06d}")
    return pid


def open_thread(
    pid: uuid.UUID,
    vid: uuid.UUID,
    cid: uuid.UUID,
    visit: uuid.UUID,
    *,
    customer_label: str = "상계동 고객",
    vendor_label: str = "마루와벽",
) -> uuid.UUID:
    """실측이 확정됐을 때 visit.service가 하는 것처럼: 대화 열기 + 시스템 카드 '실측 … 정해졌어요'"""

    async def go():
        async with SessionLocal() as s:
            tid = await thread_service.open(
                s,
                project_id=pid,
                vendor_id=vid,
                customer_id=cid,
                visit_id=visit,
                customer_label=customer_label,
                vendor_label=vendor_label,
                area_label="노원구 상계동 69.4㎡",
            )
            await thread_service.post_system(
                s, tid, code="visit_booked", ref_id=visit, body="실측 12.15(화) 오전으로 정해졌어요"
            )
            await s.commit()
            return tid

    return asyncio.run(go())


def pair(
    api,
    c_email: str = "c@mitjip.test",
    v_email: str = "v@mitjip.test",
    biz: str = "마루와벽",
    status: str = "booked",
) -> Pair:
    """고객(김하늘) · 승인된 업체(biz) · 공사 · 확정된 실측 · 대화(시스템 카드 1개)"""
    customer = signup(api, c_email, name=CUSTOMER_NAME)
    vendor = approved_vendor(api, v_email)
    vid = vendor_id(v_email)
    query("update vendors set biz_name = $1 where user_id = $2", biz, vid)
    cid = user_id(c_email)
    pid = project_for(cid)
    visit = uuid.uuid4()
    query(VISIT, visit, pid, vid, biz, status, DAY, "am")
    tid = open_thread(pid, vid, cid, visit, vendor_label=biz)
    return Pair(customer, vendor, cid, vid, pid, visit, tid, c_email, v_email)


def send(api, tid, body: str | None = "안녕하세요", key=None, kind: str = "text", **extra):
    payload = {"client_key": str(key or uuid.uuid4()), "kind": kind, **extra}
    if body is not None:
        payload["body"] = body
    return api.post(f"/threads/{tid}/messages", json=payload)


def no_customer_pii(text: str, p: Pair) -> None:
    for secret in (CUSTOMER_NAME, PHONE, p.c_email, "010-1234-5678"):
        assert secret not in text, secret


def test_list_head_and_messages_for_both_sides(api):
    p = pair(api)
    use(api, p.customer)
    (row,) = api.get("/threads").json()
    assert row["thread_id"] == str(p.tid) and row["title"] == "마루와벽"
    assert row["visit_label"] == "실측 12.15(화) 오전"
    assert (
        row["last"]["kind"] == "system"
        and row["last"]["preview"] == "실측 12.15(화) 오전으로 정해졌어요"
    )
    assert (row["unread"], row["status"], row["ro_reason"]) == (1, "open", None)
    head = api.get(f"/threads/{p.tid}").json()
    assert head["title"] == "마루와벽" and head["project_id"] == str(p.pid)
    assert head["area_label"] == "노원구 상계동 69.4㎡" and head["visit_id"] == str(p.visit)
    assert head["can"] == {"write": True, "change_request": True, "cancel": True, "report": True}
    assert head["links"] == {"quote": None, "project": f"/projects/{p.pid}"}
    assert (head["last_seq"], head["read_seq"], head["blocked"]) == (1, 0, False)
    (card,) = api.get(f"/threads/{p.tid}/messages").json()
    assert card["from"] == "system" and card["system_code"] == "visit_booked"
    assert card["ref_id"] == str(p.visit)

    use(api, p.vendor)
    rows = api.get("/threads")
    assert rows.json()[0]["title"] == "상계동 고객"  # 업체에는 고객 이름 대신 동 + 고객
    head = api.get(f"/threads/{p.tid}")
    assert head.json()["project_id"] is None  # 업체에는 고객 공사 id를 주지 않는다
    assert head.json()["can"] == {
        "write": True,
        "change_request": False,
        "cancel": False,
        "report": True,
    }
    assert head.json()["links"]["project"] == f"/vendor/requests/{p.visit}"
    for r in (rows, head, api.get(f"/threads/{p.tid}/messages")):
        no_customer_pii(r.text, p)


def test_send_same_key_twice_unread_read_and_order(api):
    p = pair(api)
    use(api, p.customer)
    key = uuid.uuid4()
    first = send(api, p.tid, "101동 1203호예요. 도착 전에 010-1234-5678로 전화 주세요.", key)
    assert first.status_code == 201, first.text
    again = send(api, p.tid, "다른 글이어도 같은 키면 처음 글", key)
    assert again.status_code == 200 and again.json() == first.json()  # 같은 글을 돌려준다
    body = first.json()
    assert (body["seq"], body["from"], body["kind"], body["warn"]) == (2, "me", "text", None)
    assert query("select count(*) n from thread_messages where client_key = $1", key)[0]["n"] == 1
    # 고객 글의 동 · 호 꼴 → 전날 알림이 본다 (I7 B). 번호는 가리지 않는다(D05 A)
    assert query("select address_sent_at from threads")[0]["address_sent_at"] is not None
    assert "010-1234-5678" in query("select body from thread_messages where seq = 2")[0]["body"]
    # 내 글은 읽은 것: 내 안 읽은 수는 0, 업체는 2
    assert api.get("/threads").json()[0]["unread"] == 0
    use(api, p.vendor)
    assert api.get("/threads").json()[0]["unread"] == 2
    reply = send(api, p.tid, "네, 15일 오전 10시쯤 갈게요")
    assert reply.status_code == 201 and reply.json()["seq"] == 3
    msgs = api.get(f"/threads/{p.tid}/messages").json()
    assert [(m["seq"], m["from"]) for m in msgs] == [(1, "system"), (2, "them"), (3, "me")]
    # 업체는 고객이 직접 보낸 동 · 호 · 번호를 본다(D05 A) — 그 밖의 고객 정보는 없다
    assert "101동 1203호" in msgs[1]["body"]
    assert (
        api.post(f"/threads/{p.tid}/read", json={"seq": 99}).status_code == 204
    )  # 끝 seq로 줄여 저장
    assert api.get(f"/threads/{p.tid}").json()["read_seq"] == 3
    assert api.post(f"/threads/{p.tid}/read", json={"seq": 1}).status_code == 204  # 줄지 않는다
    assert api.get(f"/threads/{p.tid}").json()["read_seq"] == 3
    # 쪽 나누기: after_seq · before_seq · limit
    use(api, p.customer)
    after = api.get(f"/threads/{p.tid}/messages", params={"after_seq": 1, "limit": 1}).json()
    before = api.get(f"/threads/{p.tid}/messages", params={"before_seq": 3}).json()
    last = api.get(f"/threads/{p.tid}/messages", params={"limit": 2}).json()
    assert [m["seq"] for m in after] == [2]
    assert [m["seq"] for m in before] == [1, 2]
    assert [m["seq"] for m in last] == [2, 3]


def test_offsite_warn_line_only_on_customer_screen(api):
    p = pair(api)
    use(api, p.vendor)
    warned = send(api, p.tid, "현금으로 하시면 10% 빼 드릴게요. 계약은 따로 하시죠.")
    plain = send(api, p.tid, "도착 전에 연락 드릴게요")
    assert warned.status_code == 201 and warned.json()["warn"] is None  # 업체 화면에는 없다
    assert plain.json()["warn"] is None
    use(api, p.customer)
    msgs = {m["seq"]: m for m in api.get(f"/threads/{p.tid}/messages").json()}
    assert msgs[2]["warn"] == "offsite" and msgs[3]["warn"] is None
    mine = send(api, p.tid, "계좌로 보내면 되나요?")  # 고객 글에는 주의 줄을 붙이지 않는다
    assert mine.json()["warn"] is None
    assert query("select warn from thread_messages where seq = 4")[0]["warn"] is None


def test_others_cannot_see_or_write_and_admin_is_not_a_party(api):
    p = pair(api)
    other = signup(api, "other@mitjip.test")
    stranger = approved_vendor(api, "stranger@mitjip.test")
    fid = uuid.uuid4()
    for token in (other, stranger):
        use(api, token)
        assert api.get("/threads").json() == []
        for r in (
            api.get(f"/threads/{p.tid}"),
            api.get(f"/threads/{p.tid}/messages"),
            send(api, p.tid),
            api.post(f"/threads/{p.tid}/read", json={"seq": 1}),
            api.get(f"/threads/{p.tid}/files/{fid}"),
        ):
            assert r.status_code == 404, r.text
            assert r.json()["error"]["code"] == "not_found"
    use(api, other)
    assert api.post(f"/threads/{p.tid}/block").status_code == 404
    make_admin(api)
    assert api.get(f"/threads/{p.tid}").status_code == 403
    assert query("select last_seq from threads")[0]["last_seq"] == 1


def test_read_only_and_muted_vendor(api):
    p = pair(api)
    use(api, p.vendor)
    query("update threads set vendor_muted_at = now()")
    r = send(api, p.tid)
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"
    assert api.get(f"/threads/{p.tid}").json()["can"]["write"] is False
    use(api, p.customer)
    assert send(api, p.tid).status_code == 201  # 막힌 것은 업체 쪽 글쓰기만
    query("update threads set status = 'read_only', ro_reason = 'cancelled', closed_at = now()")
    r = send(api, p.tid)
    assert r.status_code == 409 and r.json()["error"]["code"] == "read_only"
    head = api.get(f"/threads/{p.tid}").json()
    assert head["can"]["write"] is False and head["ro_reason"] == "cancelled"
    assert api.get(f"/threads/{p.tid}/messages").status_code == 200  # 읽기는 된다


def test_block_and_unblock(api):
    p = pair(api)
    use(api, p.customer)
    r = api.post(f"/threads/{p.tid}/block")
    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["ro_reason"], r.json()["blocked"]) == (
        "read_only",
        "blocked",
        True,
    )
    assert api.post(f"/threads/{p.tid}/block").json()["error"]["code"] == "already"
    use(api, p.vendor)
    r = send(api, p.tid, "왜 답이 없으세요?")
    assert r.status_code == 409 and r.json()["error"]["code"] == "read_only"
    vendor_head = api.get(f"/threads/{p.tid}").json()
    assert vendor_head["blocked"] is False and vendor_head["can"]["write"] is False
    assert api.delete(f"/threads/{p.tid}/block").status_code == 403  # 차단은 고객만
    # 실측이 다시 확정돼도 차단한 대화는 열리지 않는다
    open_thread(p.pid, p.vid, p.cid, p.visit)
    assert query("select status, ro_reason from threads")[0]["ro_reason"] == "blocked"
    use(api, p.customer)
    r = api.delete(f"/threads/{p.tid}/block")
    assert r.status_code == 200 and (r.json()["status"], r.json()["blocked"]) == ("open", False)
    assert api.delete(f"/threads/{p.tid}/block").json()["error"]["code"] == "already"
    # 다른 사유로 닫힌 대화를 차단 · 풀기: 사유는 그대로, 다시 열지 않는다
    query("update threads set status = 'read_only', ro_reason = 'cancelled', closed_at = now()")
    assert api.post(f"/threads/{p.tid}/block").json()["ro_reason"] == "cancelled"
    open_thread(p.pid, p.vid, p.cid, p.visit)  # 다시 확정 → 차단이라 열리지 않고 사유는 차단
    assert query("select ro_reason from threads")[0]["ro_reason"] == "blocked"
    query("update threads set ro_reason = 'cancelled'")
    r = api.delete(f"/threads/{p.tid}/block").json()
    assert (r["status"], r["ro_reason"], r["blocked"]) == ("read_only", "cancelled", False)


def test_photo_message_only_two_parties_can_open(api):
    p = pair(api)
    use(api, p.customer)
    fid = upload(api, kind="chat_photo", content=JPEG, name="wall.jpg").json()["id"]
    r = send(api, p.tid, None, kind="photo", file_id=fid)
    assert r.status_code == 201, r.text
    assert (r.json()["kind"], r.json()["file_id"], r.json()["body"]) == ("photo", fid, None)
    assert api.get("/threads").json()[0]["last"]["preview"] == "사진"
    use(api, p.vendor)
    got = api.get(f"/threads/{p.tid}/files/{fid}")
    assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg"
    assert got.headers["cache-control"] == "private, no-store"
    assert api.get(f"/files/{fid}").status_code == 404  # 파일 길로는 올린 사람만
    # 업체가 고객 사진을 자기 글에 붙일 수는 없다 · 대화에 없는 내 사진도 못 연다
    r = send(api, p.tid, None, kind="photo", file_id=fid)
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid"
    mine = upload(api, kind="chat_photo", content=JPEG).json()["id"]
    assert api.get(f"/threads/{p.tid}/files/{mine}").status_code == 404
    use(api, p.customer)
    other_kind = upload(api, kind="photo").json()["id"]  # 공간 사진은 채팅에 못 붙인다
    assert send(api, p.tid, None, kind="photo", file_id=other_kind).status_code == 422


def test_input_limits_and_rate_limit(api):
    p = pair(api)
    use(api, p.customer)
    r = send(api, p.tid, "가" * 1001)
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid"
    assert send(api, p.tid, "가" * 1000).status_code == 201
    assert send(api, p.tid, "   ").status_code == 422  # 빈 글
    assert send(api, p.tid, None).status_code == 422  # 글 없는 text
    big = json.dumps({"client_key": str(uuid.uuid4()), "kind": "text", "body": "a" * 9000})
    r = api.post(
        f"/threads/{p.tid}/messages", content=big, headers={"content-type": "application/json"}
    )
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"  # 8KB (B7)
    # 사용자 분당 30 (B7 POLICY chat_message): 앞에서 1번 + 29번 → 31번째 429
    for _ in range(29):
        assert send(api, p.tid, "또").status_code == 201
    r = send(api, p.tid, "너무 많이")
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts"
    assert int(r.headers["retry-after"]) >= 1


def _post_as(uid: uuid.UUID, tid: uuid.UUID, body: str, key: uuid.UUID):
    async def go():
        async with SessionLocal() as s:
            user = await s.get(User, uid)
            data = MessageIn(client_key=key, kind="text", body=body)
            return await thread_service.post(s, user, tid, data)

    return go()


def test_two_posts_at_once_have_no_gap_and_same_key_is_one_message(api, monkeypatch):
    p = pair(api)
    pushed: list[tuple] = []

    async def fake_push(users, event, data):  # 이 시험은 Redis 대신 기록만 (다른 이벤트 루프)
        pushed.append((frozenset(u for u in users if u), event, data))
        return 0

    monkeypatch.setattr(realtime, "push", fake_push)

    async def both():
        return await asyncio.gather(
            _post_as(p.cid, p.tid, "고객 글", uuid.uuid4()),
            _post_as(p.vid, p.tid, "업체 글", uuid.uuid4()),
            _post_as(p.cid, p.tid, "고객 글 2", uuid.uuid4()),
            return_exceptions=True,
        )

    results = no_surprises(asyncio.run(both()))
    assert sorted(out.seq for out, created in results) == [2, 3, 4]
    assert all(created for _, created in results)
    key = uuid.uuid4()

    async def same():
        return await asyncio.gather(
            _post_as(p.cid, p.tid, "같은 키", key),
            _post_as(p.cid, p.tid, "같은 키", key),
            return_exceptions=True,
        )

    results = no_surprises(asyncio.run(same()))
    assert sorted(created for _, created in results) == [False, True]
    assert len({out.id for out, _ in results}) == 1
    seqs = [r["seq"] for r in query("select seq from thread_messages order by seq")]
    assert seqs == [1, 2, 3, 4, 5]  # 빈틈 없음
    assert query("select last_seq from threads")[0]["last_seq"] == 5
    # 보낸 글마다 상대 + 내 다른 기기에 msg {thread_id, seq} (글 · 이름은 넣지 않음)
    msgs = [x for x in pushed if x[1] == "msg"]
    assert len(msgs) == 4 and all(x[0] == {p.cid, p.vid} for x in msgs)
    assert {x[2]["seq"] for x in msgs} == {2, 3, 4, 5}
    assert all(set(x[2]) == {"thread_id", "seq"} for x in msgs)


def test_visit_state_drives_label_buttons_and_links(api):
    p = pair(api, status="visited")
    use(api, p.customer)
    head = api.get(f"/threads/{p.tid}").json()
    assert head["can"]["change_request"] is False and head["can"]["cancel"] is False  # 실측 뒤
    assert api.get("/threads").json()[0]["visit_label"] == "실측 12.15(화) 오전"
    query("update visits set status = 'cancelled', booked_day = null, booked_half = null")
    assert api.get("/threads").json()[0]["visit_label"] is None
    query("update visits set status = 'quoted', booked_day = $1, booked_half = 'pm'", DAY)
    head = api.get(f"/threads/{p.tid}").json()
    assert head["links"]["quote"] == f"/projects/{p.pid}/quotes"
    assert api.get("/threads").json()[0]["visit_label"] == "실측 12.15(화) 오후"
    use(api, p.vendor)
    assert (
        api.get(f"/threads/{p.tid}").json()["links"]["quote"] == f"/vendor/requests/{p.visit}/quote"
    )


def test_redact_does_nothing_while_retention_is_unlimited(api, monkeypatch):
    from datetime import UTC, datetime

    p = pair(api)
    use(api, p.customer)
    send(api, p.tid, "101동 1203호예요")
    query("update threads set status = 'read_only', ro_reason = 'cancelled',"
          " closed_at = now() - interval '400 days'")  # fmt: skip

    def run():
        async def go():
            async with SessionLocal() as s:
                done = await thread_service.redact(s, p.tid, now=datetime.now(UTC))
                await s.commit()
                return done

        return asyncio.run(go())

    assert thread_service.THREAD_CONTACT_RETENTION_DAYS is None  # L07 (사용자 결정 S18 B)
    assert run() is False
    assert query("select body from thread_messages where seq = 2")[0]["body"] == "101동 1203호예요"
    monkeypatch.setattr(thread_service, "THREAD_CONTACT_RETENTION_DAYS", 365)  # 법무가 정하면
    assert run() is True
    row = query("select body, redacted_at from thread_messages where seq = 2")[0]
    assert row["body"] is None and row["redacted_at"] is not None
    assert query("select body from thread_messages where seq = 1")[0][
        "body"
    ]  # 시스템 카드는 그대로
    msgs = api.get(f"/threads/{p.tid}/messages").json()
    assert msgs[1]["body"] is None and api.get("/threads").json()[0]["last"]["preview"] is None
    assert run() is False  # 두 번째는 할 것이 없다
