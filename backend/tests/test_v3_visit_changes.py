"""v3 확정 뒤 일정 바꾸기 (C28 · V20 · data-model 4장 visit_changes): 고객 요청(booked에서만 · 열린 요청 하나) ·
업체 받기(반나절 옮김 · 기한 일 다시 · 시스템 카드) · 업체가 다른 날 내기 → 고객 고르기 · 거두기 ·
옮길 반나절이 차 있으면 409 slot_taken(원래 일정 그대로) · 권한."""

import uuid

from app.calc import deadline
from tests.conftest import query
from tests.helpers import signup, use
from tests.test_v3_visit_kit import booked, choose, d, day, notes, offered, pending_jobs, vendor
from tests.test_visit_inbox import login


def code(r) -> tuple[int, str]:
    return r.status_code, r.json().get("error", {}).get("code", "")


def ask_change(api, f: dict, n: int, half: str):
    return api.post(
        f"/projects/{f['pid']}/visits/{f['visit']}/changes", json={"day": d(n), "half": half}
    )


def cards() -> list:
    return [m["system_code"] for m in query("select system_code from thread_messages order by seq")]


def test_change_request_then_vendor_accepts(api):
    f = booked(api)  # 오늘 + 6일 오전
    assert code(ask_change(api, f, 6, "am")) == (422, "invalid")  # 같은 반나절
    assert code(ask_change(api, f, 20, "am")) == (422, "invalid")  # 업체 기간(5 ~ 12일) 밖
    r = ask_change(api, f, 8, "pm")
    assert r.status_code == 201, r.text
    c = r.json()
    assert (c["from_day"], c["from_half"], c["to_day"], c["to_half"], c["status"]) == (
        d(6),
        "am",
        d(8),
        "pm",
        "open",
    )
    assert code(ask_change(api, f, 9, "am")) == (409, "already")  # 열린 요청 하나
    assert [j["kind"] for j in pending_jobs(c["id"])] == ["visit_change_due"]
    assert cards() == ["visit_booked", "change_requested"]
    tid = str(query("select id from threads")[0]["id"])
    (n,) = notes(f["email"], "visit_change_requested")
    assert n["link"] == f"/chat/{tid}"
    row = api.get(f"/projects/{f['pid']}/visits", params={"trade": "dobae"}).json()["board"][0]
    assert row["change"]["id"] == c["id"] and row["next"]["kind"] == "change"
    assert row["next"]["who"] == "vendor" and row["can"]["change"] is False
    assert row["booked"]["day"] == d(6)  # 받기 전까지는 원래 일정 그대로 (C28)

    login(api, f["email"])
    r = api.post(f"/vendor/visits/{f['visit']}/changes/{c['id']}/accept")
    assert r.status_code == 200, r.text
    assert r.json()["booked"] == {"day": d(8), "half": "pm", "kind": "booked", "hold_until": None}
    holds = query("select day, half, status from visit_holds order by created_at")
    assert [(str(h["day"]), h["half"], h["status"]) for h in holds] == [
        (d(6), "am", "released"),
        (d(8), "pm", "active"),
    ]
    vr = query("select booked_day, booked_half, quote_due_at from visits")[0]
    assert (str(vr["booked_day"]), vr["booked_half"]) == (d(8), "pm")
    assert vr["quote_due_at"] == deadline.quote_due(day(8))
    assert [j["run_at"] for j in pending_jobs(f["visit"], "visit_reminder")] == [
        deadline.reminder_at(day(8))
    ]
    assert pending_jobs(c["id"]) == []
    assert query("select status from visit_changes")[0]["status"] == "accepted"
    assert cards() == ["visit_booked", "change_requested", "change_done"]
    assert len(notes("home@mitjip.test", "visit_change_accepted")) == 1
    again = api.post(f"/vendor/visits/{f['visit']}/changes/{c['id']}/accept")
    assert code(again) == (409, "stale")


def test_vendor_counters_and_customer_picks(api):
    f = booked(api)
    c = ask_change(api, f, 8, "pm").json()
    login(api, f["email"])
    url = f"/vendor/visits/{f['visit']}/changes/{c['id']}/propose"
    same = {"slots": [{"day": d(6), "half": "am"}]}
    assert code(api.post(url, json=same)) == (422, "invalid")  # 지금 날짜
    twice = {"slots": [{"day": d(9), "half": "am"}, {"day": d(9), "half": "am"}]}
    assert code(api.post(url, json=twice)) == (422, "invalid")
    body = {"slots": [{"day": d(9), "half": "am"}, {"day": d(10), "half": "pm"}]}
    r = api.post(url, json=body)
    assert r.status_code == 200 and r.json()["status"] == "booked", r.text
    assert query("select status from visit_changes")[0]["status"] == "countered"
    p = query("select id, change_id from visit_proposals")[0]
    assert str(p["change_id"]) == c["id"] and pending_jobs(c["id"]) == []
    assert [j["kind"] for j in pending_jobs(p["id"])] == ["visit_proposal_due"]
    assert cards()[-1] == "change_countered"
    assert len(notes("home@mitjip.test", "visit_change_countered")) == 1

    use(api, f["token"])
    got = api.get(f"/projects/{f['pid']}/visits/{f['visit']}").json()
    assert (
        got["change"]["status"] == "countered"
        and got["change"]["proposal"]["slots"] == body["slots"]
    )
    pick = f"/projects/{f['pid']}/visits/{f['visit']}/changes/{c['id']}/pick"
    assert code(api.post(pick, json={"day": d(11), "half": "am"})) == (422, "invalid")
    r = api.post(pick, json={"day": d(10), "half": "pm"})
    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["to_day"], r.json()["to_half"]) == (
        "accepted",
        d(10),
        "pm",
    )
    vr = query("select booked_day, booked_half from visits")[0]
    assert (str(vr["booked_day"]), vr["booked_half"]) == (d(10), "pm")
    assert query("select status from visit_proposals")[0]["status"] == "picked"
    assert cards()[-1] == "change_done"


def test_withdraw_then_new_request(api):
    f = booked(api)
    c = ask_change(api, f, 8, "pm").json()
    r = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/changes/{c['id']}/withdraw")
    assert r.status_code == 200 and r.json()["status"] == "withdrawn", r.text
    assert pending_jobs(c["id"]) == []
    again = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/changes/{c['id']}/withdraw")
    assert code(again) == (409, "stale")
    login(api, f["email"])
    late = api.post(f"/vendor/visits/{f['visit']}/changes/{c['id']}/accept")
    assert code(late) == (409, "stale")
    use(api, f["token"])
    assert ask_change(api, f, 9, "am").status_code == 201  # 다시 요청할 수 있다
    ev = query("select code from visit_events where code like 'change%' order by at")
    assert [e["code"] for e in ev] == ["change_requested", "change_withdrawn", "change_requested"]


def test_accept_fails_when_the_new_half_is_taken(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    query("update vendors set visit_capacity = 1 where user_id = $1", uuid.UUID(a))
    one = booked(api, vid=a, customer_email="one@mitjip.test")  # 6일 오전
    c = ask_change(api, one, 9, "am").json()
    two = offered(api, vid=a, customer_email="two@mitjip.test")
    assert choose(api, two["pid"], two["visit"], n=9, half="am").json()["status"] == "booked"
    login(api, "maru@mitjip.test")
    r = api.post(f"/vendor/visits/{one['visit']}/changes/{c['id']}/accept")
    assert code(r) == (409, "slot_taken")
    held = query(
        "select day, half from visit_holds where visit_id = $1 and status = 'active'",
        uuid.UUID(one["visit"]),
    )
    assert [(str(h["day"]), h["half"]) for h in held] == [(d(6), "am")]  # 원래 일정 그대로
    assert query("select status from visit_changes")[0]["status"] == "open"
    use(api, one["token"])
    full = ask_change(api, one, 9, "am")
    assert code(full) == (409, "already")


def test_change_permissions(api):
    f = booked(api)
    c = ask_change(api, f, 8, "pm").json()
    other = vendor(api, "other@mitjip.test", "다른도배")
    login(api, "other@mitjip.test")
    assert api.post(f"/vendor/visits/{f['visit']}/changes/{c['id']}/accept").status_code == 404
    signup(api, "stranger@mitjip.test")
    base = f"/projects/{f['pid']}/visits/{f['visit']}"
    assert api.post(f"{base}/changes/{c['id']}/withdraw").status_code == 404
    assert api.post(f"{base}/changes", json={"day": d(9), "half": "am"}).status_code == 404
    login(api, f["email"])
    assert api.post(f"{base}/changes/{c['id']}/withdraw").status_code == 403  # 업체가 고객 길
    use(api, f["token"])
    wrong = api.post(f"{base}/changes/{uuid.uuid4()}/withdraw")
    assert wrong.status_code == 404
    assert other
