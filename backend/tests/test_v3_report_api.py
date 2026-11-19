"""신고 · 관리자 처리 (B1b, dev-07 · A02 · D26 · b7.md W6): 대상 확인 · 글 사본 · 차단 · 같은 글 한 번 ·
처리 기다림/처리함 수 · 신고한 사람 이름 없이 · 링크 칸 · 경고 · 쓰기 막기 · 업체 멈춤 · 링크 숨김 · 문제없음 ·
두 번째 처리 409 · 알림 · admin_actions."""

import uuid
from datetime import UTC, datetime

from tests.conftest import query
from tests.helpers import PHONE, make_admin, signup, use, vendor_signup
from tests.test_v3_review_api import LINK
from tests.test_v3_thread_api import CUSTOMER_NAME, pair, send


def chat_report(api, tid, mid=None, **over):
    body = {"kind": "chat", "thread_id": str(tid), "reason_code": "offsite", **over}
    if mid is not None:
        body["message_id"] = str(mid)
    return api.post("/reports", json=body)


def msg_id(seq: int) -> uuid.UUID:
    return query("select id from thread_messages where seq = $1", seq)[0]["id"]


def kinds(user_id) -> list[str]:
    rows = query("select kind from notifications where user_id = $1 order by created_at", user_id)
    return [r["kind"] for r in rows]


def test_chat_report_copies_the_message_and_blocks(api):
    p = pair(api)
    use(api, p.vendor)
    send(api, p.tid, "현금으로 하시면 10% 빼 드릴게요. 계약은 따로 하시죠.")
    use(api, p.customer)
    send(api, p.tid, "네?")
    r = chat_report(api, p.tid, msg_id(2), note="계약을 따로 하재요", block=True)
    assert r.status_code == 201, r.text
    assert (r.json()["kind"], r.json()["status"]) == ("chat", "open")
    (row,) = query("select vendor_id, thread_id, message_id, evidence, block from reports")
    assert row["vendor_id"] == p.vid and row["thread_id"] == p.tid and row["block"] is True
    assert row["evidence"] == "현금으로 하시면 10% 빼 드릴게요. 계약은 따로 하시죠."
    t = query("select status, ro_reason, blocked_at from threads")[0]
    assert (t["status"], t["ro_reason"]) == ("read_only", "blocked") and t["blocked_at"]
    again = chat_report(api, p.tid, msg_id(2))
    assert again.status_code == 409 and again.json()["error"]["code"] == "already"
    assert chat_report(api, p.tid, msg_id(3)).status_code == 422  # 내 글
    assert chat_report(api, p.tid, msg_id(1)).status_code == 422  # 시스템 카드
    assert chat_report(api, p.tid, uuid.uuid4()).status_code == 404
    assert chat_report(api, uuid.uuid4()).status_code == 404  # 남의 · 없는 대화
    # 업체도 채팅을 신고할 수 있지만 차단은 고객만
    use(api, p.vendor)
    assert chat_report(api, p.tid, msg_id(3), reason_code="abuse", block=True).status_code == 403
    r = chat_report(api, p.tid, msg_id(3), reason_code="abuse")
    assert r.status_code == 201
    mine = query("select vendor_id from reports where reporter_id = $1", p.vid)
    assert mine[0]["vendor_id"] is None  # 업체가 낸 신고에는 대상 업체가 없다
    other = signup(api, "other@mitjip.test")
    use(api, other)
    assert chat_report(api, p.tid).status_code == 404


def test_vendor_and_link_reports_are_for_customers(api):
    p = pair(api)
    now = datetime.now(UTC)
    query(LINK, p.vid, 0, "블로그 후기", "https://blog.example.com/maru", "shown", now)
    query(LINK, p.vid, 1, "확인 중", "https://place.example.com/maru", "checking", None)
    use(api, p.customer)
    vendor_body = {"kind": "vendor", "vendor_id": str(p.vid), "reason_code": "promise"}
    assert api.post("/reports", json=vendor_body).status_code == 201
    link = {"kind": "link", "vendor_id": str(p.vid), "link_sort": 0, "reason_code": "wrong_place"}
    assert api.post("/reports", json=link).status_code == 201
    assert query("select evidence from reports where kind = 'link'")[0]["evidence"] == (
        "https://blog.example.com/maru"
    )
    assert api.post("/reports", json={**link, "link_sort": 1}).status_code == 404  # 확인 중
    assert api.post("/reports", json={**link, "link_sort": 2}).status_code == 404  # 없음
    assert (
        api.post("/reports", json={**link, "reason_code": "offsite"}).status_code == 422
    )  # 종류 × 이유
    assert (
        api.post("/reports", json={**vendor_body, "vendor_id": str(uuid.uuid4())}).status_code
        == 404
    )
    vendor_signup(api, email="pending@mitjip.test")  # 승인 전 업체는 볼 수 없는 업체
    pending = query("select id from users where email = 'pending@mitjip.test'")[0]["id"]
    use(api, p.customer)
    assert api.post("/reports", json={**vendor_body, "vendor_id": str(pending)}).status_code == 404
    use(api, p.vendor)
    r = api.post("/reports", json=vendor_body)
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"


def test_admin_list_counts_and_detail_without_names(api):
    p = pair(api)
    query(
        LINK, p.vid, 0, "블로그 후기", "https://blog.example.com/maru", "shown", datetime.now(UTC)
    )
    use(api, p.vendor)
    send(api, p.tid, "계좌로 먼저 보내 주세요")
    use(api, p.customer)
    chat = chat_report(api, p.tid, msg_id(2)).json()["id"]
    vendor = api.post(
        "/reports", json={"kind": "vendor", "vendor_id": str(p.vid), "reason_code": "abuse"}
    ).json()["id"]
    link = api.post(
        "/reports",
        json={"kind": "link", "vendor_id": str(p.vid), "link_sort": 0, "reason_code": "not_vendor"},
    ).json()["id"]
    admin = make_admin(api)
    use(api, admin)
    page = api.get("/admin/reports")
    assert page.status_code == 200
    body = page.json()
    assert [x["id"] for x in body["items"]] == [link, vendor, chat]  # 최근 순
    assert body["counts"] == {"open": 3, "done": 0, "chat": 1, "vendor": 1, "link": 1}
    row = body["items"][-1]
    assert (row["vendor_name"], row["reporter_role"], row["block"], row["action"]) == (
        "마루와벽",
        "customer",
        False,
        None,
    )
    only = api.get("/admin/reports", params={"kind": "link"}).json()
    assert [x["id"] for x in only["items"]] == [link]
    detail = api.get(f"/admin/reports/{chat}").json()
    assert (
        detail["reporter_label"] == "상계동 고객"
        and detail["evidence"] == "계좌로 먼저 보내 주세요"
    )
    assert (detail["link_label"], detail["link_url"], detail["history"]) == (None, None, [])
    assert api.get(f"/admin/reports/{vendor}").json()["reporter_label"] == "상계동 고객"
    got = api.get(f"/admin/reports/{link}").json()
    assert (got["link_sort"], got["link_label"], got["link_url"]) == (
        0,
        "블로그 후기",
        "https://blog.example.com/maru",
    )
    for r in (page, api.get(f"/admin/reports/{chat}")):
        assert CUSTOMER_NAME not in r.text and PHONE not in r.text and p.c_email not in r.text
    assert api.get(f"/admin/reports/{uuid.uuid4()}").status_code == 404
    assert api.get("/admin/reports", params={"status": "done"}).json()["items"] == []


def test_resolve_warn_mute_link_and_dismiss(api):
    p = pair(api)
    query(
        LINK, p.vid, 0, "블로그 후기", "https://blog.example.com/maru", "shown", datetime.now(UTC)
    )
    use(api, p.vendor)
    send(api, p.tid, "카톡 아이디 maru123으로 연락 주세요")
    use(api, p.customer)
    warn = chat_report(api, p.tid, msg_id(2)).json()["id"]
    mute = chat_report(api, p.tid, reason_code="abuse").json()["id"]
    link = api.post(
        "/reports",
        json={
            "kind": "link",
            "vendor_id": str(p.vid),
            "link_sort": 0,
            "reason_code": "wrong_place",
        },
    ).json()["id"]
    none = api.post(
        "/reports", json={"kind": "vendor", "vendor_id": str(p.vid), "reason_code": "other"}
    ).json()["id"]
    admin = make_admin(api)
    use(api, admin)

    def resolve(rid, action, **kw):
        return api.post(f"/admin/reports/{rid}/resolve", json={"action": action, **kw})

    r = resolve(warn, "warn", note="1차 경고 · 다시 오면 기능 멈춤")
    assert r.status_code == 200, r.text
    got = r.json()
    assert (got["status"], got["action"], got["admin_note"]) == (
        "resolved",
        "warn",
        "1차 경고 · 다시 오면 기능 멈춤",
    )
    assert [(h["action"], h["admin_name"]) for h in got["history"]] == [("warn_vendor", "관리자")]
    assert resolve(warn, "none").json()["error"]["code"] == "already"  # 두 번째 409
    assert resolve(mute, "hide_link").status_code == 422  # 링크 신고만
    assert resolve(mute, "mute_chat").json()["action"] == "mute_chat"
    assert query("select vendor_muted_at from threads")[0]["vendor_muted_at"] is not None
    use(api, p.vendor)
    blocked = send(api, p.tid, "왜 막혔나요")
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "forbidden"
    use(api, admin)
    assert resolve(link, "hide_link").json()["action"] == "hide_link"
    assert query("select status, checked_at from vendor_review_links")[0]["status"] == "hidden"
    dismissed = resolve(none, "none").json()
    assert (dismissed["status"], dismissed["action"]) == ("dismissed", "none")
    assert kinds(p.vid) == ["vendor_warned", "vendor_muted", "link_checked"]
    assert kinds(p.cid) == ["report_resolved"] * 4
    acts = [r["action"] for r in query("select action from admin_actions order by at")]
    assert acts == ["warn_vendor", "mute_vendor", "link_hidden", "dismiss_report"]
    counts = api.get("/admin/reports").json()["counts"]
    assert (counts["open"], counts["done"]) == (0, 4)
    done = api.get("/admin/reports", params={"status": "done"}).json()
    assert {x["id"] for x in done["items"]} == {warn, mute, link, none}
    # 업체가 낸 채팅 신고(대상 업체 없음)에는 업체 조치를 못 한다
    use(api, p.vendor)
    query("update threads set vendor_muted_at = null")
    use(api, p.customer)
    send(api, p.tid, "확인했어요")
    use(api, p.vendor)
    theirs = chat_report(api, p.tid, msg_id(3), reason_code="abuse").json()["id"]
    use(api, admin)
    assert resolve(theirs, "warn").status_code == 422
    assert resolve(theirs, "none").status_code == 200


def test_resolve_suspend_all_closes_chats_and_tells_vendor(api):
    p = pair(api)
    q = pair(api, "c2@mitjip.test", "v2@mitjip.test", "결도배")  # 다른 업체 대화는 그대로
    use(api, p.customer)
    rid = api.post(
        "/reports", json={"kind": "vendor", "vendor_id": str(p.vid), "reason_code": "offsite"}
    ).json()["id"]
    admin = make_admin(api)
    use(api, admin)
    r = api.post(f"/admin/reports/{rid}/resolve", json={"action": "suspend_all", "note": "사기"})
    assert r.status_code == 200 and r.json()["action"] == "suspend_all"
    v = query("select suspended_at, suspend_scope from vendors where user_id = $1", p.vid)[0]
    assert v["suspended_at"] is not None and v["suspend_scope"] == "all"
    rows = {r["vendor_id"]: (r["status"], r["ro_reason"]) for r in query("select * from threads")}
    assert rows[p.vid] == ("read_only", "admin") and rows[q.vid] == ("open", None)
    assert "vendor_suspended" in kinds(p.vid)
    (act,) = query("select action, report_id, note from admin_actions")
    assert (act["action"], act["report_id"], act["note"]) == (
        "suspend_vendor",
        uuid.UUID(rid),
        "사기",
    )


def test_reports_have_a_daily_limit(api):
    signup(api, "c@mitjip.test")
    body = {"kind": "vendor", "vendor_id": str(uuid.uuid4()), "reason_code": "other"}
    for _ in range(10):  # 하루 10번 (B7 POLICY report): 대상이 없어 404여도 센다
        assert api.post("/reports", json=body).status_code == 404
    r = api.post("/reports", json=body)
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts"
