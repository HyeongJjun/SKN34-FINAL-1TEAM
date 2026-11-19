"""v3 업체 작업함 (V03 · V08 · D04, N4 C): 탭(할 일 · 기다림 · 일정 · 공사 · 끝남) · 상태 아이콘 + 글자 ·
다음 일 · 기한(계산 엔진) · 기한 가까운 순 · 요약 수 = 탭 줄 수 · v3 줄 칸, 고객 이름 · 휴대폰 · 동호수 없음,
권한(다른 업체는 안 보임 · 역할 403)."""

import uuid
from datetime import datetime, timedelta

from app.shared.clock import today_seoul
from tests.conftest import query
from tests.helpers import signup, use, vendor_signup
from tests.test_dates import ready
from tests.test_project import body as project_body
from tests.test_visit_inbox import login
from tests.test_visit_request import SHARE, listed, send
from tests.test_visit_vendors import NOWON_32

TODAY = today_seoul()
INBOX = "/vendor/visits"
NAME = "김믿집"  # 업체 화면에 나오면 안 되는 고객 이름 (합성)
STATES = ("new", "picked", "offered", "booked", "visited_late", "late", "overdue", "old", "quoted")


def board(api):
    """마루와벽 한 곳에 집 9곳이 한 건씩 요청한 상태 (상태는 SQL로 맞춘다). 고객은 연락처를 보냈다(v2)."""
    a = listed(api, "maru@mitjip.test", "마루와벽")
    token = signup(api, "home@mitjip.test", name=NAME)
    pids = []
    for _ in STATES:
        pid = api.post("/projects", json=project_body(**NOWON_32)).json()["id"]
        assert send(api, pid, [a], share_contact_ids=[a], **SHARE).status_code == 201
        pids.append(pid)
    vids = {
        st: str(query("select id from visits where project_id = $1", uuid.UUID(p))[0]["id"])
        for st, p in zip(STATES, pids, strict=True)
    }
    vendor = uuid.UUID(a)

    def at(name: str, sql: str, *args):
        query(sql + " where id = $1", uuid.UUID(vids[name]), *args)

    at("new", "update visits set reply_due_at = now() + interval '10 hours'")
    at("picked", "update visits set status = 'picked'")
    query(
        "insert into visit_holds (id, vendor_id, visit_id, day, half, seat, kind, until)"
        " values (gen_random_uuid(), $1, $2, $3, 'pm', 1, 'hold', now() + interval '20 hours')",
        vendor,
        uuid.UUID(vids["picked"]),
        TODAY + timedelta(days=6),
    )
    at("offered", "update visits set status = 'offered'")
    query(
        "insert into visit_windows (visit_id, start_date, end_date, pick_due_at)"
        " values ($1, $2, $3, now() + interval '7 days')",
        uuid.UUID(vids["offered"]),
        TODAY + timedelta(days=3),
        TODAY + timedelta(days=9),
    )
    at("booked", "update visits set status = 'booked', booked_day = $2, booked_half = 'am'",
       TODAY + timedelta(days=5))  # fmt: skip
    at(
        "visited_late",
        "update visits set status = 'booked', booked_day = $2, booked_half = 'pm',"
        " quote_due_at = now() + interval '2 days'",
        TODAY - timedelta(days=1),
    )
    at("late", "update visits set status = 'expired', expired_reason = 'reply',"
       " reply_due_at = now() - interval '1 day'")  # fmt: skip
    at("overdue", "update visits set reply_due_at = now() - interval '1 hour'")
    at("old", "update visits set status = 'expired', expired_reason = 'reply',"
       " reply_due_at = now() - interval '10 days'")  # fmt: skip
    at("quoted", "update visits set status = 'quoted', quote_ver = 1")
    query(
        "update projects set emd = '상계동', budget_won = 3000000 where id = $1", uuid.UUID(pids[0])
    )
    return token, vids, pids


def ids(rows) -> list[str]:
    return [r["id"] for r in rows]


def test_tabs_states_and_due_order(api):
    _, v, pids = board(api)
    login(api, "maru@mitjip.test")
    todo = api.get(INBOX, params={"tab": "todo"}).json()["items"]
    assert ids(todo) == [v["new"], v["picked"], v["visited_late"], v["late"], v["overdue"]]
    by = {r["id"]: r for r in todo}
    assert by[v["new"]]["state"] == {"icon": "todo", "label": "새 실측 요청"}
    assert by[v["new"]]["next"]["label"] == "기간 답하기"
    assert by[v["new"]]["next"]["overdue"] is False and by[v["new"]]["new"] is True
    assert by[v["picked"]]["state"]["label"] == "날짜 수락"
    assert by[v["visited_late"]]["next"]["label"] == "견적서 보내기"
    assert by[v["late"]]["state"] == {"icon": "late", "label": "답 기한 지남"}
    assert by[v["late"]]["next"] == {
        "label": "재요청 오면 답하기",
        "due_at": by[v["late"]]["next"]["due_at"],
        "overdue": True,
    }
    assert by[v["overdue"]]["state"] == {"icon": "late", "label": "답 기한 지남"}
    assert by[v["overdue"]]["next"]["overdue"] is True

    due = api.get(INBOX, params={"tab": "todo", "sort": "due"}).json()["items"]
    assert ids(due) == [v["late"], v["overdue"], v["new"], v["picked"], v["visited_late"]]
    stamps = [datetime.fromisoformat(r["next"]["due_at"]) for r in due]
    assert stamps == sorted(stamps)
    new = api.get(INBOX, params={"tab": "todo", "sort": "new"}).json()["items"]
    assert ids(new) == list(reversed(ids(todo)))

    waiting = api.get(INBOX, params={"tab": "waiting"}).json()["items"]
    assert set(ids(waiting)) == {v["offered"], v["quoted"]}
    w = {r["id"]: r for r in waiting}
    assert w[v["offered"]]["state"] == {"icon": "wait", "label": "고객 차례"}
    assert w[v["quoted"]]["state"] == {"icon": "wait", "label": "견적서 보냄"}
    assert w[v["offered"]]["next"] == {"label": "고객 답 기다림", "due_at": None, "overdue": False}

    (sched,) = api.get(INBOX, params={"tab": "sched"}).json()["items"]
    day = TODAY + timedelta(days=5)
    assert sched["id"] == v["booked"] and sched["state"] == {"icon": "ok", "label": "실측 확정"}
    assert (
        sched["next"]["label"]
        == f"{day.month}.{day.day}({'월화수목금토일'[day.weekday()]}) 오전 실측"
    )
    (done,) = api.get(INBOX, params={"tab": "done"}).json()["items"]
    assert done["id"] == v["old"] and done["state"]["icon"] == "done" and done["closed_at"]

    summary = api.get(f"{INBOX}/summary").json()
    assert {k: summary[k] for k in ("todo", "waiting", "sched", "jobs", "done")} == {
        "todo": 5,
        "waiting": 2,
        "sched": 1,
        "jobs": 0,
        "done": 1,
    }
    assert summary["recent"]["requested"] == len(STATES)
    assert pids


def test_row_v3_fields_and_no_customer_details(api):
    _, v, _ = board(api)
    login(api, "maru@mitjip.test")
    r = api.get(INBOX, params={"tab": "todo"})
    row = next(x for x in r.json()["items"] if x["id"] == v["new"])
    assert row["area_label"] == "노원구 상계동 · 공급 105.8㎡"  # calc.visit_view.area_label
    assert row["home"] == "아파트 · 도배 전체 · 빈 집"
    assert (row["budget_won"], row["attempt"]) == (3_000_000, 1) and "customer" not in row
    other = next(x for x in r.json()["items"] if x["id"] == v["picked"])
    assert other["area_label"] == "노원구 · 공급 105.8㎡" and other["budget_won"] is None  # 동 없음
    texts = [r.text] + [
        api.get(INBOX, params={"tab": t}).text for t in ("waiting", "sched", "jobs", "done")
    ]
    for t in texts:  # 이름 · 휴대폰 · 동 · 호 · 아파트 이름이 응답 어디에도 없다 (SHARE 값)
        for secret in (NAME, "01012345678", "상계주공", '"1203"', "1203호", '"101"', "101동"):
            assert secret not in t, secret
    due = datetime.fromisoformat(row["next"]["due_at"])
    assert due > datetime.now().astimezone()


def test_jobs_tab_v3_card(api):
    customer, pid, did, va = ready(api)
    (job,) = api.get(INBOX, params={"tab": "jobs"}).json()["items"]
    assert (job["deal_id"], job["id"]) == (did, va) and "customer" not in job
    assert job["state"] == {"icon": "todo", "label": "공사 날짜 올리기"}
    assert job["next"]["label"] == "공사 날짜 올리기"
    assert datetime.fromisoformat(job["next"]["due_at"]) == datetime.fromisoformat(
        job["dates_due_at"]
    )
    assert job["deal_total"] == 3_388_000 and job["work_days"] == []
    query("update deals set dates_due_at = now() - interval '1 hour'")
    late = api.get(INBOX, params={"tab": "jobs"}).json()["items"][0]
    assert late["state"]["icon"] == "late" and late["next"]["overdue"] is True
    assert api.get(f"{INBOX}/summary").json()["jobs"] == 1
    assert customer and pid


def test_only_my_requests_and_vendor_role(api):
    token, v, _ = board(api)
    listed(api, "other@mitjip.test", "다른도배")
    login(api, "other@mitjip.test")
    for tab in ("todo", "waiting", "sched", "jobs", "done"):
        assert api.get(INBOX, params={"tab": tab}).json()["items"] == [], tab
    s = api.get(f"{INBOX}/summary").json()
    assert (s["todo"], s["waiting"], s["sched"], s["done"]) == (0, 0, 0, 0)
    assert api.get(INBOX, params={"tab": "todo", "sort": "old"}).status_code == 422
    use(api, token)
    assert api.get(INBOX, params={"tab": "sched"}).status_code == 403  # 고객이 업체 길
    vendor_signup(api, email="waiting@mitjip.test")  # 승인 전
    r = api.get(INBOX, params={"tab": "sched", "sort": "due"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "vendor_not_approved"
    assert v
