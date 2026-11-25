"""v3 실측 요청 (api.md 5장 · data-model 5장): 요청서 초안 · 담긴 업체에만 요청 · 희망 기간 · 시도 번호 ·
가견적 · 공사 희망일 사본 · 잠금 · 답 기한 일 · 업체 알림 · 상태판 · 한 번 더 요청 · blocked_retry ·
commit 뒤 화면 신호(API로 저장했을 때만)."""

import json
import uuid
from datetime import timedelta

import redis

from app.calc import deadline
from app.realtime.service import stream_key
from app.shared.clock import now_utc, today_seoul
from app.visit import service
from app.visit.schemas import CancelIn
from tests.conftest import REDIS_URL, query
from tests.helpers import signup, use
from tests.test_project import SOON
from tests.test_v3_visit_kit import (
    CUSTOMER_NAME,
    WISH,
    add,
    ask,
    booked,
    customer,
    d,
    handle,
    notes,
    pending_jobs,
    requested,
    run,
    status,
    user_id,
    v2_totals,
    vendor,
    visit_of,
    with_user,
)
from tests.test_visit_request import listed


def code(r) -> tuple[int, str]:
    return r.status_code, r.json().get("error", {}).get("code", "")


def board(api, pid: str) -> dict:
    r = api.get(f"/projects/{pid}/visits", params={"trade": "dobae"})
    assert r.status_code == 200, r.text
    return r.json()


def test_draft_then_request_fixes_copies_and_notifies(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    b = vendor(api, "gyeol@mitjip.test", "결도배", wall=7000)
    token, pid = customer(api)
    assert add(api, pid, a).status_code == 201 and add(api, pid, b).status_code == 201
    draft = api.get(f"/projects/{pid}/visits/draft", params={"trade": "dobae"})
    assert draft.status_code == 200, draft.text
    got = draft.json()
    assert (got["wish_start"], got["wish_end"], got["basis_start"]) == (
        d(WISH[0]),
        d(WISH[1]),
        SOON,
    )
    v2 = v2_totals(api, pid)
    assert [(x["name"], x["estimate_total"], x["grade"]) for x in got["vendors"]] == [
        ("마루와벽", v2[a], "basic"),
        ("결도배", v2[b], "basic"),
    ]

    r = ask(api, pid, [a, b])
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["failed"] == []
    made = {x["vendor_id"]: x for x in out["created"]}
    assert made[a]["estimate_total"] == v2[a] and made[a]["status"] == "requested"
    assert made[a]["contact_visible"] is False and made[a]["contact"] is None  # v3는 채팅으로
    rows = {
        str(r["vendor_id"]): r
        for r in query(
            "select v.*, s.slot sl_slot, s.status sl_status from visits v"
            " join shortlists s on s.id = v.shortlist_id"
        )
    }
    ra = rows[a]
    assert (ra["attempt"], ra["slot"], ra["sl_slot"], ra["sl_status"]) == (1, 1, 1, "active")
    assert (str(ra["wish_start"]), str(ra["wish_end"]), str(ra["work_wish_on"])) == (
        d(WISH[0]),
        d(WISH[1]),
        SOON,
    )
    assert ra["reply_due_at"] == deadline.reply_due(ra["created_at"])  # 보낸 때 + 48시간
    assert ra["share_contact"] is False and ra["message"] is None
    (proj,) = query("select locked_at from projects")
    assert proj["locked_at"] is not None  # 기본 정보가 잠긴다 (C50)
    jobs = pending_jobs(ra["id"], "visit_reply_due")
    assert [j["run_at"] for j in jobs] == [ra["reply_due_at"]]
    ev = query("select from_status, to_status, code, day, day_to from visit_events")
    assert {(e["from_status"], e["to_status"], e["code"]) for e in ev} == {
        (None, "requested", "asked")
    }
    assert {(str(e["day"]), str(e["day_to"])) for e in ev} == {(d(WISH[0]), d(WISH[1]))}
    (n,) = notes("maru@mitjip.test")
    assert (n["kind"], n["body"], n["link"]) == (
        "visit_requested",
        "새 실측 요청이 왔어요 · 노원구 도배",  # 업체 알림 끝 공사 이름 (B2b, 동이 없는 집)
        f"/vendor/requests/{ra['id']}",
    )
    assert CUSTOMER_NAME not in n["body"]
    assert (
        api.get(f"/projects/{pid}/visits/draft", params={"trade": "dobae"}).json()["vendors"] == []
    )
    assert token


def test_request_rules_and_failures(api):
    a = vendor(api, "a@mitjip.test", "가")
    b = vendor(api, "b@mitjip.test", "나")
    none = listed(api, "none@mitjip.test", "단가없음")
    _, pid = customer(api)
    assert add(api, pid, a).status_code == 201
    assert code(ask(api, pid, [b])) == (409, "stale")  # 담지 않은 업체뿐
    url = f"/projects/{pid}/visits"
    only_end = {"trade": "dobae", "vendor_ids": [a], "wish_end": d(10)}
    assert code(api.post(url, json=only_end)) == (422, "invalid")
    assert code(ask(api, pid, [a], start=3, end=66)) == (422, "invalid")  # 63일
    assert code(ask(api, pid, [a], start=0, end=5)) == (422, "invalid")  # 오늘부터는 안 돼요
    assert code(ask(api, pid, [a], start=5, end=4)) == (422, "invalid")
    photo = ask(api, pid, [a], photo_file_ids=[str(uuid.uuid4())])
    assert code(photo) == (422, "invalid")  # 올린 적 없는 사진 (요청 사진은 test_v3_visit_photos)
    assert query("select count(*) n from visits")[0]["n"] == 0
    assert query("select locked_at from projects")[0]["locked_at"] is None  # 실패하면 잠그지 않는다

    r = ask(api, pid, [a, b])
    assert r.status_code == 201 and r.json()["failed"] == [
        {"vendor_id": b, "code": "not_shortlisted"}
    ]
    assert code(ask(api, pid, [a])) == (409, "already")  # 이미 요청한 업체
    assert add(api, pid, none).status_code == 409
    query(
        "update vendors set suspended_at = now(), suspend_scope = 'new' where user_id = $1",
        uuid.UUID(b),
    )
    assert code(add(api, pid, b)) == (404, "not_found")  # 멈춘 업체는 고를 수 없어요


def test_board_head_next_and_can(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    b = vendor(api, "gyeol@mitjip.test", "결도배", wall=7000)
    _, pid = customer(api)
    for v in (a, b):
        assert add(api, pid, v).status_code == 201
    assert ask(api, pid, [a, b]).status_code == 201
    got = board(api, pid)
    head = got["head"]
    assert (head["wish_start"], head["wish_end"], head["work_wish_on"]) == (d(2), d(16), SOON)
    assert head["photos"] == [] and head["trade"] == "dobae"
    rows = {r["vendor_id"]: r for r in got["board"]}
    ra = rows[a]
    assert (ra["status"], ra["attempt"], ra["estimate_total"]) == (
        "requested",
        1,
        v2_totals(api, pid)[a],
    )
    assert ra["next"]["kind"] == "reply" and ra["next"]["who"] == "vendor"
    assert ra["next"]["overdue"] is False and ra["next"]["due_at"]
    assert ra["can"] == {
        "pick": False,
        "cancel": True,
        "again": False,
        "visited": False,
        "change": False,
        "requote": False,
    }
    assert ra["window"] is None and ra["booked"] is None and ra["thread_id"]  # 요청 때 채팅
    query(
        "update visits set reply_due_at = now() - interval '1 minute' where vendor_id = $1",
        uuid.UUID(b),
    )
    rb = {r["vendor_id"]: r for r in board(api, pid)["board"]}[b]
    assert rb["next"]["overdue"] is True  # worker가 늦어도 화면은 '지남'


def test_again_after_expired_then_blocked_retry(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    token, pid = customer(api)
    assert add(api, pid, a).status_code == 201 and ask(api, pid, [a]).status_code == 201
    first = visit_of(pid, a)
    due = query("select reply_due_at from visits where id = $1", uuid.UUID(first))[0][0]
    assert code(api.post(f"/projects/{pid}/visits/{first}/again")) == (
        409,
        "stale",
    )  # 아직 살아 있음
    out = handle("visit_reply_due", first, due + timedelta(minutes=1))
    assert getattr(out, "changed", out) is True and status(first) == "expired"
    sl = query("select status, removed_code from shortlists")
    assert [(r["status"], r["removed_code"]) for r in sl] == [("removed", "expired")]  # 칸이 빈다
    row = board(api, pid)["board"][0]
    assert (row["status"], row["expired_reason"], row["can"]["again"]) == ("expired", "reply", True)

    r = api.post(f"/projects/{pid}/visits/{first}/again")
    assert r.status_code == 201, r.text
    second = r.json()
    assert (second["attempt"], second["status"], second["vendor_id"]) == (2, "requested", a)
    assert status(first) == "expired" and second["visit_id"] != first
    ev = query("select code from visit_events where visit_id = $1", uuid.UUID(second["visit_id"]))
    assert [e["code"] for e in ev] == ["re_asked"]
    assert query("select count(*) n from shortlists where status = 'active'")[0]["n"] == 1
    assert code(api.post(f"/projects/{pid}/visits/{first}/again")) == (409, "already")

    due = query("select reply_due_at from visits where id = $1", uuid.UUID(second["visit_id"]))[0][
        0
    ]
    handle("visit_reply_due", second["visit_id"], due + timedelta(minutes=1))
    assert board(api, pid)["board"][0]["can"]["again"] is False
    assert code(api.post(f"/projects/{pid}/visits/{second['visit_id']}/again")) == (
        409,
        "blocked_retry",
    )
    assert code(add(api, pid, a)) == (409, "blocked_retry")  # 두 번째도 답이 없던 업체 (C18)
    card = api.get(f"/projects/{pid}/vendors", params={"trade": "dobae"}).json()["local"][0]
    assert card["state"] == "blocked_retry"
    vendor_notes = [n["kind"] for n in notes("maru@mitjip.test")]
    assert vendor_notes == ["visit_requested", "visit_requested"]
    assert [n["kind"] for n in notes("home@mitjip.test")] == ["visit_reply_expired"] * 2
    signup(api, "other@mitjip.test")
    assert api.post(f"/projects/{pid}/visits/{first}/again").status_code == 404
    use(api, token)


def test_again_after_cancel_reuses_a_free_slot(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    _, pid = customer(api)
    assert add(api, pid, a).status_code == 201 and ask(api, pid, [a]).status_code == 201
    first = visit_of(pid, a)
    r = api.post(f"/projects/{pid}/visits/{first}/cancel", json={"code": "changed"})
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    again = api.post(f"/projects/{pid}/visits/{first}/again")
    assert again.status_code == 201 and again.json()["attempt"] == 2
    (sl,) = query("select slot from shortlists where status = 'active'")
    assert sl["slot"] == 1


def stream(who) -> list[tuple[str, dict]]:
    """그 사람 실시간 줄기의 (이벤트, 몸통) 목록"""
    r = redis.Redis.from_url(REDIS_URL)
    rows = r.xrange(stream_key(uuid.UUID(str(who))))
    return [(f[b"e"].decode(), json.loads(f[b"d"])) for _id, f in rows]


def test_signals_only_after_an_api_commit(api):
    f = requested(api)
    owner = user_id("home@mitjip.test")
    state = ("state", {"kind": "visit", "project_id": f["pid"], "id": f["visit"]})
    for who in (owner, f["vendor"]):
        got = stream(who)
        assert state in got and ("notif", {"unread": 1 if who == f["vendor"] else 0}) in got

    seen = len(stream(f["vendor"]))
    assert code(ask(api, f["pid"], [f["vendor"]])) == (409, "already")  # 오류면 신호 없음
    assert len(stream(f["vendor"])) == seen

    def cancel(s, user):  # service를 바로 부르면(시연 데이터 · 테스트) 줄기를 쓰지 않는다
        pid, vid = uuid.UUID(f["pid"]), uuid.UUID(f["visit"])
        return service.cancel(s, user, pid, vid, today_seoul(), CancelIn(code="changed"), now_utc())

    run(with_user(owner, cancel))
    assert status(f["visit"]) == "cancelled"
    assert len(stream(f["vendor"])) == seen


def test_system_card_wakes_both_chats(api):
    f = booked(api)  # 실측 확정 카드(visit_booked)가 대화 1번 글
    tid = str(query("select id from threads")[0]["id"])
    msg = ("msg", {"thread_id": tid, "seq": 1})
    assert msg in stream(user_id("home@mitjip.test")) and msg in stream(f["vendor"])
