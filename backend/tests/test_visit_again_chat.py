"""한 번 더 요청하면 앞 요청이 끝나 읽기만이던 (공사, 업체) 채팅을 새 요청에 잇고 다시 연다(#214 리뷰).
차단 · 관리자로 닫힌 채팅은 그대로 읽기만이다."""

import uuid
from datetime import timedelta

from tests.conftest import query
from tests.helpers import use
from tests.test_v3_visit_kit import add, ask, customer, handle, status, vendor, visit_of
from tests.test_visit_inbox import login


def thread_of(pid: str) -> dict:
    rows = query(
        "select id::text, status, ro_reason, visit_id::text from threads where project_id = $1",
        uuid.UUID(pid),
    )
    assert len(rows) == 1
    return dict(rows[0])


def post(api, tid: str, body: str):
    return api.post(
        f"/threads/{tid}/messages",
        json={"client_key": str(uuid.uuid4()), "kind": "text", "body": body},
    )


def first_request(api) -> tuple[str, str, str, str]:
    vid = vendor(api, "maru@mitjip.test", "마루와벽")
    token, pid = customer(api)
    assert add(api, pid, vid).status_code == 201 and ask(api, pid, [vid]).status_code == 201
    return token, pid, vid, visit_of(pid, vid)


def expire(first: str) -> None:
    due = query("select reply_due_at from visits where id = $1", uuid.UUID(first))[0][0]
    handle("visit_reply_due", first, due + timedelta(minutes=1))
    assert status(first) == "expired"


def again(api, pid: str, first: str) -> str:
    r = api.post(f"/projects/{pid}/visits/{first}/again")
    assert r.status_code == 201, r.text
    return r.json()["visit_id"]


def test_again_after_expired_reopens_chat_on_new_request(api):
    token, pid, _vid, first = first_request(api)
    expire(first)
    t = thread_of(pid)
    assert (t["status"], t["ro_reason"], t["visit_id"]) == ("read_only", "expired", first)
    assert post(api, t["id"], "주차 되나요?").status_code == 409

    second = again(api, pid, first)
    t2 = thread_of(pid)
    assert t2["id"] == t["id"]  # 같은 채팅(앞 대화가 남아요)
    assert (t2["status"], t2["ro_reason"], t2["visit_id"]) == ("open", None, second)
    assert post(api, t["id"], "다시 요청했어요").status_code in (200, 201)
    login(api, "maru@mitjip.test")
    assert post(api, t["id"], "확인했어요").status_code in (200, 201)
    use(api, token)


def test_again_after_cancel_reopens_chat(api):
    _token, pid, _vid, first = first_request(api)
    r = api.post(f"/projects/{pid}/visits/{first}/cancel", json={"code": "changed"})
    assert r.status_code == 200, r.text
    assert thread_of(pid)["status"] == "read_only"
    second = again(api, pid, first)
    t = thread_of(pid)
    assert (t["status"], t["visit_id"]) == ("open", second)


def test_again_keeps_blocked_chat_read_only(api):
    _token, pid, _vid, first = first_request(api)
    tid = thread_of(pid)["id"]
    assert api.post(f"/threads/{tid}/block").status_code == 200
    expire(first)
    second = again(api, pid, first)
    t = thread_of(pid)
    assert (t["status"], t["ro_reason"], t["visit_id"]) == ("read_only", "blocked", second)
    assert post(api, tid, "열렸나요?").status_code == 409
